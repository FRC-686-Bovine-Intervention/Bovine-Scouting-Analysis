import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const loadModel = (path) => {
  const context = { globalThis: {} };
  vm.runInNewContext(fs.readFileSync(new URL(path, import.meta.url), "utf8"), context);
  return context.globalThis.teamRankModel;
};

const model = loadModel("../src/team-rank-model.js");
const appSource = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const captainState = (() => {
  const context = { globalThis: {} };
  vm.runInNewContext(fs.readFileSync(new URL("../src/alliance-captain-state.js", import.meta.url), "utf8"), context);
  return context.globalThis.allianceCaptainState;
})();
const display = (() => {
  const context = { globalThis: {} };
  vm.runInNewContext(fs.readFileSync(new URL("../src/mobile-alliance-display.js", import.meta.url), "utf8"), context);
  return context.globalThis.mobileAllianceDisplay;
})();

const teams = [
  { id: "frc449", number: 449, label: "449", isSuffixed: false, sources: { tba: { components: { rank: 3, "sort_orders.0": 10 } }, statbotics: { components: { "epa.total_points": 40.25 } } } },
  { id: "frc1731", number: 1731, label: "1731", isSuffixed: false, sources: { tba: { components: { rank: 1, "sort_orders.0": 8 } }, statbotics: { components: { "epa.total_points": 30.5 } } } },
  { id: "frc9072", number: 9072, label: "9072", isSuffixed: false, sources: { tba: { components: { rank: 2, "sort_orders.0": 5 } }, statbotics: { components: {} } } },
  { id: "frc449B", number: 449, label: "449B", isSuffixed: true, sources: { tba: { components: { rank: 4, "sort_orders.0": 1 } }, statbotics: { components: { "epa.total_points": 7 } } } },
  ...Array.from({ length: 16 }, (_, index) => ({
    id: `frc${5000 + index}`,
    number: 5000 + index,
    label: String(5000 + index),
    isSuffixed: false,
    sources: { tba: { components: { rank: 5 + index, "sort_orders.0": 0 } }, statbotics: { components: index === 0 ? { "epa.total_points": 12.5 } : {} } },
  })),
];
const manualFirstPickOrder = ["frc449", "frc9072", "frc1731", "frc449B"];
const rankForTeam = (team) => team.sources?.tba?.components?.rank ?? null;
const sortForTeam = (team) => team.sources?.tba?.components?.["sort_orders.0"] ?? null;
const currentTbaRankedTeams = appSource.match(/function currentTbaRankedTeams\(\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(currentTbaRankedTeams, "Alliance Selection must share its Team Rank ordering seam");
const appContext = {
  teamRankModel: model,
  currentTeams: () => teams,
  rankingRankForTeam: rankForTeam,
  rankingSortValueForTeam: sortForTeam,
};
vm.createContext(appContext);
vm.runInContext(`${currentTbaRankedTeams}\nglobalThis.rankedTeams = currentTbaRankedTeams();`, appContext);
const rankedTeams = Array.from(appContext.rankedTeams);
const selectionId = (team) => team.isSuffixed ? team.id : team.number;
const rankedIds = rankedTeams.map((team) => team.id);
const board = Array(24).fill(null);
board[0] = "frc449B";

assert.deepEqual(
  rankedIds.slice(0, 4),
  ["frc1731", "frc9072", "frc449", "frc449B"],
  "Team Rank must follow current TBA rank/sort-order data even when saved First Pick order conflicts",
);
assert.notDeepEqual(rankedIds, manualFirstPickOrder, "regression fixture must distinguish TBA order from First Pick order");
assert.deepEqual(Array.from(captainState.deriveAllianceCaptainStateForBoard(rankedTeams.map(selectionId), board, { placedTeamIds: ["frc449B"] }).confirmed.slice(0, 4)), [1731, 9072, 449, 5000]);

const snapshot = display.buildMobileAllianceSnapshot({
  eventKey: "2022chcmp",
  rankings: rankedTeams.map((team, index) => ({
    teamNumber: team.isSuffixed ? team.label : team.number,
    state: index === 0 ? "confirmed" : "normal",
  })),
  columns: [{
    id: "picklist:first-pick",
    label: "First Pick",
    teams: manualFirstPickOrder.map((id) => {
      const team = teams.find((item) => item.id === id);
      return { teamNumber: team.isSuffixed ? team.label : team.number, state: "normal" };
    }),
  }],
});
assert.equal(display.validateMobileAllianceSnapshot(snapshot), true);
assert.deepEqual(snapshot.rankings.slice(0, 4).map((team) => team.teamNumber), ["1731", "9072", "449", "449B"]);
assert.deepEqual(snapshot.columns[0].teams.map((team) => team.teamNumber), ["449", "9072", "1731", "449B"]);
assert.equal(snapshot.rankings.find((team) => team.teamNumber === "449B").teamNumber, "449B", "suffixed team identity must remain visible in Team Rank snapshots");
assert.equal(snapshot.rankings[0].state, "confirmed");
assert.ok(snapshot.columns.every((column) => column.teams.every((team) => team.state === "normal")), "supplementary mobile picklists must not inherit captain styling");

const sourceFunction = (name, nextName) => {
  const start = appSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `app should define ${name}`);
  const end = nextName
    ? appSource.indexOf(`\n}\n\nfunction ${nextName}(`, start) + 2
    : appSource.indexOf("\n}", start) + 2;
  assert.ok(end > start, `app should expose a complete ${name} function`);
  return appSource.slice(start, end);
};
const renderedTiles = [];
const manualTeams = manualFirstPickOrder.map((id) => teams.find((team) => team.id === id));
const appBehaviorContext = {
  teamRankModel: model,
  allianceCaptainState: captainState,
  mobileAllianceDisplay: display,
  state: {
    activeEventKey: "2022chcmp",
    allianceBoard: board,
    loadedSources: ["picklist:pick-first-pick"],
    picklistCompareTeams: [1731, "frc449B", null, null],
    picklists: [{ id: "pick-first-pick", name: "First Pick", teams: manualFirstPickOrder }],
    pairwisePicklist: { picklistId: "other-picklist", session: {} },
  },
  currentTeams: () => teams,
  rankingRankForTeam: rankForTeam,
  rankingSortValueForTeam: sortForTeam,
  teamSelectionId: selectionId,
  activePicklist: () => ({ id: "pick-first-pick" }),
  picklistTeamIndex: (values, value) => values.findIndex((candidate) => String(candidate) === String(value)),
  teamByNumber: (value) => teams.find((team) => team.id === String(value) || team.label === String(value) || team.number === Number(value)),
  pickedTeams: () => board.filter((team) => team !== null),
  loadedSourceSortDirection: () => "desc",
  gridColumnModel: () => ({ type: "picklist", label: "First Pick", teams: manualTeams, scores: [], minScore: 0, maxScore: 0 }),
  metricTokenLabel: () => "Metric",
  metricById: () => null,
  displayEventName: () => "2022 Chesapeake",
  currentEvent: () => ({ key: "2022chcmp" }),
  renderBoardCell: () => "",
  statboticsEpaMetric: () => ({ kind: "source", sourceId: "statbotics", componentId: "epa.total_points", unit: "pts" }),
  teamMetricValue: (team) => team.sources.statbotics.components["epa.total_points"],
  formatMetricValueForDisplay: (_metric, value) => Number(value).toFixed(1),
  escapeAttribute: (value) => String(value),
  escapeHtml: (value) => String(value),
  renderBoardContextMenu: () => "",
  renderContextMenu: () => "",
  orderedRankableMetrics: () => [],
  renderPicklistTile: (id, _index, _picklist, options) => {
    renderedTiles.push({ id, captainKind: options.captainKind || "" });
    return `<span data-team-tile="${id}" data-captain-kind="${options.captainKind || ""}"></span>`;
  },
  sortDirectionGlyph: () => "",
  defaultColumnSortDirection: "desc",
};
vm.createContext(appBehaviorContext);
vm.runInContext([
  sourceFunction("currentTbaRankedTeams"),
  sourceFunction("compareSlotIndexForTeam"),
  sourceFunction("buildCurrentMobileAllianceSnapshot", "renderAllianceEpaSummary"),
  sourceFunction("renderAllianceEpaSummary", "renderAlliance"),
  sourceFunction("renderAlliance"),
  "globalThis.renderedAlliance = renderAlliance();",
  "globalThis.mobileSnapshot = buildCurrentMobileAllianceSnapshot();",
].join("\n"), appBehaviorContext);

const renderedAlliance = appBehaviorContext.renderedAlliance;
const initialRenderedTiles = [...renderedTiles];
assert.ok(renderedAlliance.indexOf("data-team-rank-column") < renderedAlliance.indexOf('data-loaded-source="picklist:pick-first-pick"'), "Team Rank must render left of the selectable First Pick column");
assert.match(renderedAlliance, /<div class="alliance-epa-heading">Alliance EPA<\/div>/);
assert.match(renderedAlliance, /class="alliance-epa-summary"[^>]*data-alliance-epa="7"/);
assert.match(renderedAlliance, /<strong>7\.0<\/strong><small>1 team<\/small>/);
board[1] = 1731;
board[2] = 9072;
const completedAlliance = appBehaviorContext.renderAlliance();
assert.match(completedAlliance, /data-alliance-epa="37\.5"/);
assert.match(completedAlliance, /Partial · 2 of 3 team EPA values/);
board[1] = null;
assert.match(appBehaviorContext.renderAlliance(), /data-alliance-epa="7"/);
board[1] = 1731;
board[2] = 5000;
assert.match(appBehaviorContext.renderAlliance(), /data-alliance-epa="50"/);
assert.match(appBehaviorContext.renderAlliance(), /<strong>50\.0<\/strong><small>3 teams<\/small>/);
board[3] = 9072;
assert.match(appBehaviorContext.renderAlliance(), /data-alliance-epa="" aria-label="Alliance EPA —, EPA unavailable · 0 of 1 teams"/);
board[3] = null;
board[1] = 1731;
board[0] = 1731;
board[1] = "frc449B";
assert.match(appBehaviorContext.renderAlliance(), /data-alliance-epa="50"/, "reordering selected teams keeps the same alliance EPA total and B-team identity");
assert.match(renderedAlliance, /<h3 >Team Rank/);
assert.doesNotMatch(renderedAlliance, /value="team-rank"/, "Team Rank is not a selectable source");
const finalRankTiles = initialRenderedTiles.slice(0, rankedTeams.length);
const supplementaryTiles = initialRenderedTiles.slice(rankedTeams.length);
assert.deepEqual(finalRankTiles.map((tile) => tile.id), rankedTeams.map(selectionId));
assert.ok(finalRankTiles.some((tile) => tile.captainKind === "confirmed"));
assert.ok(finalRankTiles.some((tile) => tile.captainKind === "possible"));
assert.ok(supplementaryTiles.every((tile) => tile.captainKind === ""), "supplementary desktop picklists must not inherit captain styling");
assert.deepEqual(Array.from(appBehaviorContext.mobileSnapshot.rankings.slice(0, 4), (team) => team.teamNumber), ["1731", "9072", "449", "449B"]);
assert.equal(appBehaviorContext.mobileSnapshot.rankings.find((team) => team.teamNumber === "449B").state, "picked", "placed B-team remains picked/gray in mobile Team Rank");
assert.deepEqual(Array.from(appBehaviorContext.mobileSnapshot.columns[0].teams, (team) => team.teamNumber), ["449", "9072", "1731", "449B"]);
assert.equal(appBehaviorContext.mobileSnapshot.columns[0].teams.find((team) => team.teamNumber === "449B").state, "picked", "placed B-team remains picked/gray in supplementary mobile columns");
assert.equal(appBehaviorContext.mobileSnapshot.rankings[0].comparisonSlot, 0, "first admin comparison team carries its palette slot into mobile Team Rank");
assert.equal(appBehaviorContext.mobileSnapshot.rankings[3].teamNumber, "449B", "comparison selection preserves the B-team identity");
assert.equal(appBehaviorContext.mobileSnapshot.rankings[3].comparisonSlot, 1, "B-team comparison retains its admin palette slot");
assert.equal(Object.hasOwn(appBehaviorContext.mobileSnapshot.rankings[1], "comparisonSlot"), false, "unused admin comparison slots do not color unselected teams");
assert.equal(appBehaviorContext.mobileSnapshot.columns[0].teams[2].comparisonSlot, 0, "supplementary list uses the same comparison color as Team Rank");
assert.equal(appBehaviorContext.mobileSnapshot.columns[0].teams[3].comparisonSlot, 1, "supplementary list preserves the selected B-team color");
assert.equal(display.validateMobileAllianceSnapshot(appBehaviorContext.mobileSnapshot), true);

console.log("PASS Team Rank follows current TBA order, drives captain calculation, and stays aligned with mobile IDs/order");
