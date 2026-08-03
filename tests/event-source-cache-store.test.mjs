import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const cacheSource = fs.readFileSync(new URL("../src/event-source-cache.js", import.meta.url), "utf8");
const storeSource = fs.readFileSync(new URL("../src/event-source-cache-store.js", import.meta.url), "utf8");
const context = { globalThis: {}, TextEncoder };
vm.createContext(context); vm.runInContext(cacheSource, context); vm.runInContext(storeSource, context);
const { createEventSourceCacheStore } = context.globalThis.EventSourceCacheStore;

const calls = [];
const firestore = {
  doc: (...path) => ({ path }), collection: (...path) => ({ path }),
  setDoc: async (...args) => calls.push(["setDoc", ...args]), serverTimestamp: () => "server-timestamp",
  writeBatch: () => ({ set: (...args) => calls.push(["chunk", ...args]), commit: async () => calls.push(["commit"]) }),
};
const store = createEventSourceCacheStore({ db: {}, firestore });
await store.saveEventSourceCache({ event: { key: "2027Test", season: 2027, name: "Test", seasonLabel: "Future" }, workspace: { eventKey: "2027test", sources: {} }, artifacts: [{ sourceId: "tba-event", rawText: "{\"year\":2027}", sourceUrl: "https://example.test/event", contentType: "application/json", status: 200, fetchedAt: "2027-01-01T00:00:00.000Z" }] });
assert.deepEqual(calls[0][1].path.slice(1), ["events", "2027test"]);
assert.equal(calls[0][2].tbaAuthKey, undefined);
assert.equal(JSON.stringify(calls[0][2].workspace).includes("https://"), false);
assert.deepEqual(calls[1][1].path.slice(-2), ["versions", "fnv1a-da644783-13"]);
assert.equal(calls[2][0], "chunk");
assert.equal(calls.at(-2)[0], "commit");
assert.equal(calls.at(-1)[0], "setDoc");
console.log("PASS saves a small shared event record and separate raw source chunks");

const artifact = context.globalThis.EventSourceCache.createRawSourceArtifact({
  sourceId: "tba-event", rawText: "{\"year\":2027}", sourceUrl: "https://example.test/event", contentType: "application/json", status: 200, fetchedAt: "2027-01-01T00:00:00.000Z",
});
const reader = createEventSourceCacheStore({
  db: {},
  firestore: {
    doc: (...path) => ({ path }), collection: (...path) => ({ path }), setDoc: async () => {}, writeBatch: () => {}, serverTimestamp: () => "server-timestamp",
    getDoc: async (reference) => {
      const joined = reference.path.join("/");
      if (joined.endsWith("sourceCache/tba-event")) return { exists: () => true, data: () => ({ activeVersion: "fnv1a-da644783-13" }) };
      return { exists: () => true, data: () => artifact.manifest };
    },
    getDocs: async () => ({ docs: artifact.chunks.map((chunk) => ({ data: () => chunk })) }),
  },
});
const loaded = await reader.loadEventSourceCache({ eventKey: "2027TEST", sourceId: "tba-event" });
assert.equal(loaded.rawText, "{\"year\":2027}");
await assert.rejects(
  () => reader.loadEventSourceCache({ eventKey: "", sourceId: "tba-event" }),
  /event key and source id/,
);
console.log("PASS rebuilds the active Firestore source artifact and rejects unavailable identifiers");
