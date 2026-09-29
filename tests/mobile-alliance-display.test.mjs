import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const displaySource = fs.readFileSync(new URL("../src/mobile-alliance-display.js", import.meta.url), "utf8");
const displayContext = { globalThis: {} };
vm.runInNewContext(displaySource, displayContext);
const display = displayContext.globalThis.mobileAllianceDisplay;

const snapshot = display.buildMobileAllianceSnapshot({
  eventKey: "2026chcmp",
  eventName: "Championship <script>",
  board: [{ teamNumber: 686, teamName: "Bovine" }],
  rankings: [{ teamNumber: 686, state: "confirmed" }, { teamNumber: 1719, state: "picked" }],
  columns: [{ id: "picklist:main", label: "Final Rankings", teams: [{ teamNumber: 686, state: "confirmed" }, { teamNumber: 1719, score: 87.12345 }] }],
});
assert.equal(display.validateMobileAllianceSnapshot(snapshot), true);
assert.equal(display.normalizeTeamNumber({ number: 2106, label: "2106 · The Junkyard Dogs" }), "2106");
assert.equal(snapshot.board.length, 24);
assert.deepEqual(JSON.parse(JSON.stringify(snapshot.board[0])), { slot: 0, teamNumber: "686", teamName: "Bovine", alliance: 1 });
assert.equal(snapshot.eventName.includes("\u0000"), false);
assert.equal(snapshot.rankings[0].state, "confirmed");
assert.equal(snapshot.columns[0].teams[1].score, 87.123);
const teamObjectColumn = display.buildMobileAllianceSnapshot({
  eventKey: "2026vaale1",
  columns: [{ id: "picklist:first", label: "First Pick", teams: [{ number: 2106, label: "2106 · The Junkyard Dogs" }] }],
});
assert.equal(teamObjectColumn.columns[0].teams[0].teamNumber, "2106");
assert.equal("eventWorkspace" in snapshot, false);
assert.equal("submissions" in snapshot, false);
assert.equal(display.validateMobileAllianceSnapshot({ ...snapshot, privatePayload: { credentials: "x" } }), false);
assert.throws(() => display.buildMobileAllianceSnapshot({ eventKey: "not/valid" }), /event key/);

const firebaseDisplaySource = fs.readFileSync(new URL("../src/firebase-mobile-display.js", import.meta.url), "utf8")
  .replace(/^import .*?;\r?\n/gm, "");
let writtenDocument;
let snapshotListener;
const firebaseContext = {
  globalThis: { firebaseServices: { db: {} }, firebaseUserRole: "admin", mobileAllianceDisplay: display, dispatchEvent: () => {} },
  doc: () => ({ path: "publicAllianceSelection/current" }),
  onSnapshot: (_reference, listener) => { snapshotListener = listener; return () => {}; },
  serverTimestamp: () => "server-timestamp",
  setDoc: async (_reference, value) => { writtenDocument = value; },
  Event,
  setTimeout,
  clearTimeout,
  TextEncoder,
  console,
};
firebaseContext.globalThis.globalThis = firebaseContext.globalThis;
vm.createContext(firebaseContext);
vm.runInContext(firebaseDisplaySource, firebaseContext);
assert.equal(firebaseContext.globalThis.firebaseMobileDisplayApi.publishMobileAllianceSnapshot(snapshot), true);
await new Promise((resolve) => setTimeout(resolve, 400));
assert.deepEqual(Object.keys(writtenDocument).sort(), ["eventKey", "payload", "publishedAt", "version"]);
assert.deepEqual(JSON.parse(writtenDocument.payload), JSON.parse(JSON.stringify(snapshot)));
let deliveredSnapshot;
firebaseContext.globalThis.firebaseMobileDisplayApi.subscribeMobileAllianceSnapshot((value) => { deliveredSnapshot = value; });
snapshotListener({ exists: () => true, data: () => writtenDocument });
assert.deepEqual(JSON.parse(JSON.stringify(deliveredSnapshot)), JSON.parse(JSON.stringify(snapshot)));
snapshotListener({ exists: () => true, data: () => ({ ...writtenDocument, eventKey: "other-event" }) });
assert.equal(deliveredSnapshot, null);

const rules = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const publicMatch = rules.match(/match \/publicAllianceSelection\/\{displayId\} \{([\s\S]*?)\n    \}/)?.[1] || "";
assert.match(publicMatch, /allow get: if displayId == 'current'/);
assert.match(publicMatch, /allow list: if false/);
assert.match(publicMatch, /allow create, update: if isAdmin\(\)/);
assert.match(publicMatch, /keys\(\)\.hasOnly\(\['version', 'eventKey', 'payload', 'publishedAt'\]\)/);
assert.match(publicMatch, /request\.resource\.data\.payload is string/);
assert.match(publicMatch, /request\.resource\.data\.payload\.size\(\) <= 400000/);
assert.match(publicMatch, /allow delete: if false/);
assert.match(rules, /match \/events\/\{eventId\}\/submissions\/\{submissionId\}[\s\S]*?allow read: if isAllowed\(\)/);
assert.match(rules, /match \/events\/\{eventId\}\/workspace\/\{workspaceId\}[\s\S]*?allow read: if isAllowed\(\)/);

class FakeNode {
  constructor(dataset = {}) { this.dataset = dataset; this.children = []; this.listeners = {}; this.attributes = {}; this.hidden = false; this.textContent = ""; this.className = ""; }
  replaceChildren(...children) { this.children = children; }
  append(...children) { this.children.push(...children); }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  setAttribute(name, value) { this.attributes[name] = value; }
}
const selectors = new Map([
  ["#selection-board", new FakeNode()], ["#final-rankings", new FakeNode()], ["#mobile-picklists", new FakeNode()],
  ["#empty-state", new FakeNode()], ["#event-name", new FakeNode()], ["#connection-state", new FakeNode()],
  ["#board-view", new FakeNode()], ["#picklists-view", new FakeNode()],
]);
const tabs = [new FakeNode({ mobileTab: "board" }), new FakeNode({ mobileTab: "picklists" })];
let receiveSnapshot;
const mobileContext = {
  console,
  document: { querySelector: (selector) => selectors.get(selector), querySelectorAll: (selector) => selector === "[data-mobile-tab]" ? tabs : [] , createElement: () => new FakeNode() },
  mobileAllianceDisplay: display,
  firebaseMobileDisplayApi: { subscribeMobileAllianceSnapshot: (callback) => { receiveSnapshot = callback; } },
  addEventListener: () => {},
};
mobileContext.globalThis = mobileContext;
vm.runInNewContext(fs.readFileSync(new URL("../src/mobile-alliance-viewer.js", import.meta.url), "utf8"), mobileContext);
receiveSnapshot(snapshot);
assert.equal(selectors.get("#connection-state").textContent, "Live");
assert.equal(selectors.get("#event-name").textContent, "Championship <script> · 2026chcmp");
assert.equal(selectors.get("#selection-board").children.length, 8);
assert.equal(selectors.get("#final-rankings").children[0].className, "ranking-row state-confirmed");
assert.equal(selectors.get("#mobile-picklists").children.length, 1);
receiveSnapshot(teamObjectColumn);
assert.equal(selectors.get("#mobile-picklists").children[0].children[1].children[0].children[1].textContent, "Team 2106");
receiveSnapshot(display.buildMobileAllianceSnapshot({ eventKey: "2026chcmp", eventName: "Updated", board: [{ teamNumber: 9999 }] }));
assert.equal(selectors.get("#event-name").textContent, "Updated · 2026chcmp");
assert.match(selectors.get("#selection-board").children[0].children[1].children[0].textContent, /9999/);

console.log("PASS mobile alliance schema, bounded public document, admin publishing, and live viewer rendering/update behavior");
