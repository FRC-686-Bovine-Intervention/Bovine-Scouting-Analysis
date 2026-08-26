import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/event-model-builder.js", import.meta.url), "utf8");
let pridgeCalls = 0;
let trendCalls = 0;
const context = {
  ScoutingSchemaRuntime: { buildMetricCatalog: () => [] },
  PriorRidge: {
    computeEventPridge: () => {
      pridgeCalls += 1;
      return { ratings: { 1: 1, 2: 2 }, lambda: 0.1, matchCount: 1 };
    },
    computeEventPridgeTrend: (_matches, _teamEvents) => {
      trendCalls += 1;
      return {
        entriesByTeam: new Map([
          [1, Array.from({ length: 80 }, (_, index) => ({ key: index + 1, value: 1 }))],
          [2, Array.from({ length: 80 }, (_, index) => ({ key: index + 1, value: 2 }))],
        ]),
        profiling: {
          scheduleQualificationCount: 80,
          completedQualificationCount: 80,
          trendFitCount: 0,
          trendCacheHits: 0,
          trendCacheMisses: 0,
        },
      };
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
  Date,
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
  statboticsTeamMatches: [
    { team: 1, match: "2019chcmp_qm1", epa: { total_points: 8.5 } },
    { team: 1, match: "2019chcmp_qm3", epa: { total_points: 10.25 } },
  ],
};

const playoffBundle = {
  ...bundle,
  tbaAlliances: [
    { number: 2, picks: ["frc2", "frc4", "frc6"], status: { playoff_status: "eliminated", record: { losses: 2 } } },
    { number: 1, picks: ["frc1", "frc3", "frc5", "frc999"], status: { playoff_status: "active" } },
  ],
  tbaMatches: [
    ...bundle.tbaMatches,
    {
      comp_level: "qf",
      set_number: 1,
      match_number: 1,
      key: "2019chcmp_qf1m1",
      alliances: {
        red: { team_keys: ["frc1", "frc3", "frc5"], score: 120 },
        blue: { team_keys: ["frc2", "frc4", "frc6"], score: 110 },
      },
    },
    {
      comp_level: "sf",
      set_number: 1,
      match_number: 1,
      key: "2019chcmp_sf1m1",
      alliances: {
        red: { team_keys: ["frc1", "frc3", "frc5"], score: 130 },
        blue: { team_keys: ["frc2", "frc4", "frc6"], score: 125 },
      },
    },
  ],
};

const playoffEvent = context.EventModelBuilder.buildEventModelFromProviderBundle({ ...playoffBundle, deferPridgeComputation: true });
assert.equal(playoffEvent.matches.length, 82);
assert.deepEqual(playoffEvent.matches.slice(-2).map((match) => ({ id: match.id, compLevel: match.compLevel, setNumber: match.setNumber, number: match.number })), [
  { id: "2019chcmp_qf1m1", compLevel: "qf", setNumber: 1, number: 1 },
  { id: "2019chcmp_sf1m1", compLevel: "sf", setNumber: 1, number: 1 },
]);
assert.equal(playoffEvent.matches.at(-2).hasScore, true);
assert.deepEqual(JSON.parse(JSON.stringify(playoffEvent.playoffAlliances)), [
  { number: 1, name: "Alliance 1", picks: [1, 3, 5, 999], backup: null, status: { playoff_status: "active" } },
  { number: 2, name: "Alliance 2", picks: [2, 4, 6], backup: null, status: { playoff_status: "eliminated", record: { losses: 2 } } },
]);
console.log("PASS event model includes playoff matches with stable identities");

const deferred = context.EventModelBuilder.buildEventModelFromProviderBundle({ ...bundle, deferPridgeTrends: true });
assert.equal(pridgeCalls, 1, "Deferred cached event construction should compute totals without cumulative trends.");
assert.equal(deferred.teams[0].sources.pridge.trendEntries.length, 0);
assert.deepEqual(JSON.parse(JSON.stringify(deferred.teams[0].sources.statbotics.trendEntries)), [
  { key: 1, value: 8.5 },
  { key: 3, value: 10.25 },
]);
assert.equal(deferred.teams[0].sources.statbotics.components["epa.post"], 10.25);

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
const readyWithDefinitions = context.EventModelBuilder.applyPridgeResponseDefinitions({
  ...hydrationDeferredEvent,
  pridgeComputationDeferred: false,
}, [
  { id: "epa.total_points", label: "pRidge total", formula: "tba.totalPoints" },
]);
assert.equal(pridgeCalls, 1, "Applying schema definitions to a ready event should compute response values.");
assert.equal(readyWithDefinitions.teams[0].sources.pridge.components["epa.total_points"], 1);

pridgeCalls = 0;
trendCalls = 0;
const eager = context.EventModelBuilder.buildEventModelFromProviderBundle(bundle);
assert.equal(pridgeCalls, 1, "Eager event construction should compute the event total once.");
assert.equal(trendCalls, 1, "Eager event construction should delegate trend calculation once.");
assert.equal(eager.teams[0].sources.pridge.trendEntries.length, 80);
assert.equal(eager.profiling.trendFitCount, 0);
console.log("PASS cached event construction delegates incremental pRidge trends");
