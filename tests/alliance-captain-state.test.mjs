import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = { globalThis: {} };
vm.runInNewContext(fs.readFileSync("src/alliance-captain-state.js", "utf8"), context);
const derive = context.globalThis.allianceCaptainState.deriveAllianceCaptainState;
const deriveForBoard = context.globalThis.allianceCaptainState.deriveAllianceCaptainStateForBoard;
const rankings = Array.from({ length: 24 }, (_, index) => String(100 + index));

const initial = derive(rankings);
assert.deepEqual(Array.from(initial.confirmed), rankings.slice(0, 8));
assert.deepEqual(Array.from(initial.possible), rankings.slice(8, 16));

const promoted = derive(rankings, { acceptedTeamIds: ["100"] });
assert.deepEqual(Array.from(promoted.confirmed), rankings.slice(1, 9));
assert.deepEqual(Array.from(promoted.possible), rankings.slice(9, 17));

const oneFirstPickComplete = derive(rankings, { completedFirstRoundPicks: 1 });
assert.deepEqual(Array.from(oneFirstPickComplete.possible), rankings.slice(8, 15));

const allFirstPicksComplete = derive(rankings, { completedFirstRoundPicks: 8 });
assert.deepEqual(Array.from(allFirstPicksComplete.possible), []);

const board = Array(24).fill(null);
board[1] = "201";
board[5] = "202";
board[23] = "203";
assert.equal(context.globalThis.allianceCaptainState.completedFirstRoundPickCount(board), 1);

const captainBoard = (...placed) => {
  const value = Array(24).fill(null);
  for (const [index, teamId] of placed) value[index] = teamId;
  return value;
};
const rankIds = Array.from({ length: 12 }, (_, index) => `rank${index + 1}`);
const oneCaptainPlaced = deriveForBoard(rankIds, captainBoard([0, "rank1"]), { placedTeamIds: ["rank1"] });
assert.deepEqual(Array.from(oneCaptainPlaced.confirmed), rankIds.slice(1, 8));
assert.deepEqual(Array.from(oneCaptainPlaced.possible), rankIds.slice(8));
const captainAndFirstPickPlaced = deriveForBoard(rankIds, captainBoard([0, "rank1"], [1, "rank2"]), { placedTeamIds: ["rank1", "rank2"] });
assert.deepEqual(Array.from(captainAndFirstPickPlaced.confirmed), rankIds.slice(2, 9));
assert.deepEqual(Array.from(captainAndFirstPickPlaced.possible), rankIds.slice(9));
const twoCaptainsAndFirstPickPlaced = deriveForBoard(rankIds, captainBoard([0, "rank1"], [1, "rank2"], [3, "rank3"]), { placedTeamIds: ["rank1", "rank2", "rank3"] });
assert.deepEqual(Array.from(twoCaptainsAndFirstPickPlaced.confirmed), rankIds.slice(3, 9));
assert.equal(context.globalThis.allianceCaptainState.emptyCaptainSlotCount(captainBoard([0, "rank1"], [1, "rank2"], [3, "rank3"])), 6);
const fullCaptainBoard = Array(24).fill("occupied");
assert.equal(context.globalThis.allianceCaptainState.emptyCaptainSlotCount(fullCaptainBoard), 0);
assert.deepEqual(Array.from(deriveForBoard(rankIds, fullCaptainBoard).confirmed), []);

const placedPossible = derive(rankings, { placedTeamIds: ["108"] });
assert.equal(Array.from(placedPossible.confirmed).includes("108"), false);
assert.equal(Array.from(placedPossible.possible).includes("108"), false);

const appSource = fs.readFileSync("src/app.js", "utf8");
const stylesSource = fs.readFileSync("src/styles.css", "utf8");
const indexSource = fs.readFileSync("index.html", "utf8");
const helperScript = indexSource.match(/<script defer src="([^"]*alliance-captain-state\.js[^"]*)"><\/script>/)?.[1] || "";
const appScript = indexSource.match(/<script defer src="([^"]*app\.js\?revision=[^"]*)"><\/script>/)?.[1] || "";
const helperRevision = new URL(helperScript, "https://test.invalid").searchParams.get("revision") || "";
const appRevision = new URL(appScript, "https://test.invalid").searchParams.get("revision") || "";
assert.ok(helperRevision.startsWith("__DEPLOYMENT_REVISION__"), "alliance captain helper URL must change when the app deployment revision changes");
assert.ok(appRevision.startsWith(helperRevision), "alliance captain helper and app must share the same deployment revision prefix");
assert.ok(indexSource.indexOf(helperScript) < indexSource.indexOf(appScript), "alliance captain helper must load before the app script");
assert.match(appSource, /const picked = isPicked \? "picked" : captainKind/);
assert.match(appSource, /captainKind: firstRankedPicklist === entry/);
assert.match(appSource, /deriveAllianceCaptainStateForBoard\(/);
assert.equal((appSource.match(/deriveAllianceCaptainStateForBoard\(/g) || []).length, 2);
assert.match(appSource, /options\.title \? `title=/);
assert.match(stylesSource, /\.picklist-tile\.picked\s*\{[\s\S]*?background:\s*#808080 !important/);

console.log("PASS alliance captain rankings, promotion, first-pick progression, and placed-team highlight precedence");
