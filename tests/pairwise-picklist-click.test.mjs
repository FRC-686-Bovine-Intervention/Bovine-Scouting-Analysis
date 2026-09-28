import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync("src/pairwise-picklist.js", "utf8"), context, { filename: "src/pairwise-picklist.js" });
const PairwisePicklist = context.PairwisePicklist;

function comparing(teams, activeTeam, direction = -1) {
  const selected = PairwisePicklist.choose(PairwisePicklist.create(teams), activeTeam);
  return PairwisePicklist.move(PairwisePicklist.begin(selected), direction);
}

const compareAbove = comparing([1, 2, 3, 4], 3);
assert.equal(compareAbove.comparedTeam, 1);
const chooseCompared = PairwisePicklist.chooseComparisonWinner(compareAbove, 1);
assert.equal(chooseCompared.mode, "select", "Choosing either compared tile resolves pairwise mode.");
assert.deepEqual(Array.from(chooseCompared.teams), [1, 3, 2, 4], "The clicked compared team remains above the active team.");
assert.equal(chooseCompared.teams[chooseCompared.cursorIndex], 1, "The clicked winner becomes the selected team.");

const chooseActive = PairwisePicklist.chooseComparisonWinner(compareAbove, 3);
assert.deepEqual(Array.from(chooseActive.teams), [3, 1, 2, 4], "Clicking the active team places it above the compared team.");
assert.equal(chooseActive.teams[chooseActive.cursorIndex], 3, "The active winner becomes the selected team.");

const suffixed = comparing([10988, "frc10988B", 2345], "frc10988B");
assert.equal(suffixed.comparedTeam, 10988);
const chooseSuffixed = PairwisePicklist.chooseComparisonWinner(suffixed, "frc10988B");
assert.deepEqual(Array.from(chooseSuffixed.teams), ["frc10988B", 10988, 2345], "A suffixed team identity remains distinct from its base team.");
assert.equal(chooseSuffixed.teams[chooseSuffixed.cursorIndex], "frc10988B");
const chooseBase = PairwisePicklist.chooseComparisonWinner(suffixed, 10988);
assert.deepEqual(Array.from(chooseBase.teams), [10988, "frc10988B", 2345], "The base team can be selected as the opposite winner.");
assert.equal(chooseBase.teams[chooseBase.cursorIndex], 10988);

console.log("PASS pairwise click choices resolve and preserve base/suffixed team identities");
