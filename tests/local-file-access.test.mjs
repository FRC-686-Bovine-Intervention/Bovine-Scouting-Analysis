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

  await runTest("readAttachmentText surfaces a clear error when no stored handle exists", async () => {
    const storage = createMemoryStorage();
    const context = loadBrowserContext(["src/local-file-access.js"]);

    await assert.rejects(
      () => context.LocalFileAccess.readAttachmentText("missing-attachment", { storage }),
      /No saved local scouting file handle exists/i,
    );
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
