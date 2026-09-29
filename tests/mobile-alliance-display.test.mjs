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
assert.equal(snapshot.board.length, 24);
assert.deepEqual(JSON.parse(JSON.stringify(snapshot.board[0])), { slot: 0, teamNumber: "686", teamName: "Bovine", alliance: 1 });
assert.equal(snapshot.eventName.includes("\u0000"), false);
assert.equal(snapshot.rankings[0].state, "confirmed");
assert.equal(snapshot.columns[0].teams[1].score, 87.123);
assert.equal("eventWorkspace" in snapshot, false);
assert.equal("submissions" in snapshot, false);
assert.equal(display.validateMobileAllianceSnapshot({ ...snapshot, privatePayload: { credentials: "x" } }), false);
assert.throws(() => display.buildMobileAllianceSnapshot({ eventKey: "not/valid" }), /event key/);

const rules = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const publicMatch = rules.match(/match \/publicAllianceSelection\/\{displayId\} \{([\s\S]*?)\n    \}/)?.[1] || "";
assert.match(publicMatch, /allow get: if displayId == 'current'/);
assert.match(publicMatch, /allow list: if false/);
assert.match(publicMatch, /allow create, update: if isAdmin\(\)/);
assert.match(publicMatch, /keys\(\)\.hasOnly\(\['version', 'eventKey', 'eventName', 'board', 'rankings', 'columns', 'publishedAt'\]\)/);
assert.match(publicMatch, /request\.resource\.data\.board\.size\(\) == 24/);
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
receiveSnapshot(display.buildMobileAllianceSnapshot({ eventKey: "2026chcmp", eventName: "Updated", board: [{ teamNumber: 9999 }] }));
assert.equal(selectors.get("#event-name").textContent, "Updated · 2026chcmp");
assert.match(selectors.get("#selection-board").children[0].children[1].children[0].textContent, /9999/);

console.log("PASS mobile alliance snapshot schema, public rules boundary, and live viewer rendering/update behavior");
