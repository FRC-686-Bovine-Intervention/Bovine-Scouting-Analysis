import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const displaySource = fs.readFileSync(new URL("../src/mobile-alliance-display.js", import.meta.url), "utf8");
const displayContext = { globalThis: {} };
vm.runInNewContext(displaySource, displayContext);
const display = displayContext.globalThis.mobileAllianceDisplay;
const scoreColorContext = { globalThis: {} };
vm.runInNewContext(fs.readFileSync(new URL("../src/score-color.js", import.meta.url), "utf8"), scoreColorContext);

const snapshot = display.buildMobileAllianceSnapshot({
  eventKey: "2026chcmp",
  eventName: "Championship <script>",
  board: [{ teamNumber: 686, teamName: "Bovine" }],
  rankings: [{ teamNumber: 686, state: "confirmed" }, { teamNumber: 1719, state: "picked" }],
  columns: [{ id: "picklist:main", label: "Supplementary Picklist", teams: [{ teamNumber: 686, state: "normal" }, { teamNumber: 1719, score: 87.12345 }] }],
});
assert.equal(display.validateMobileAllianceSnapshot(snapshot), true);
assert.equal(display.normalizeTeamNumber({ number: 2106, label: "2106 · The Junkyard Dogs" }), "2106");
assert.equal(snapshot.board.length, 24);
assert.deepEqual(JSON.parse(JSON.stringify(snapshot.board[0])), { slot: 0, teamNumber: "686", teamName: "Bovine", alliance: 1 });
assert.equal(snapshot.eventName.includes("\u0000"), false);
assert.equal(snapshot.rankings[0].state, "confirmed");
assert.equal(snapshot.columns[0].label, "Supplementary Picklist");
assert.equal(snapshot.columns[0].teams[0].state, "normal", "supplementary mobile picklists do not carry captain styling");
assert.equal(Object.hasOwn(snapshot.columns[0].teams[0], "score"), false, "picklist rows without a metric score do not receive a fabricated zero");
assert.equal(snapshot.columns[0].teams[1].score, 87.123);
const comparisonSnapshot = display.buildMobileAllianceSnapshot({
  eventKey: "2026vaale1",
  rankings: [
    { teamNumber: "1731", state: "confirmed", comparisonSlot: 0 },
    { teamNumber: "449B", state: "picked", comparisonSlot: 1 },
    { teamNumber: "9072", comparisonSlot: 2 },
    { teamNumber: "449", comparisonSlot: 3 },
    { teamNumber: "686" },
  ],
  columns: [{ id: "picklist:first", label: "First Pick", teams: [
    { teamNumber: "1731", comparisonSlot: 0 },
    { teamNumber: "449B", comparisonSlot: 1 },
    { teamNumber: "9072", comparisonSlot: 2 },
    { teamNumber: "449", comparisonSlot: 3 },
  ] }],
});
assert.equal(display.validateMobileAllianceSnapshot(comparisonSnapshot), true);
assert.deepEqual(comparisonSnapshot.rankings.slice(0, 4).map((team) => team.comparisonSlot), [0, 1, 2, 3]);
assert.equal(comparisonSnapshot.rankings[1].teamNumber, "449B", "comparison snapshot keeps suffixed team identity");
assert.equal(Object.hasOwn(comparisonSnapshot.rankings[4], "comparisonSlot"), false, "unselected team has no comparison highlight slot");
assert.equal(display.compareColorForSlot(0), "#2563eb");
assert.equal(display.compareColorForSlot(1), "#ca8a04");
assert.equal(display.compareColorForSlot(2), "#7c3aed");
assert.equal(display.compareColorForSlot(3), "#0891b2");
assert.equal(display.compareColorForSlot(4), null);
assert.equal(display.allianceSizeForEvent({ eventType: 2 }), 3, "district championships keep three slots per alliance");
assert.equal(display.allianceSizeForEvent({ eventType: 3 }), 4, "championship division events use four slots per alliance");
assert.equal(display.allianceSizeForEvent({ eventType: 4 }), 4, "championship finals events use four slots per alliance");
assert.equal(display.allianceSizeForEvent({}), 3, "unknown event semantics preserve the normal three-slot default");
const worldSnapshot = display.buildMobileAllianceSnapshot({
  eventKey: "2024cmptx",
  allianceSize: 4,
  allianceEpa: [0, 15.25, null, undefined, 2, null, null, null],
  allianceEpaRange: { min: 0, max: 15.25 },
  board: Array.from({ length: 32 }, (_, index) => index < 4
    ? { teamNumber: [686, 449, 1719, "449B"][index], comparisonSlot: index }
    : null),
  rankings: [{ teamNumber: 686, state: "picked", comparisonSlot: 0 }],
  columns: Array.from({ length: 4 }, (_, index) => ({
    id: `picklist:${index}`,
    label: `List ${index + 1}`,
    teams: [{ teamNumber: 686, state: "picked", comparisonSlot: index, score: 50 - index }],
  })),
});
assert.equal(worldSnapshot.board.length, 32, "World Championship snapshots contain four slots for all eight alliances");
assert.deepEqual(worldSnapshot.board.slice(0, 8).map((slot) => slot.alliance), [1, 1, 1, 1, 2, 2, 2, 2]);
assert.equal(worldSnapshot.board[0].comparisonSlot, 0);
assert.deepEqual(Array.from(worldSnapshot.allianceEpa), [0, 15.25, null, null, 2, null, null, null], "mobile alliance EPA keeps finite totals including zero and uses null for unavailable totals");
assert.equal(worldSnapshot.allianceEpaRange?.min, 0, "mobile publishes the minimum known alliance EPA for score coloring");
assert.equal(worldSnapshot.allianceEpaRange?.max, 15.25, "mobile publishes the maximum known alliance EPA for score coloring");
assert.equal(display.validateMobileAllianceSnapshot(worldSnapshot), true);
assert.equal(display.validateMobileAllianceSnapshot({ ...worldSnapshot, board: worldSnapshot.board.slice(0, 31) }), false);
assert.equal(display.validateMobileAllianceSnapshot({ ...worldSnapshot, allianceEpa: [0] }), false, "public snapshots require exactly one EPA value per alliance when the field is present");
assert.equal(display.validateMobileAllianceSnapshot({ ...comparisonSnapshot, rankings: comparisonSnapshot.rankings.map((team, index) => index === 0 ? { ...team, comparisonSlot: 4 } : team) }), false);
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
assert.equal(firebaseContext.globalThis.firebaseMobileDisplayApi.publishMobileAllianceSnapshot(worldSnapshot), true, "a changed current alliance snapshot supersedes its prior public contents");
await new Promise((resolve) => setTimeout(resolve, 400));
snapshotListener({ exists: () => true, data: () => writtenDocument });
assert.deepEqual(Array.from(deliveredSnapshot.allianceEpa), Array.from(worldSnapshot.allianceEpa), "fresh published EPA totals reach mobile subscribers");

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
  constructor(dataset = {}) { this.dataset = dataset; this.children = []; this.listeners = {}; this.attributes = {}; this.hidden = false; this.textContent = ""; this.className = ""; this.clientWidth = 342; }
  replaceChildren(...children) { this.children = children; }
  append(...children) { this.children.push(...children); }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  setAttribute(name, value) { this.attributes[name] = value; }
}
const selectors = new Map([
  ["#selection-board", new FakeNode()], ["#final-rankings", new FakeNode()], ["#mobile-picklists", new FakeNode()],
  ["#mobile-picklists-hint", new FakeNode()], ["#empty-state", new FakeNode()],
  ["#board-view", new FakeNode()], ["#picklists-view", new FakeNode()],
]);
const tabs = [new FakeNode({ mobileTab: "board" }), new FakeNode({ mobileTab: "picklists" })];
let receiveSnapshot;
const windowListeners = {};
const mobileContext = {
  console,
  document: { querySelector: (selector) => selectors.get(selector), querySelectorAll: (selector) => selector === "[data-mobile-tab]" ? tabs : [] , createElement: () => new FakeNode() },
  mobileAllianceDisplay: display,
  ScoreColor: scoreColorContext.globalThis.ScoreColor,
  firebaseMobileDisplayApi: { subscribeMobileAllianceSnapshot: (callback) => { receiveSnapshot = callback; } },
  addEventListener: (name, callback) => { windowListeners[name] = callback; },
};
mobileContext.globalThis = mobileContext;
vm.runInNewContext(fs.readFileSync(new URL("../src/mobile-alliance-viewer.js", import.meta.url), "utf8"), mobileContext);
receiveSnapshot(null);
assert.equal(selectors.get("#empty-state").hidden, false, "the simplified viewer shows its waiting state when no valid public snapshot exists");
assert.equal(selectors.get("#selection-board").children.length, 0, "an unavailable snapshot clears stale alliance rows without touching removed header elements");
receiveSnapshot(snapshot);
assert.equal(selectors.get("#selection-board").children.length, 8);
assert.equal(selectors.get("#final-rankings").children[0].className, "ranking-row state-confirmed");
assert.equal(selectors.get("#mobile-picklists").children.length, 1);
assert.equal(selectors.get("#mobile-picklists").dataset.columnCount, "1");
assert.equal(selectors.get("#mobile-picklists-hint").hidden, true, "a single source does not show a horizontal-swipe hint");
receiveSnapshot(comparisonSnapshot);
const renderedComparisonRows = selectors.get("#final-rankings").children;
assert.equal(renderedComparisonRows[0].className, "ranking-row state-confirmed compare-selected");
assert.equal(renderedComparisonRows[0].attributes.style, "--compare-accent: #2563eb");
assert.equal(renderedComparisonRows[1].className, "ranking-row state-picked compare-selected");
assert.equal(renderedComparisonRows[1].attributes.style, "--compare-accent: #ca8a04");
assert.equal(renderedComparisonRows[4].className, "ranking-row state-normal", "unselected teams have no comparison styling when fewer than four slots are filled");
const renderedComparisonColumnRows = selectors.get("#mobile-picklists").children[0].children[1].children;
assert.equal(renderedComparisonColumnRows[2].attributes.style, "--compare-accent: #7c3aed");
assert.equal(renderedComparisonColumnRows[3].attributes.style, "--compare-accent: #0891b2");
receiveSnapshot(teamObjectColumn);
assert.equal(selectors.get("#mobile-picklists").children[0].children[1].children[0].children[0].textContent, "2106");
receiveSnapshot(worldSnapshot);
assert.equal(selectors.get("#selection-board").children.length, 8);
assert.equal(selectors.get("#selection-board").children[0].children[0].textContent, "A1");
assert.equal(selectors.get("#selection-board").children[0].children[1].children.length, 4);
assert.equal(selectors.get("#selection-board").children[0].children[1].children[0].textContent, "686");
assert.deepEqual(Array.from(selectors.get("#selection-board").children[0].children[1].children, (slot) => slot.className), [
  "board-slot occupied state-picked compare-selected",
  "board-slot occupied state-picked compare-selected",
  "board-slot occupied state-picked compare-selected",
  "board-slot occupied state-picked compare-selected",
], "all four highlighted board teams carry picked state for compositional gray treatment");
assert.deepEqual(Array.from(selectors.get("#selection-board").children[0].children[1].children, (slot) => slot.attributes.style), [
  "--compare-accent: #2563eb", "--compare-accent: #ca8a04", "--compare-accent: #7c3aed", "--compare-accent: #0891b2",
], "all four comparison colors reach board slots");
assert.equal(selectors.get("#selection-board").children[0].children[1].children[0].attributes.style, "--compare-accent: #2563eb");
assert.equal(selectors.get("#selection-board").children[0].children[2].textContent, "EPA=0.0", "the mobile board formats a usable EPA total as a separate one-decimal cell");
assert.equal(selectors.get("#selection-board").children[0].children[2].attributes.style, "--metric-fill: rgba(239, 68, 68, 1.000)", "lowest mobile alliance EPA uses the desktop red score fill");
assert.equal(selectors.get("#selection-board").children[1].children[2].textContent, "EPA=15.3");
assert.equal(selectors.get("#selection-board").children[1].children[2].attributes.style, "--metric-fill: rgba(34, 197, 94, 1.000)", "highest mobile alliance EPA uses the desktop green score fill");
assert.equal(selectors.get("#selection-board").children[2].children[2].textContent, "---", "unavailable alliance EPA uses the compact placeholder without explanation prose");
const midpointEpaSnapshot = display.buildMobileAllianceSnapshot({
  eventKey: "2026chcmp",
  allianceEpa: [0, 15, 30, null, null, null, null, null],
  allianceEpaRange: { min: 0, max: 30 },
});
receiveSnapshot(midpointEpaSnapshot);
assert.equal(selectors.get("#selection-board").children[0].children[2].attributes.style, "--metric-fill: rgba(239, 68, 68, 1.000)", "low EPA cells receive the red score color directly");
assert.equal(selectors.get("#selection-board").children[1].children[2].attributes.style, undefined, "midpoint EPA cells keep the alternating alliance tint");
assert.equal(selectors.get("#selection-board").children[2].children[2].attributes.style, "--metric-fill: rgba(34, 197, 94, 1.000)", "high EPA cells receive the green score color directly");
receiveSnapshot(worldSnapshot);
assert.equal(selectors.get("#mobile-picklists").children.length, 4, "the Picklists page renders four simultaneous source columns");
assert.equal(selectors.get("#mobile-picklists").children[0].children[0].textContent, "List 1");
assert.equal(selectors.get("#mobile-picklists").children[0].children[1].children[0].children.length, 2, "mobile Picklists show a team number and score without a rank ordinal");
const scoreSnapshot = display.buildMobileAllianceSnapshot({
  eventKey: "2026chcmp",
  columns: [{ id: "metric:test", label: "Metric", teams: [
    { teamNumber: 13, score: 0 },
    { teamNumber: 1599, score: 100 },
  ] }],
});
receiveSnapshot(scoreSnapshot);
const renderedScoreRows = selectors.get("#mobile-picklists").children[0].children[1].children;
assert.equal(renderedScoreRows[0].children[0].textContent, "13", "metric rows display a number-only team field");
assert.equal(renderedScoreRows[0].children[1].textContent, "0.0", "metric score remains a separate field");
assert.equal(renderedScoreRows[0].attributes.style, "--metric-fill: rgba(239, 68, 68, 1.000)", "low metric values use the desktop red score fill on the complete row");
assert.equal(renderedScoreRows[1].attributes.style, "--metric-fill: rgba(34, 197, 94, 1.000)", "high metric values use the desktop green score fill on the complete row");
const balancedRankSnapshot = display.buildMobileAllianceSnapshot({
  eventKey: "2026vagle2",
  rankings: Array.from({ length: 31 }, (_, index) => ({ teamNumber: String(index + 1) })),
});
receiveSnapshot(balancedRankSnapshot);
assert.equal(selectors.get("#final-rankings").attributes.style, "--mobile-ranking-row-count: 11", "31 ranked teams use 11 rows across the 3 visible mobile columns at 342px");
selectors.get("#final-rankings").clientWidth = 525;
windowListeners.resize();
assert.equal(selectors.get("#final-rankings").attributes.style, "--mobile-ranking-row-count: 7", "resizing to 5 visible columns recalculates a balanced 7-row rank layout");
receiveSnapshot(worldSnapshot);
const mobileStyles = fs.readFileSync(new URL("../src/mobile-alliance.css", import.meta.url), "utf8");
assert.match(mobileStyles, /\.alliance-slots\s*\{[^}]*repeat\(var\(--alliance-slot-count,\s*3\)/s, "alliance rows honor the event-specific three/four slot count");
assert.match(mobileStyles, /\.alliance-row\s*\{[^}]*grid-template-columns:\s*85px\s+minmax\(0,\s*1fr\)\s+70px/s, "alliance rows reserve a separate EPA cell beside the team slots");
assert.match(mobileStyles, /@media \(max-width: 699px\)[\s\S]*?\.alliance-row\s*\{[^}]*grid-template-columns:\s*27px\s+minmax\(0,\s*1fr\)\s+49px/s, "mobile alliance EPA cells stay compact while all eight rows fit");
assert.match(mobileStyles, /#final-rankings\s*\{[^}]*grid-template-rows:\s*repeat\(var\(--mobile-ranking-row-count,\s*12\),\s*minmax\(25px,\s*auto\)\)/s, "mobile Team Rank rows follow the calculated team count and visible column count");
assert.match(mobileStyles, /@media \(max-width: 699px\)[\s\S]*?\.mobile-picklists\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s, "four Picklists cards fit side by side on mobile");
assert.match(mobileStyles, /\.mobile-picklists\[data-column-count="1"\]\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s, "a single mobile Picklist uses the available width");
assert.match(mobileStyles, /@media \(max-width: 699px\)[\s\S]*?\.mobile-picklists\s*\{[^}]*overflow:\s*visible/s, "the document scrolls all Picklists together rather than independent cards");
assert.match(mobileStyles, /@media \(max-width: 699px\)[\s\S]*?\.alliance-row:nth-child\(odd\) \.board-slot\s*\{[^}]*background:\s*#[0-9a-f]{6}/i, "odd mobile alliances retain their red row tint, including open slots");
assert.match(mobileStyles, /@media \(max-width: 699px\)[\s\S]*?\.alliance-row:nth-child\(even\) \.board-slot\s*\{[^}]*background:\s*#[0-9a-f]{6}/i, "even mobile alliances retain their blue row tint, including open slots");
assert.match(mobileStyles, /\.mobile-picklists \.ranking-row:not\(\.compare-selected\)\s*\{[^}]*background:\s*var\(--metric-fill/s, "Picklists apply metric color to the complete row");
assert.match(mobileStyles, /\.mobile-picklists \.ranking-row\.state-picked:not\(\.compare-selected\)\s*\{[^}]*background:\s*#808080;\s*color:\s*#000;\s*opacity:\s*\.5;\s*text-decoration-line:\s*line-through/s, "picked Picklists match the scouting app's gray, dimmed, struck-through selected teams");
assert.match(mobileStyles, /\.mobile-picklists \.ranking-row\.state-picked\.compare-selected\s*\{[^}]*opacity:\s*1;\s*text-decoration-line:\s*line-through/s, "picked comparison teams stay fully visible while retaining the gray comparison overlay");
assert.match(mobileStyles, /\.alliance-row \.board-slot\.occupied\.state-picked\.compare-selected\s*\{[^}]*linear-gradient\(rgba\(85, 93, 99,/s, "picked comparison board slots retain the translucent gray overlay above alternating row tints");
assert.match(mobileStyles, /\.alliance-row \.alliance-epa\[style\]\s*\{[^}]*background:\s*var\(--metric-fill\)/s, "colored EPA cells use the published red/green score color directly");
assert.doesNotMatch(mobileStyles, /\.alliance-row \.alliance-epa\[style\]\s*\{[^}]*linear-gradient/s, "EPA score fills are not blended over the alternating alliance tint");
assert.match(mobileStyles, /\.ranking-row\.state-picked\.compare-selected\s*\{[^}]*linear-gradient\(rgba\(85, 93, 99, \.52\)/s, "picked comparison teams retain the gray overlay over their highlight color");
assert.match(fs.readFileSync(new URL("../mobile.html", import.meta.url), "utf8"), /data-mobile-tab="board" aria-selected="true">Selection Board<\/button>/, "mobile page selector uses the production Selection Board label");
receiveSnapshot(display.buildMobileAllianceSnapshot({ eventKey: "2026chcmp", eventName: "Updated", board: [{ teamNumber: 9999 }] }));
assert.match(selectors.get("#selection-board").children[0].children[1].children[0].textContent, /9999/);
assert.equal(selectors.get("#mobile-picklists").className, "mobile-picklists is-empty");
assert.equal(selectors.get("#mobile-picklists").dataset.columnCount, "0");
assert.equal(selectors.get("#mobile-picklists-hint").hidden, true);
const mobileHtml = fs.readFileSync(new URL("../mobile.html", import.meta.url), "utf8");
assert.match(mobileHtml, /<h1>Alliance Selection<\/h1>/);
assert.doesNotMatch(mobileHtml, /Bovine|event-name|connection-state/);
const mobileBuildScript = fs.readFileSync(new URL("../scripts/build-mobile-site.mjs", import.meta.url), "utf8");
assert.match(mobileBuildScript, /\["src\/score-color\.js",\s*"src\/score-color\.js"\]/, "mobile Hosting copies the shared score-color runtime referenced by mobile.html");

console.log("PASS mobile alliance schema, bounded public document, admin publishing, and live viewer rendering/update behavior");
