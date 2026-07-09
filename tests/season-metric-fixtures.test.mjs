import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

function loadBrowserScript(relativePath, exportName) {
  const sourcePath = path.resolve(relativePath);
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
  return context[exportName];
}

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function assertClose(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 0.001, `${message}: expected ${expected}, got ${actual}`);
}

const metricEngine = loadBrowserScript("src/metric-engine.js", "MetricEngine");
const seasonFramework = loadBrowserScript("src/season-framework.js", "SeasonFramework");
const fixtures = JSON.parse(fs.readFileSync(path.resolve("tests/season-metric-fixtures.json"), "utf8"));

fixtures.forEach((fixture) => {
  runTest(`season ${fixture.season} trusted fixture`, () => {
    const season = seasonFramework.seasonDefinitions[fixture.season];
    assert.ok(season, `Season ${fixture.season} should exist`);

    const baseTeam = {
      number: fixture.teamNumber,
      flags: fixture.baseTeam.flags,
      matches: fixture.baseTeam.matches,
      sources: fixture.baseTeam.sources,
      derived: fixture.baseTeam.derived,
    };

    const overlay = metricEngine.buildTeamScoutingOverlay(baseTeam, {
      submissions: fixture.submissions,
      scoringComponents: season.scoringComponents,
      scouterMetricDefinitions: seasonFramework.scouterMetricDefinitions(season),
      derivedMetricDefinitions: seasonFramework.derivedMetricDefinitions(season),
    });

    assertClose(overlay.sources.scouter.total, fixture.expected.scouterTotal, `${fixture.season} scouter total`);
    assert.equal(overlay.scouting.confidence.tier, fixture.expected.confidenceTier);

    Object.entries(fixture.expected.derived).forEach(([metricId, expectedValue]) => {
      assertClose(Number(overlay.derived[metricId] || 0), expectedValue, `${fixture.season} ${metricId}`);
    });
  });
});
