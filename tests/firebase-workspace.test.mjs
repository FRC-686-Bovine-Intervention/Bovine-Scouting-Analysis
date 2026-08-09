import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/firebase-workspace.js", import.meta.url), "utf8")
  .replace(/^import .*?;\r?\n/gm, "");
const calls = [];
const documents = new Map();
const context = {
  globalThis: { firebaseServices: { db: {} } },
  doc: (...path) => ({ path }),
  getDoc: async (reference) => ({
    id: reference.path.at(-1),
    exists: () => documents.has(reference.path.join("/")),
    data: () => documents.get(reference.path.join("/")),
  }),
  setDoc: async (reference, data) => {
    calls.push(["setDoc", reference.path, data]);
    documents.set(reference.path.join("/"), data);
  },
  serverTimestamp: () => "server-timestamp",
};
vm.createContext(context);
vm.runInContext(source, context);
const api = context.globalThis.firebaseWorkspaceApi;

await api.saveEventWorkspaceState("2026CHCMP", {
  eventWorkspace: { eventKey: "2026chcmp", sources: { scouting: [{ attachmentId: "link" }] } },
  picklists: [{ id: "main", teams: [686] }],
  sortEquations: [{ id: "sort-main", terms: [] }],
  activePicklist: "main",
  activeSortEquation: "sort-main",
});
const loaded = await api.loadEventWorkspaceState("2026chcmp");
assert.equal(calls.length, 1);
assert.equal(calls[0][1].slice(-3).join("/"), "2026chcmp/workspace/state");
assert.deepEqual(Object.keys(calls[0][2]).sort(), ["eventKey", "eventWorkspace", "picklists", "updatedAt", "version"]);
assert.equal("sortEquations" in calls[0][2], false);
assert.equal("activeSortEquation" in calls[0][2], false);
assert.equal(loaded.eventKey, "2026chcmp");
assert.equal(loaded.eventWorkspace.sources.scouting[0].attachmentId, "link");
await assert.rejects(() => api.loadEventWorkspaceState(""), /event key/);
console.log("PASS loads and persists event workspace state in the scoped Firestore document");
