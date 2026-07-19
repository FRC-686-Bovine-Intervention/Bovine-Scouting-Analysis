import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function loadBrowserContext(relativePaths, extras = {}) {
  const context = {
    globalThis: {},
    console,
    Promise,
    Set,
    Map,
    Math,
    Number,
    Array,
    Object,
    String,
    JSON,
    ...extras,
  };
  context.globalThis = context;
  relativePaths.forEach((relativePath) => {
    const sourcePath = path.resolve(relativePath);
    const source = fs.readFileSync(sourcePath, "utf8");
    vm.runInNewContext(source, context, { filename: sourcePath });
  });
  return context;
}

function createMemoryStorage() {
  const store = new Map();
  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async set(key, value) {
      store.set(key, value);
      return value;
    },
    async delete(key) {
      store.delete(key);
      return true;
    },
  };
}

async function main() {
  await runTest("pickAttachmentFile persists the chosen handle and returns a display path", async () => {
    const storage = createMemoryStorage();
    const context = loadBrowserContext(["src/local-file-access.js"]);
    const handle = {
      name: "test-scouting.json",
      async getFile() {
        return { async text() { return "{\"ok\":true}"; } };
      },
    };

    const selected = await context.LocalFileAccess.pickAttachmentFile(
      { attachmentId: "attachment-1", format: "scouting-json" },
      { storage, showOpenFilePicker: async () => [handle] },
    );

    assert.equal(selected.path, "test-scouting.json");
    assert.equal(await storage.get("attachment-1"), handle);
  });

  await runTest("readAttachmentText reopens a stored handle and reads its text", async () => {
    const storage = createMemoryStorage();
    const context = loadBrowserContext(["src/local-file-access.js"]);
    await storage.set("attachment-2", {
      name: "test-scouting.csv",
      async queryPermission() {
        return "granted";
      },
      async getFile() {
        return {
          async text() {
            return "Match,Team\n1,686\n";
          },
        };
      },
    });

    const text = await context.LocalFileAccess.readAttachmentText("attachment-2", { storage });

    assert.equal(text, "Match,Team\n1,686\n");
  });

  await runTest("readAttachmentText reads an existing handle without prompting when getFile already works", async () => {
    const storage = createMemoryStorage();
    const context = loadBrowserContext(["src/local-file-access.js"]);
    let requestPermissionCalls = 0;
    await storage.set("attachment-works-without-prompt", {
      async queryPermission() {
        return "prompt";
      },
      async requestPermission() {
        requestPermissionCalls += 1;
        return "granted";
      },
      async getFile() {
        return {
          async text() {
            return "{\"ok\":true}";
          },
        };
      },
    });

    const text = await context.LocalFileAccess.readAttachmentText("attachment-works-without-prompt", { storage });

    assert.equal(text, "{\"ok\":true}");
    assert.equal(requestPermissionCalls, 0);
  });

  await runTest("readAttachmentText avoids requestPermission without user activation and surfaces a clean denial", async () => {
    const storage = createMemoryStorage();
    const context = loadBrowserContext(["src/local-file-access.js"]);
    let requestPermissionCalls = 0;
    await storage.set("attachment-needs-activation", {
      async queryPermission() {
        return "prompt";
      },
      async requestPermission() {
        requestPermissionCalls += 1;
        throw new Error("requestPermission should not be called without user activation");
      },
      async getFile() {
        const error = new Error("User activation is required to request permissions.");
        error.name = "NotAllowedError";
        throw error;
      },
    });

    await assert.rejects(
      () => context.LocalFileAccess.readAttachmentText("attachment-needs-activation", {
        storage,
        userActivation: { isActive: false },
      }),
      /Permission to read the local scouting file was denied/i,
    );
    assert.equal(requestPermissionCalls, 0);
  });

  await runTest("readAttachmentText surfaces a clear error when no stored handle exists", async () => {
    const storage = createMemoryStorage();
    const context = loadBrowserContext(["src/local-file-access.js"]);

    await assert.rejects(
      () => context.LocalFileAccess.readAttachmentText("missing-attachment", { storage }),
      /No saved local scouting file handle exists/i,
    );
  });

  await runTest("scouting submission storage persists and restores event data", async () => {
    const storage = createMemoryStorage();
    const context = loadBrowserContext(["src/local-file-access.js"]);
    const submissions = [{ id: "submission-1", eventKey: "2024mdsev", teamNumber: 1719, matchNumber: 1 }];

    const saved = await context.LocalFileAccess.writeScoutingSubmissions("2024mdsev", submissions, { storage });
    const restored = await context.LocalFileAccess.readScoutingSubmissions("2024mdsev", { storage });

    assert.equal(saved, true);
    assert.deepEqual(restored, submissions);
  });

  await runTest("clearing scouting submission storage removes saved event data", async () => {
    const storage = createMemoryStorage();
    const context = loadBrowserContext(["src/local-file-access.js"]);

    await context.LocalFileAccess.writeScoutingSubmissions("2024mdsev", [{ id: "submission-1" }], { storage });
    await context.LocalFileAccess.clearScoutingSubmissions("2024mdsev", { storage });

    assert.equal(await context.LocalFileAccess.readScoutingSubmissions("2024mdsev", { storage }), null);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
