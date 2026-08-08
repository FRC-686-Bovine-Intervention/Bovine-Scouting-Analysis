import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/tba-auth-key-configuration.js", import.meta.url), "utf8");
const context = { globalThis: {} };
vm.createContext(context);
vm.runInContext(source, context);

const { createTbaAuthKeyConfigurationApi } = context.globalThis.TbaAuthKeyConfiguration;

async function runTest(name, callback) {
  try {
    await callback();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function createApi({ exists = true, data = { tbaAuthKey: " stored-key " }, response, rejectRequest = false } = {}) {
  const calls = [];
  const firestore = {
    doc: (...path) => ({ path }),
    getDoc: async () => ({ exists: () => exists, data: () => data }),
    setDoc: async (...args) => calls.push(args),
    serverTimestamp: () => "server-timestamp",
  };
  const fetch = async (...args) => {
    calls.push(["fetch", ...args]);
    if (rejectRequest) throw new Error("offline");
    return response;
  };
  return { api: createTbaAuthKeyConfigurationApi({ db: {}, firestore, fetch }), calls };
}

await runTest("reads the TBA key only from appState/configuration", async () => {
  const { api } = createApi();
  assert.equal(await api.loadTbaAuthKey(), "stored-key");
  const { api: missingApi } = createApi({ exists: false });
  assert.equal(await missingApi.loadTbaAuthKey(), "");
});

await runTest("updates the configuration document without returning the key in status data", async () => {
  const { api, calls } = createApi();
  assert.equal(await api.saveTbaAuthKey(" next-key "), "next-key");
  assert.deepEqual(calls[0][0].path.slice(1), ["appState", "configuration"]);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][1])), { tbaAuthKey: "next-key", updatedAt: "server-timestamp" });
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][2])), { merge: true });
});

await runTest("validates configured TBA keys without exposing their value", async () => {
  const { api, calls } = createApi({ response: { ok: true } });
  assert.deepEqual(JSON.parse(JSON.stringify(await api.validateTbaAuthKey("valid-key"))), { configured: true, valid: true, status: "valid" });
  assert.equal(calls[0][0], "fetch");
  assert.equal(calls[0][2].headers["X-TBA-Auth-Key"], "valid-key");
  assert.deepEqual(JSON.parse(JSON.stringify(await api.validateTbaAuthKey(""))), { configured: false, valid: false, status: "missing" });
  const { api: invalidApi } = createApi({ response: { ok: false } });
  assert.deepEqual(JSON.parse(JSON.stringify(await invalidApi.validateTbaAuthKey("invalid-key"))), { configured: true, valid: false, status: "invalid" });
  const { api: offlineApi } = createApi({ rejectRequest: true });
  assert.deepEqual(JSON.parse(JSON.stringify(await offlineApi.validateTbaAuthKey("configured-key"))), { configured: true, valid: null, status: "unverified" });
});
