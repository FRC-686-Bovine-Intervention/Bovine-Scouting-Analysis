import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/frc-season-metadata.js", import.meta.url), "utf8");
const context = { globalThis: { btoa: (value) => `encoded:${value}` } };
vm.createContext(context);
vm.runInContext(source, context);

const { createFrcSeasonMetadataApi, toDisplaySeasonLabel } = context.globalThis.FrcSeasonMetadata;

async function runTest(name, callback) {
  try {
    await callback();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function createApi({ configuration = {}, metadata = {}, response, rejectRequest = false } = {}) {
  const calls = [];
  const firestore = {
    doc: (...path) => ({ path }),
    getDoc: async (reference) => {
      const value = reference.path[1] === "appState" ? configuration : metadata[reference.path[2]];
      return { exists: () => value !== undefined, data: () => value };
    },
    setDoc: async (...args) => calls.push(["setDoc", ...args]),
    serverTimestamp: () => "server-timestamp",
  };
  const fetch = async (...args) => {
    calls.push(["fetch", ...args]);
    if (rejectRequest) throw new Error("offline");
    return response;
  };
  return { api: createFrcSeasonMetadataApi({ db: {}, firestore, fetch }), calls };
}

await runTest("normalizes official game titles for display", () => {
  assert.equal(toDisplaySeasonLabel("FIRST AGE"), "First Age");
  assert.equal(toDisplaySeasonLabel("  REBUILT  "), "Rebuilt");
  assert.equal(toDisplaySeasonLabel(""), "");
});

await runTest("keeps FIRST credentials in the admin configuration document", async () => {
  const { api, calls } = createApi({ configuration: { frcApiUsername: " saved-user ", frcApiAuthorizationKey: " saved-key " } });
  assert.deepEqual(JSON.parse(JSON.stringify(await api.loadCredentials())), { username: "saved-user", authorizationKey: "saved-key" });
  await api.saveCredentials({ username: " next-user ", authorizationKey: " next-key " });
  assert.deepEqual(calls[0][1].path.slice(1), ["appState", "configuration"]);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][2])), {
    frcApiUsername: "next-user",
    frcApiAuthorizationKey: "next-key",
    updatedAt: "server-timestamp",
  });
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][3])), { merge: true });
});

await runTest("refreshes and caches the official game title without persisting credentials", async () => {
  const { api, calls } = createApi({ response: { ok: true, json: async () => ({ gameName: "REBUILT" }) } });
  const metadata = await api.refreshSeasonMetadata(2026, { username: "api-user", authorizationKey: "api-key" });
  assert.deepEqual(JSON.parse(JSON.stringify(metadata)), {
    season: 2026,
    gameName: "REBUILT",
    source: "first-events-api",
  });
  assert.equal(calls[0][1], "https://frc-api.firstinspires.org/v3.0/2026");
  assert.equal(calls[0][2].headers.Authorization, "Basic encoded:api-user:api-key");
  assert.deepEqual(calls[1][1].path.slice(1), ["seasonMetadata", "2026"]);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1][2])), {
    season: 2026,
    gameName: "REBUILT",
    source: "first-events-api",
    fetchedAt: "server-timestamp",
  });
});

await runTest("reads the shared non-secret season label and reports provider failures", async () => {
  const { api } = createApi({ metadata: { "2025": { season: 2025, gameName: "REEFSCAPE", source: "first-events-api" } } });
  assert.deepEqual(JSON.parse(JSON.stringify(await api.loadSeasonMetadata(2025))), {
    season: 2025,
    gameName: "REEFSCAPE",
    source: "first-events-api",
    fetchedAt: "",
  });
  const { api: failedApi } = createApi({ response: { ok: false, status: 401 } });
  await assert.rejects(() => failedApi.refreshSeasonMetadata(2026, { username: "user", authorizationKey: "key" }), /401/);
});
