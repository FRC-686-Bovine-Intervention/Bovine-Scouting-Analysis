import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/event-model-builder.js", import.meta.url), "utf8");
let pridgeCalls = 0;
const context = {
  ScoutingSchemaRuntime: { buildMetricCatalog: () => [] },
  PriorRidge: {
    computeEventPridge: () => {
      pridgeCalls += 1;
      return { ratings: { 1: 1, 2: 2 }, lambda: 0.1, matchCount: 1 };
    },
  },
  MetricEngine: {
    scalarResult: (value) => ({ kind: "scalar", value }),
    errorResult: (error) => ({ kind: "error", error }),
    evaluateFormulaExpression: (formula, { resolveIdentifier }) => resolveIdentifier(formula),
  },
  Array,
  Math,
  Map,
  Number,
  Object,
  Set,
  String,
  JSON,
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "src/event-model-builder.js" });

const matches = Array.from({ length: 80 }, (_, index) => ({
  comp_level: "qm",
  match_number: index + 1,
  alliances: {
    red: { team_keys: ["frc1", "frc3", "frc5"], score: index },
    blue: { team_keys: ["frc2", "frc4", "frc6"], score: index + 1 },
  },
}));
const bundle = {
  key: "2019chcmp",
  year: 2019,
  tbaEvent: { name: "Championship" },
  tbaTeams: [1, 2, 3, 4, 5, 6].map((team_number) => ({ team_number, nickname: `Team ${team_number}` })),
  tbaMatches: matches,
  statboticsTeamEvents: [1, 2, 3, 4, 5, 6].map((team) => ({ team })),
};

const deferred = context.EventModelBuilder.buildEventModelFromProviderBundle({ ...bundle, deferPridgeTrends: true });
assert.equal(pridgeCalls, 1, "Deferred cached event construction should compute totals without cumulative trends.");
assert.equal(deferred.teams[0].sources.pridge.trendEntries.length, 0);

pridgeCalls = 0;
const deferredComputation = context.EventModelBuilder.buildEventModelFromProviderBundle({ ...bundle, deferPridgeComputation: true });
assert.equal(pridgeCalls, 0, "Interactive event refreshes must not synchronously solve pRidge.");
assert.equal(deferredComputation.teams[0].sources.pridge.total, null);

const hydrationDeferredEvent = {
  pridgeComputationDeferred: true,
  matches: [{
    number: 1,
    red: [1, 3, 5],
    blue: [2, 4, 6],
    redScore: 100,
    blueScore: 90,
    scoreBreakdown: { red: { totalPoints: 100 }, blue: { totalPoints: 90 } },
  }],
  teams: [1, 2, 3, 4, 5, 6].map((number) => ({
    number,
    sources: { statbotics: { components: { "epa.stats.start": 1 } }, pridge: { components: {} } },
  })),
};
const hydratedWithDefinitions = context.EventModelBuilder.applyPridgeResponseDefinitions(hydrationDeferredEvent, [
  { id: "epa.total_points", label: "pRidge total", formula: "tba.totalPoints" },
], { force: true });
assert.equal(pridgeCalls, 2, "Applying schema definitions should hydrate deferred pRidge values.");
assert.equal(hydratedWithDefinitions.pridgeComputationDeferred, false);
assert.equal(hydratedWithDefinitions.teams[0].sources.pridge.total, 1);
assert.equal(hydratedWithDefinitions.teams[0].sources.pridge.components["epa.total_points"], 1);

pridgeCalls = 0;
const eager = context.EventModelBuilder.buildEventModelFromProviderBundle(bundle);
assert.equal(pridgeCalls, 81, "Eager event construction should retain the existing cumulative trend behavior.");
assert.equal(eager.teams[0].sources.pridge.trendEntries.length, 80);
console.log("PASS cached event construction can defer quadratic cumulative pRidge trends while retaining eager behavior");
