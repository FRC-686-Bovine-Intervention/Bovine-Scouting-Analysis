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
const appStyles = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
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
  ...Array.from({ length: 16 }, (_, index) => {
    const epa = [12.5, 40.25, 5, 20, 10, null, 6][index];
    return {
      id: `frc${5000 + index}`,
      number: 5000 + index,
      label: String(5000 + index),
      isSuffixed: false,
      sources: {
        tba: { components: { rank: 5 + index, "sort_orders.0": 0 } },
        statbotics: { components: epa === null ? {} : { "epa.total_points": epa } },
      },
    };
  }),
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
  normalizeColumnSortDirection: (direction) => direction === "asc" ? "asc" : "desc",
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
  sourceFunction("buildCurrentMobileAllianceSnapshot", "allianceEpaSummaryData"),
  sourceFunction("allianceEpaSummaryData", "renderAllianceEpaSummary"),
  sourceFunction("renderAllianceEpaSummary", "renderAlliance"),
  sourceFunction("colorForScore", "sortDirectionGlyph"),
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
assert.match(appBehaviorContext.renderAlliance(), /data-alliance-epa=""[^>]*EPA unavailable · 0 of 1 teams/);
board[3] = null;
board[1] = 1731;
board[0] = 1731;
board[1] = "frc449B";
assert.match(appBehaviorContext.renderAlliance(), /data-alliance-epa="50"/, "reordering selected teams keeps the same alliance EPA total and B-team identity");

board.fill(null);
board[0] = "frc449B";
board[1] = 1731;
board[2] = 5000;
board[3] = 5001;
board[4] = 5002;
board[5] = 5003;
board[6] = 449;
board[7] = 5004;
board[8] = 9072;
board[9] = 9072;
const coloredAlliances = appBehaviorContext.renderAlliance();
assert.match(coloredAlliances, /data-alliance-epa="50"[^>]*style="background: rgba\(239, 68, 68, 1\.000\)"/);
assert.match(coloredAlliances, /data-alliance-epa="65\.25"[^>]*style="background: rgba\(34, 197, 94, 1\.000\)"/);
assert.match(coloredAlliances, /data-alliance-epa="50\.25"[^>]*data-alliance-epa-complete="false"[^>]*style="background: transparent"/);
assert.match(coloredAlliances, /data-alliance-epa=""[^>]*EPA unavailable · 0 of 1 teams[^>]*style="background: transparent"/);

board.fill(null);
board[0] = 449;
const singleKnownAlliance = appBehaviorContext.renderAlliance();
assert.match(singleKnownAlliance, /data-alliance-epa="40\.25"[^>]*style="background: transparent"/);
board[3] = 5001;
const tiedKnownAlliances = appBehaviorContext.renderAlliance();
assert.match(tiedKnownAlliances, /data-alliance-epa="40\.25"[^>]*style="background: transparent"/);
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

// Exercise the Alliance Selection click seam with real rendered team and board markup.
const allianceClickHandlers = new Map();
const clickTargets = {
  "[data-board-cell]": [{ dataset: { boardCell: "0", boardTeam: "frc449B" }, addEventListener: (type, handler) => allianceClickHandlers.set(`board:${type}`, handler) }],
  "[data-alliance-team]": [{ dataset: { allianceTeam: "frc449B" }, addEventListener: (type, handler) => allianceClickHandlers.set(`source:${type}`, handler) }],
};
let savedAllianceClicks = 0;
let renderedAllianceClicks = 0;
const clickContext = {
  state: { allianceBoard: ["frc449B"], picklistCompareTeams: [null, null, null, null], pairwisePicklist: null },
  document: { querySelectorAll: (selector) => clickTargets[selector] || [] },
  currentTeams: () => teams,
  teamSelectionId: selectionId,
  teamByNumber: (value) => teams.find((team) => team.id === String(value) || team.label === String(value) || team.number === Number(value)),
  pickedTeams: () => ["frc449B"],
  activePicklist: () => ({ id: "first-pick" }),
  picklistTeamIndex: (values, value) => values.findIndex((candidate) => String(candidate) === String(value)),
  saveState: () => { savedAllianceClicks += 1; },
  render: () => { renderedAllianceClicks += 1; },
};
vm.createContext(clickContext);
vm.runInContext([
  sourceFunction("compareSlotIndexForTeam"),
  sourceFunction("togglePicklistCompareTeam"),
  sourceFunction("toggleAllianceComparison"),
  sourceFunction("bindAllianceComparisonClicks"),
  "bindAllianceComparisonClicks();",
].join("\n"), clickContext);
const teamMarkupContext = {
  compareTeamPalette: display.compareTeamPalette,
  teamByNumber: clickContext.teamByNumber,
  teamSelectionId: selectionId,
  teamDisplayLabel: (team) => team.label,
  colorForScore: () => "transparent",
  escapeAttribute: (value) => String(value),
  compareSlotIndexForTeam: () => 0,
};
const pickedSourceContext = {
  ...teamMarkupContext,
  ...clickContext,
  state: { ...clickContext.state, picklistCompareTeams: ["frc449B", null, null, null] },
};
vm.createContext(pickedSourceContext);
vm.runInContext([sourceFunction("renderTeamTile"), sourceFunction("renderPicklistTile")].join("\n") + "\nglobalThis.sourceMarkup = renderPicklistTile('frc449B', 0, null, { allianceTeam: true, compareIndex: 0, captainKind: 'confirmed' });", pickedSourceContext);
assert.match(pickedSourceContext.sourceMarkup, /picked/);
assert.doesNotMatch(pickedSourceContext.sourceMarkup, /captain-confirmed/, "picked gray styling takes precedence over captain styling");
assert.match(pickedSourceContext.sourceMarkup, /compare-selected/);
assert.doesNotMatch(pickedSourceContext.sourceMarkup, /disabled/);
assert.match(pickedSourceContext.sourceMarkup, /data-alliance-team="frc449B"/);
assert.match(pickedSourceContext.sourceMarkup, /--compare-accent: #2563eb/);
const cssRule = (selector) => {
  const selectorStart = appStyles.indexOf(`${selector} {`);
  assert.notEqual(selectorStart, -1, `styles should define ${selector}`);
  const ruleEnd = appStyles.indexOf("\n}", selectorStart);
  assert.ok(ruleEnd > selectorStart, `styles should complete ${selector}`);
  return appStyles.slice(selectorStart, ruleEnd);
};
assert.match(cssRule(".picklist-tile.compare-selected"), /background:\s*color-mix\(in srgb, var\(--compare-accent\) 72%, black\) !important/);
assert.match(cssRule(".picklist-tile.picked.compare-selected"), /background:\s*linear-gradient\(rgba\(128, 128, 128, 0\.58\), rgba\(128, 128, 128, 0\.58\)\),\s*color-mix\(in srgb, var\(--compare-accent\) 72%, black\) !important/);
assert.match(cssRule(".picklist-tile.picked.compare-selected"), /opacity:\s*1/);
assert.match(cssRule(".picklist-tile.picked.compare-selected"), /color:\s*#ffffff/);
assert.match(cssRule(".picklist-tile.picked"), /background:\s*#808080 !important/);
assert.match(cssRule(".picked"), /opacity:\s*0\.5/);
assert.match(cssRule(".picked"), /text-decoration-line:\s*line-through/);
const relativeLuminance = ([red, green, blue]) => [red, green, blue]
  .map((channel) => channel / 255)
  .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
for (const accent of display.compareTeamPalette) {
  const accentRgb = accent.slice(1).match(/.{2}/g).map((channel) => parseInt(channel, 16) * 0.72);
  const grayOverlayResult = accentRgb.map((channel) => 128 * 0.58 + channel * 0.42);
  const whiteContrast = 1.05 / (relativeLuminance(grayOverlayResult) + 0.05);
  assert.ok(whiteContrast >= 4.5, `picked comparison text remains readable over ${accent}`);
}
assert.match(cssRule(".picklist-tile.captain-confirmed.compare-selected"), /background:\s*#b8e6c5 !important/);
assert.match(cssRule(".picklist-tile.captain-possible.compare-selected"), /background:\s*#ffe0a3 !important/);
assert.match(appStyles, /\.picklist-tile\.picked\.compare-selected\.captain-confirmed,\s*\.picklist-tile\.picked\.compare-selected\.captain-possible\s*\{\s*background:\s*linear-gradient\(rgba\(128, 128, 128, 0\.58\), rgba\(128, 128, 128, 0\.58\)\)/s);
allianceClickHandlers.get("source:click")();
assert.deepEqual(Array.from(clickContext.state.picklistCompareTeams), ["frc449B", null, null, null]);
assert.equal(savedAllianceClicks, 1);
const boardMarkupContext = { ...teamMarkupContext, ...clickContext, state: clickContext.state };
vm.createContext(boardMarkupContext);
vm.runInContext(sourceFunction("renderBoardCell") + "\nglobalThis.markup = renderBoardCell('frc449B', 0);", boardMarkupContext);
assert.match(boardMarkupContext.markup, /class="board-cell occupied compare-selected"/);
assert.match(boardMarkupContext.markup, /data-board-team="frc449B"/);
assert.match(boardMarkupContext.markup, /role="button"/);
assert.match(boardMarkupContext.markup, /aria-pressed="true"/);
assert.doesNotMatch(boardMarkupContext.markup, /picked/);
assert.match(boardMarkupContext.markup, /--compare-accent:/);
assert.match(cssRule(".board-cell.occupied.compare-selected"), /background:\s*color-mix\(in srgb, var\(--compare-accent\) 72%, black\) !important/);
assert.match(cssRule(".board-cell.occupied.compare-selected"), /color:\s*#ffffff/);
allianceClickHandlers.get("board:click")();
assert.deepEqual(Array.from(clickContext.state.picklistCompareTeams), [null, null, null, null]);
assert.equal(savedAllianceClicks, 2);
assert.equal(renderedAllianceClicks, 2);
allianceClickHandlers.get("board:click")();
assert.deepEqual(Array.from(clickContext.state.picklistCompareTeams), ["frc449B", null, null, null], "an unhighlighted board team can be added to comparison");
clickTargets["[data-alliance-team]"][0].dataset.allianceTeam = "frc449B";
allianceClickHandlers.get("source:click")();
assert.deepEqual(Array.from(clickContext.state.picklistCompareTeams), [null, null, null, null], "a highlighted B-team can be removed from Displayed Sources");
assert.equal(savedAllianceClicks, 4);
assert.equal(renderedAllianceClicks, 4);
clickContext.state.picklistCompareTeams = [1731, 449, 9072, "frc449B"];
clickTargets["[data-alliance-team]"][0].dataset.allianceTeam = "5000";
allianceClickHandlers.get("source:click")();
assert.deepEqual(Array.from(clickContext.state.picklistCompareTeams), [1731, 449, 9072, "frc449B"], "a fifth comparison team must not replace any of the four selected teams");
assert.equal(savedAllianceClicks, 4, "a rejected fifth selection does not save or rerender");

console.log("PASS Team Rank follows current TBA order, drives captain calculation, and stays aligned with mobile IDs/order");
