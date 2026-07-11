import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

function loadMetricEngine() {
  const sourcePath = path.resolve("src/metric-engine.js");
  const source = fs.readFileSync(sourcePath, "utf8");
  const context = {
    globalThis: {},
    console,
    Set,
    Map,
    Math,
    Number,
    Array,
    Object,
    String,
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: sourcePath });
  return context.MetricEngine;
}

const metricEngine = loadMetricEngine();

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runTest("evaluateDerivedMetricDefinition supports sum, weighted sum, average, and rate formulas", () => {
  assert.equal(
    metricEngine.evaluateDerivedMetricDefinition(
      { formula: "sum", fields: ["auto", "cycle"] },
      { auto: 12, cycle: 28 },
    ),
    40,
  );

  assert.equal(
    metricEngine.evaluateDerivedMetricDefinition(
      { formula: "weighted_sum", weightedFields: [{ field: "speakerMade", weight: 5 }, { field: "ampMade", weight: 2 }] },
      { speakerMade: 3, ampMade: 4 },
    ),
    23,
  );

  assert.equal(
    metricEngine.evaluateDerivedMetricDefinition(
      { formula: "average", fields: ["driver", "defense"], unit: "rating" },
      { driver: 3, defense: 4 },
    ),
    3.5,
  );

  assert.equal(
    metricEngine.evaluateDerivedMetricDefinition(
      { formula: "rate", madeFields: ["made"], missFields: ["missed"] },
      { made: 8, missed: 2 },
    ),
    80,
  );

  assert.equal(
    metricEngine.evaluateDerivedMetricDefinition(
      { formula: "ratio", numeratorFields: ["driver"], denominatorMode: "match_count", unit: "rating" },
      {},
      { aggregatedMatches: [{ components: { driver: 2 } }, { components: { driver: 4 } }] },
    ),
    3,
  );
});

runTest("evaluateFormulaExpression supports nested averages with inline filters", () => {
  const result = metricEngine.evaluateFormulaExpression("average(tba.climbScore, scouting.climbAttempt > 0) + average(scouting.teleL3Made)", {
    recentEntryCount: 3,
    resolveIdentifier(identifier) {
      if (identifier === "tba.climbScore") {
        return metricEngine.seriesResult([
          { key: 1, value: 2 },
          { key: 2, value: 6 },
          { key: 3, value: 12 },
        ]);
      }
      if (identifier === "scouting.climbAttempt") {
        return metricEngine.seriesResult([
          { key: 1, value: 1 },
          { key: 2, value: 0 },
          { key: 3, value: 1 },
        ]);
      }
      if (identifier === "scouting.teleL3Made") {
        return metricEngine.seriesResult([
          { key: 1, value: 2 },
          { key: 2, value: 4 },
          { key: 3, value: 6 },
        ]);
      }
      return metricEngine.errorResult(`Unknown identifier ${identifier}`);
    },
  });

  assert.equal(result.granularity, "event");
  assert.equal(result.value, 11);
});

runTest("average can exclude zero-attempt matches with an inline filter", () => {
  const result = metricEngine.evaluateFormulaExpression("average(tba.climbScore, scouting.climbAttempt > 0)", {
    recentEntryCount: 3,
    resolveIdentifier(identifier) {
      if (identifier === "tba.climbScore") {
        return metricEngine.seriesResult([
          { key: 1, value: 12 },
          { key: 2, value: 12 },
          { key: 3, value: 12 },
        ]);
      }
      if (identifier === "scouting.climbAttempt") {
        return metricEngine.seriesResult([
          { key: 1, value: 1 },
          { key: 2, value: 0 },
          { key: 3, value: 1 },
        ]);
      }
      return metricEngine.errorResult(`Unknown identifier ${identifier}`);
    },
  });

  assert.equal(result.granularity, "event");
  assert.equal(result.value, 12);
});

runTest("sum aggregates recent match-level values", () => {
  const result = metricEngine.evaluateFormulaExpression("sum(scouting.teleL3Made)", {
    recentEntryCount: 3,
    resolveIdentifier(identifier) {
      if (identifier === "scouting.teleL3Made") {
        return metricEngine.seriesResult([
          { key: 1, value: 2 },
          { key: 2, value: 4 },
          { key: 3, value: 6 },
        ]);
      }
      return metricEngine.errorResult(`Unknown identifier ${identifier}`);
    },
  });

  assert.equal(result.granularity, "event");
  assert.equal(result.value, 12);
});

runTest("average supports an optional inline filter expression", () => {
  const result = metricEngine.evaluateFormulaExpression("average(scouting.teleL3Made, scouting.climbAttempt > 0)", {
    recentEntryCount: 3,
    resolveIdentifier(identifier) {
      if (identifier === "scouting.teleL3Made") {
        return metricEngine.seriesResult([
          { key: 1, value: 2 },
          { key: 2, value: 4 },
          { key: 3, value: 8 },
        ]);
      }
      if (identifier === "scouting.climbAttempt") {
        return metricEngine.seriesResult([
          { key: 1, value: 0 },
          { key: 2, value: 1 },
          { key: 3, value: 1 },
        ]);
      }
      return metricEngine.errorResult(`Unknown identifier ${identifier}`);
    },
  });

  assert.equal(result.granularity, "event");
  assert.equal(result.value, 6);
});

runTest("sum supports an optional inline filter expression", () => {
  const result = metricEngine.evaluateFormulaExpression("sum(scouting.teleL3Made, scouting.climbAttempt > 0)", {
    recentEntryCount: 3,
    resolveIdentifier(identifier) {
      if (identifier === "scouting.teleL3Made") {
        return metricEngine.seriesResult([
          { key: 1, value: 2 },
          { key: 2, value: 4 },
          { key: 3, value: 8 },
        ]);
      }
      if (identifier === "scouting.climbAttempt") {
        return metricEngine.seriesResult([
          { key: 1, value: 0 },
          { key: 2, value: 1 },
          { key: 3, value: 1 },
        ]);
      }
      return metricEngine.errorResult(`Unknown identifier ${identifier}`);
    },
  });

  assert.equal(result.granularity, "event");
  assert.equal(result.value, 12);
});

runTest("count supports an optional inline filter expression", () => {
  const result = metricEngine.evaluateFormulaExpression("count(tba.climbScore, scouting.deepClimb > 0)", {
    recentEntryCount: 3,
    resolveIdentifier(identifier) {
      if (identifier === "tba.climbScore") {
        return metricEngine.seriesResult([
          { key: 1, value: 2 },
          { key: 2, value: 6 },
          { key: 3, value: 12 },
        ]);
      }
      if (identifier === "scouting.climbAttempt") {
        return metricEngine.seriesResult([
          { key: 1, value: 1 },
          { key: 2, value: 1 },
          { key: 3, value: 1 },
        ]);
      }
      if (identifier === "scouting.deepClimb") {
        return metricEngine.seriesResult([
          { key: 1, value: 0 },
          { key: 2, value: 0 },
          { key: 3, value: 1 },
        ]);
      }
      return metricEngine.errorResult(`Unknown identifier ${identifier}`);
    },
  });

  assert.equal(result.granularity, "event");
  assert.equal(result.value, 1);
});

runTest("evaluateFormulaExpression supports comparison operators for match-level filters", () => {
  const result = metricEngine.evaluateFormulaExpression("scouting.climbAttempt > 0", {
    resolveIdentifier(identifier) {
      if (identifier === "scouting.climbAttempt") {
        return metricEngine.seriesResult([
          { key: 1, value: 0 },
          { key: 2, value: 1 },
          { key: 3, value: 2 },
        ]);
      }
      return metricEngine.errorResult(`Unknown identifier ${identifier}`);
    },
  });

  assert.equal(result.granularity, "match");
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.entries)),
    [
      { key: 1, value: 0 },
      { key: 2, value: 1 },
      { key: 3, value: 1 },
    ],
  );
});

runTest("blank match values do not pass numeric comparison filters", () => {
  const result = metricEngine.evaluateFormulaExpression("scouting.autoFuelPct >= 0", {
    resolveIdentifier(identifier) {
      if (identifier === "scouting.autoFuelPct") {
        return metricEngine.seriesResult([
          { key: 1, value: null },
          { key: 2, value: "" },
          { key: 3, value: 0 },
          { key: 4, value: 15 },
        ]);
      }
      return metricEngine.errorResult(`Unknown identifier ${identifier}`);
    },
  });

  assert.equal(result.granularity, "match");
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.entries)),
    [
      { key: 1, value: null },
      { key: 2, value: null },
      { key: 3, value: 1 },
      { key: 4, value: 1 },
    ],
  );
});

runTest("evaluateFormulaExpression supports boolean composition for filters", () => {
  const result = metricEngine.evaluateFormulaExpression(
    "and(tba.climbScore > 0, or(scouting.climbAttempt > 0, scouting.deepClimb > 0))",
    {
      resolveIdentifier(identifier) {
        if (identifier === "tba.climbScore") {
          return metricEngine.seriesResult([
            { key: 1, value: 0 },
            { key: 2, value: 6 },
            { key: 3, value: 12 },
          ]);
        }
        if (identifier === "scouting.climbAttempt") {
          return metricEngine.seriesResult([
            { key: 1, value: 0 },
            { key: 2, value: 1 },
            { key: 3, value: 0 },
          ]);
        }
        if (identifier === "scouting.deepClimb") {
          return metricEngine.seriesResult([
            { key: 1, value: 0 },
            { key: 2, value: 0 },
            { key: 3, value: 1 },
          ]);
        }
        return metricEngine.errorResult(`Unknown identifier ${identifier}`);
      },
    },
  );

  assert.equal(result.granularity, "match");
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.entries)),
    [
      { key: 1, value: 0 },
      { key: 2, value: 1 },
      { key: 3, value: 1 },
    ],
  );
});

runTest("evaluateFormulaExpression supports symbolic boolean operators with precedence", () => {
  const result = metricEngine.evaluateFormulaExpression("!(tba.climbScore > 0) || scouting.climbAttempt > 0 ^ scouting.deepClimb > 0", {
    resolveIdentifier(identifier) {
      if (identifier === "tba.climbScore") {
        return metricEngine.seriesResult([
          { key: 1, value: 0 },
          { key: 2, value: 6 },
          { key: 3, value: 12 },
        ]);
      }
      if (identifier === "scouting.climbAttempt") {
        return metricEngine.seriesResult([
          { key: 1, value: 0 },
          { key: 2, value: 1 },
          { key: 3, value: 1 },
        ]);
      }
      if (identifier === "scouting.deepClimb") {
        return metricEngine.seriesResult([
          { key: 1, value: 0 },
          { key: 2, value: 1 },
          { key: 3, value: 0 },
        ]);
      }
      return metricEngine.errorResult(`Unknown identifier ${identifier}`);
    },
  });

  assert.equal(result.granularity, "match");
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.entries)),
    [
      { key: 1, value: 1 },
      { key: 2, value: 0 },
      { key: 3, value: 1 },
    ],
  );
});

runTest("evaluateFormulaExpression supports word-form boolean operators case-insensitively", () => {
  const result = metricEngine.evaluateFormulaExpression("NOT(tba.climbScore > 0) OR scouting.climbAttempt == 1 XOR scouting.deepClimb > 0", {
    resolveIdentifier(identifier) {
      if (identifier === "tba.climbScore") {
        return metricEngine.seriesResult([
          { key: 1, value: 0 },
          { key: 2, value: 6 },
          { key: 3, value: 12 },
        ]);
      }
      if (identifier === "scouting.climbAttempt") {
        return metricEngine.seriesResult([
          { key: 1, value: 0 },
          { key: 2, value: 1 },
          { key: 3, value: 1 },
        ]);
      }
      if (identifier === "scouting.deepClimb") {
        return metricEngine.seriesResult([
          { key: 1, value: 0 },
          { key: 2, value: 1 },
          { key: 3, value: 0 },
        ]);
      }
      return metricEngine.errorResult(`Unknown identifier ${identifier}`);
    },
  });

  assert.equal(result.granularity, "match");
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.entries)),
    [
      { key: 1, value: 1 },
      { key: 2, value: 0 },
      { key: 3, value: 1 },
    ],
  );
});

runTest("evaluateFormulaExpression supports true and false literals case-insensitively", () => {
  const result = metricEngine.evaluateFormulaExpression("TRUE && !false", {
    resolveIdentifier(identifier) {
      return metricEngine.errorResult(`Unknown identifier ${identifier}`);
    },
  });

  assert.equal(result.granularity, "scalar");
  assert.equal(result.value, 1);
});

runTest("evaluateFormulaExpression supports quoted string comparisons and string helpers", () => {
  const result = metricEngine.evaluateFormulaExpression("startsWith(scouting.role, \"sc\") && contains(scouting.notes, \"fuel\")", {
    resolveIdentifier(identifier) {
      if (identifier === "scouting.role") {
        return metricEngine.seriesResult([{ key: 1, value: "Score" }]);
      }
      if (identifier === "scouting.notes") {
        return metricEngine.seriesResult([{ key: 1, value: "High fuel output" }]);
      }
      return metricEngine.errorResult(`Unknown identifier ${identifier}`);
    },
  });

  assert.equal(result.granularity, "match");
  assert.deepEqual(JSON.parse(JSON.stringify(result.entries)), [{ key: 1, value: 1 }]);
});

runTest("evaluateFormulaExpression supports if and valueOr with match-level series", () => {
  const result = metricEngine.evaluateFormulaExpression("if(scouting.role == \"Score\", valueOr(scouting.fuel, 0), 0)", {
    resolveIdentifier(identifier) {
      if (identifier === "scouting.role") {
        return metricEngine.seriesResult([{ key: 1, value: "Score" }, { key: 2, value: "Defense" }]);
      }
      if (identifier === "scouting.fuel") {
        return metricEngine.seriesResult([{ key: 1, value: 12 }, { key: 2, value: null }]);
      }
      return metricEngine.errorResult(`Unknown identifier ${identifier}`);
    },
  });

  assert.equal(result.granularity, "match");
  assert.deepEqual(JSON.parse(JSON.stringify(result.entries)), [{ key: 1, value: 12 }, { key: 2, value: 0 }]);
});

runTest("valueOr preserves real zero values", () => {
  const result = metricEngine.evaluateFormulaExpression("valueOr(scouting.fuel, 99)", {
    resolveIdentifier(identifier) {
      if (identifier === "scouting.fuel") {
        return metricEngine.seriesResult([{ key: 1, value: 0 }, { key: 2, value: null }]);
      }
      return metricEngine.errorResult(`Unknown identifier ${identifier}`);
    },
  });

  assert.equal(result.granularity, "match");
  assert.deepEqual(JSON.parse(JSON.stringify(result.entries)), [{ key: 1, value: 0 }, { key: 2, value: 99 }]);
});

runTest("evaluateFormulaExpression delegates alliance-scoped functions", () => {
  const result = metricEngine.evaluateFormulaExpression("allianceSum(scouting.autoFuelPct / 100)", {
    resolveIdentifier(identifier) {
      if (identifier === "scouting.autoFuelPct") {
        return metricEngine.seriesResult([{ key: 3, value: 40 }]);
      }
      return metricEngine.errorResult(`Unknown identifier ${identifier}`);
    },
    evaluateGroupFunction({ name, scopeId, seriesAst, filterAst }) {
      assert.equal(name, "groupsum");
      assert.equal(scopeId, "allianceMatch");
      assert.equal(seriesAst.type, "binary");
      assert.equal(filterAst, null);
      return metricEngine.seriesResult([{ key: 3, value: 1.25 }]);
    },
  });

  assert.equal(result.granularity, "match");
  assert.deepEqual(JSON.parse(JSON.stringify(result.entries)), [{ key: 3, value: 1.25 }]);
});

runTest("evaluateFormulaExpression delegates event-scoped functions", () => {
  const result = metricEngine.evaluateFormulaExpression("eventAverage(average(scouting.autoFuelPct), statbotics.total > 0)", {
    resolveIdentifier(identifier) {
      if (identifier === "scouting.autoFuelPct") {
        return metricEngine.seriesResult([{ key: 3, value: 40 }]);
      }
      if (identifier === "statbotics.total") {
        return metricEngine.scalarResult(10, "event");
      }
      return metricEngine.errorResult(`Unknown identifier ${identifier}`);
    },
    evaluateEventFunction({ name, valueAst, filterAst }) {
      assert.equal(name, "eventaverage");
      assert.equal(valueAst.type, "call");
      assert.equal(valueAst.callee, "average");
      assert.equal(filterAst.type, "comparison");
      return metricEngine.scalarResult(7.5, "event");
    },
  });

  assert.equal(result.granularity, "event");
  assert.equal(result.value, 7.5);
});

runTest("evaluateFormulaExpression rejects mixed granularity without averaging", () => {
  const result = metricEngine.evaluateFormulaExpression("scouting.teleL3Made + statbotics.total", {
    resolveIdentifier(identifier) {
      if (identifier === "scouting.teleL3Made") {
        return metricEngine.seriesResult([{ key: 1, value: 3 }]);
      }
      if (identifier === "statbotics.total") {
        return metricEngine.scalarResult(100, "event");
      }
      return metricEngine.errorResult(`Unknown identifier ${identifier}`);
    },
  });

  assert.equal(result.kind, "error");
  assert.match(result.error, /Cannot mix match-level and event-level/);
});

runTest("aggregateSubmissionMatches sorts by match number and excludes flagged and excluded rows", () => {
  const matches = metricEngine.aggregateSubmissionMatches(
    [
      {
        matchNumber: 3,
        validity: "valid",
        rawMetrics: { auto: 6, cycle: 10 },
      },
      {
        matchNumber: 1,
        validity: "flagged",
        rawMetrics: { auto: 20, cycle: 20 },
      },
      {
        matchNumber: 1,
        validity: "excluded",
        rawMetrics: { auto: 30, cycle: 30 },
      },
      {
        matchNumber: 2,
        validity: "valid",
        rawMetrics: { auto: 5, cycle: 9 },
      },
    ],
    {
      scoringComponentIds: ["auto", "cycle"],
      scouterMetricIds: ["auto", "cycle"],
    },
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(matches.map((match) => ({ matchNumber: match.matchNumber, total: match.total })))),
    [
      { matchNumber: 2, total: 14 },
      { matchNumber: 3, total: 16 },
    ],
  );
});

runTest("aggregateSubmissionMatches collapses multiple valid submissions for the same match", () => {
  const matches = metricEngine.aggregateSubmissionMatches(
    [
      {
        matchNumber: 12,
        validity: "valid",
        rawMetrics: { tele: 4, climbAttempt: 1 },
      },
      {
        matchNumber: 12,
        validity: "valid",
        rawMetrics: { tele: 6, climbAttempt: 0 },
      },
      {
        matchNumber: 13,
        validity: "valid",
        rawMetrics: { tele: 3, climbAttempt: 1 },
      },
    ],
    {
      scoringComponentIds: ["tele"],
      scouterMetricIds: ["tele", "climbAttempt"],
    },
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(matches.map((match) => ({
      matchNumber: match.matchNumber,
      total: match.total,
      tele: match.components.tele,
      climbAttempt: match.components.climbAttempt,
      submissionCount: match.submissions.length,
    })))),
    [
      { matchNumber: 12, total: 5, tele: 5, climbAttempt: 0.5, submissionCount: 2 },
      { matchNumber: 13, total: 3, tele: 3, climbAttempt: 1, submissionCount: 1 },
    ],
  );
});

runTest("aggregateSubmissionMatches supports max aggregation for binary attempt fields", () => {
  const matches = metricEngine.aggregateSubmissionMatches(
    [
      {
        matchNumber: 12,
        validity: "valid",
        rawMetrics: { climbAttempt: 1, tele: 4 },
      },
      {
        matchNumber: 12,
        validity: "valid",
        rawMetrics: { climbAttempt: 0, tele: 6 },
      },
    ],
    {
      scoringComponentIds: ["tele"],
      scouterMetricIds: ["climbAttempt", "tele"],
      scouterMetricDefinitions: [
        { id: "climbAttempt", aggregate: "max" },
        { id: "tele" },
      ],
    },
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(matches.map((match) => ({
      matchNumber: match.matchNumber,
      climbAttempt: match.components.climbAttempt,
      tele: match.components.tele,
    })))),
    [
      { matchNumber: 12, climbAttempt: 1, tele: 5 },
    ],
  );
});

runTest("normalizeAllianceFieldShares normalizes buckets within each match and alliance", () => {
  const normalized = metricEngine.normalizeAllianceFieldShares(
    [
      {
        id: "red-1",
        teamNumber: 111,
        matchNumber: 1,
        alliance: "red",
        validity: "valid",
        rawMetrics: { autoFuelPct: 20, shift1FuelPct: 10 },
      },
      {
        id: "red-2",
        teamNumber: 222,
        matchNumber: 1,
        alliance: "red",
        validity: "valid",
        rawMetrics: { autoFuelPct: 30, shift1FuelPct: 30 },
      },
      {
        id: "red-3",
        teamNumber: 333,
        matchNumber: 1,
        alliance: "red",
        validity: "flagged",
        rawMetrics: { autoFuelPct: 50, shift1FuelPct: 60 },
      },
      {
        id: "blue-1",
        teamNumber: 444,
        matchNumber: 1,
        alliance: "blue",
        validity: "valid",
        rawMetrics: { autoFuelPct: 0, shift1FuelPct: 0 },
      },
      {
        id: "blue-2",
        teamNumber: 555,
        matchNumber: 1,
        alliance: "blue",
        validity: "valid",
        rawMetrics: { autoFuelPct: 0, shift1FuelPct: 0 },
      },
    ],
    ["autoFuelPct", "shift1FuelPct"],
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(normalized.map((entry) => ({
      submissionId: entry.submissionId,
      autoFuelPct: Number(entry.shares.autoFuelPct.toFixed(3)),
      shift1FuelPct: Number(entry.shares.shift1FuelPct.toFixed(3)),
    })))),
    [
      { submissionId: "blue-1", autoFuelPct: 0, shift1FuelPct: 0 },
      { submissionId: "blue-2", autoFuelPct: 0, shift1FuelPct: 0 },
      { submissionId: "red-1", autoFuelPct: 0.4, shift1FuelPct: 0.25 },
      { submissionId: "red-2", autoFuelPct: 0.6, shift1FuelPct: 0.75 },
    ],
  );
});

runTest("normalizeAllianceFieldShares can include flagged rows when requested", () => {
  const normalized = metricEngine.normalizeAllianceFieldShares(
    [
      {
        id: "team-a",
        teamNumber: 1,
        matchNumber: 7,
        alliance: "red",
        validity: "valid",
        rawMetrics: { autoFuelPct: 25 },
      },
      {
        id: "team-b",
        teamNumber: 2,
        matchNumber: 7,
        alliance: "red",
        validity: "flagged",
        rawMetrics: { autoFuelPct: 75 },
      },
    ],
    ["autoFuelPct"],
    { includeFlagged: true },
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(normalized.map((entry) => ({ submissionId: entry.submissionId, share: Number(entry.shares.autoFuelPct.toFixed(2)) })))),
    [
      { submissionId: "team-a", share: 0.25 },
      { submissionId: "team-b", share: 0.75 },
    ],
  );
});

runTest("buildTeamScoutingOverlay computes scouting totals, trends, and confidence", () => {
  const team = {
    number: 1234,
    flags: [],
    matches: [40, 44, 48],
    sources: {
      epa: { total: 45, components: { auto: 10, cycle: 35 }, trend: [42, 45, 48] },
    },
    derived: {},
  };

  const overlay = metricEngine.buildTeamScoutingOverlay(team, {
    submissions: [
      {
        teamNumber: 1234,
        matchNumber: 1,
        validity: "valid",
        defensePlayed: true,
        confidenceReasons: [],
        rawMetrics: { auto: 10, cycle: 30, rating: 3, made: 8, missed: 2 },
      },
      {
        teamNumber: 1234,
        matchNumber: 2,
        validity: "flagged",
        defensePlayed: false,
        confidenceReasons: ["schema_gap"],
        rawMetrics: { auto: 12, cycle: 28, rating: 4, made: 6, missed: 4 },
      },
      {
        teamNumber: 9999,
        matchNumber: 1,
        validity: "valid",
        defensePlayed: false,
        confidenceReasons: [],
        rawMetrics: { auto: 99, cycle: 99, rating: 1, made: 1, missed: 9 },
      },
    ],
    scoringComponents: [{ id: "auto" }, { id: "cycle" }],
    scouterMetricDefinitions: [{ id: "auto" }, { id: "cycle" }, { id: "rating" }, { id: "made" }, { id: "missed" }],
    derivedMetricDefinitions: [
      { id: "accuracy", formula: "rate", madeFields: ["made"], missFields: ["missed"], unit: "%" },
      { id: "driverAvg", formula: "average", fields: ["rating"], unit: "rating" },
    ],
  });

  assert.equal(overlay.sources.scouter.total, 40);
  assert.deepEqual(JSON.parse(JSON.stringify(overlay.sources.scouter.trend)), [40]);
  assert.deepEqual(JSON.parse(JSON.stringify(overlay.sources.scouter.componentTrend.auto)), [10]);
  assert.equal(overlay.derived.accuracy, 80);
  assert.equal(overlay.derived.driverAvg, 3);
  assert.equal(overlay.scouting.importedMatches, 1);
  assert.equal(overlay.scouting.flaggedCount, 1);
  assert.equal(overlay.scouting.confidence.tier, "low");
  assert.ok(overlay.flags.some((flag) => flag.label === "Sparse"));
  assert.ok(overlay.flags.some((flag) => flag.label === "Flagged"));
});

runTest("buildTeamScoutingOverlay exposes recent-window scouting aggregates", () => {
  const overlay = metricEngine.buildTeamScoutingOverlay(
    {
      number: 4321,
      flags: [],
      matches: [20, 25, 30, 35],
      sources: {},
      derived: {},
    },
    {
      recentMatchCount: 2,
      submissions: [
        { teamNumber: 4321, matchNumber: 1, validity: "valid", rawMetrics: { auto: 10, cycle: 20, rating: 2 } },
        { teamNumber: 4321, matchNumber: 2, validity: "valid", rawMetrics: { auto: 20, cycle: 30, rating: 3 } },
        { teamNumber: 4321, matchNumber: 3, validity: "valid", rawMetrics: { auto: 30, cycle: 40, rating: 4 } },
      ],
      scoringComponents: [{ id: "auto" }, { id: "cycle" }],
      scouterMetricDefinitions: [{ id: "auto" }, { id: "cycle" }, { id: "rating" }],
      derivedMetricDefinitions: [{ id: "driverAvg", formula: "average", fields: ["rating"], unit: "rating" }],
    },
  );

  assert.equal(overlay.sources.scouter.total, 50);
  assert.equal(overlay.recentWindow.sources.scouter.total, 60);
  assert.deepEqual(JSON.parse(JSON.stringify(overlay.recentWindow.sources.scouter.trend)), [50, 70]);
  assert.equal(metricEngine.teamMetricValue(overlay, { kind: "source", sourceId: "scouter", componentId: "total" }, { window: "recent" }), 60);
  assert.equal(metricEngine.teamMetricValue(overlay, { kind: "derived", componentId: "driverAvg" }, { window: "recent" }), 3.5);
  assert.deepEqual(
    JSON.parse(JSON.stringify(metricEngine.metricTrendValues(overlay, { kind: "source", sourceId: "scouter", componentId: "auto" }, { window: "recent" }))),
    [20, 30],
  );
});

runTest("metricTrendValues returns direct and derived trends", () => {
  const team = {
    matches: [20, 40, 60],
    sources: {
      scouter: {
        total: 40,
        trend: [18, 42, 60],
        components: { auto: 10 },
        componentTrend: { auto: [4, 10, 16] },
      },
      epa: {
        total: 50,
        trend: [40, 50, 60],
        components: { auto: 15 },
      },
    },
    derived: { consistency: 80 },
    derivedTrend: { consistency: [70, 80, 90] },
  };

  assert.deepEqual(
    metricEngine.metricTrendValues(team, { kind: "source", sourceId: "scouter", componentId: "auto" }),
    [4, 10, 16],
  );

  assert.deepEqual(
    metricEngine.metricTrendValues(team, { kind: "source", sourceId: "epa", componentId: "auto" }),
    [12, 15, 18],
  );

  assert.deepEqual(
    metricEngine.metricTrendValues(team, { kind: "derived", componentId: "consistency" }),
    [70, 80, 90],
  );
});

runTest("buildTeamScoutingOverlay flags duplicates, breakdowns, and inconsistent trends", () => {
  const overlay = metricEngine.buildTeamScoutingOverlay(
    {
      number: 2468,
      flags: [],
      matches: [80, 80, 80, 80],
      sources: {},
      derived: {},
    },
    {
      submissions: [
        {
          teamNumber: 2468,
          matchNumber: 1,
          validity: "flagged",
          defensePlayed: false,
          robotStatus: "broken",
          confidenceReasons: ["duplicate_submission"],
          rawMetrics: { auto: 5, cycle: 50 },
        },
        {
          teamNumber: 2468,
          matchNumber: 2,
          validity: "valid",
          defensePlayed: false,
          robotStatus: "ok",
          confidenceReasons: [],
          rawMetrics: { auto: 30, cycle: 80 },
        },
        {
          teamNumber: 2468,
          matchNumber: 3,
          validity: "valid",
          defensePlayed: false,
          robotStatus: "disabled",
          confidenceReasons: [],
          rawMetrics: { auto: 0, cycle: 5 },
        },
        {
          teamNumber: 2468,
          matchNumber: 4,
          validity: "valid",
          defensePlayed: false,
          robotStatus: "ok",
          confidenceReasons: [],
          rawMetrics: { auto: 55, cycle: 10 },
        },
      ],
      scoringComponents: [{ id: "auto" }, { id: "cycle" }],
      scouterMetricDefinitions: [{ id: "auto" }, { id: "cycle" }],
      derivedMetricDefinitions: [],
    },
  );

  assert.equal(overlay.scouting.confidence.tier, "low");
  assert.ok(overlay.flags.some((flag) => flag.label === "Duplicates"));
  assert.ok(overlay.flags.some((flag) => flag.label === "Breakdowns"));
  assert.ok(overlay.flags.some((flag) => flag.label === "Inconsistent"));
});

runTest("buildTeamScoutingOverlay returns seeded confidence when no team submissions exist", () => {
  const overlay = metricEngine.buildTeamScoutingOverlay(
    {
      number: 777,
      flags: [{ type: "external", label: "Seeded", severity: "good", evidence: "Seed data exists." }],
      matches: [10, 12],
      sources: { epa: { total: 11 } },
      derived: {},
    },
    {
      submissions: [
        {
          teamNumber: 888,
          matchNumber: 1,
          validity: "valid",
          defensePlayed: false,
          confidenceReasons: [],
          rawMetrics: { auto: 1 },
        },
      ],
      scoringComponents: [{ id: "auto" }],
      scouterMetricDefinitions: [{ id: "auto" }],
      derivedMetricDefinitions: [],
    },
  );

  assert.equal(overlay.scouting.submissionCount, 0);
  assert.equal(overlay.scouting.importedMatches, 0);
  assert.equal(overlay.scouting.confidence.tier, "medium");
  assert.deepEqual(JSON.parse(JSON.stringify(Array.from(overlay.scouting.confidence.reasons))), ["no_scouting_data", "seeded_scouting"]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(overlay.flags)),
    [{ type: "external", label: "Seeded", severity: "good", evidence: "Seed data exists." }],
  );
});
