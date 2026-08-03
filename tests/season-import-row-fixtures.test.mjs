import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { legacyGameDefinitions } from "./fixtures/legacy-game-definitions.mjs";

function loadBrowserScripts(relativePaths, exportName) {
  const context = {
    globalThis: {}, LegacyGameDefinitions: legacyGameDefinitions,
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
  relativePaths.forEach((relativePath) => {
    const sourcePath = path.resolve(relativePath);
    const source = fs.readFileSync(sourcePath, "utf8");
    vm.runInNewContext(source, context, { filename: sourcePath });
  });
  return context[exportName];
}

function loadBrowserScript(relativePath, exportName) {
  return loadBrowserScripts([relativePath], exportName);
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
const seasonFramework = loadBrowserScripts(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js"], "SeasonFramework");
const fixtures = JSON.parse(fs.readFileSync(path.resolve("tests/season-import-row-fixtures.json"), "utf8"));

fixtures.forEach((fixture) => {
  runTest(fixture.name, () => {
    const season = legacyGameDefinitions[fixture.season];
    assert.ok(season, `Season ${fixture.season} should exist`);

    const overlay = metricEngine.buildTeamScoutingOverlay(
      {
        number: fixture.teamNumber,
        flags: fixture.baseTeam.flags,
        matches: fixture.baseTeam.matches,
        sources: fixture.baseTeam.sources,
        derived: fixture.baseTeam.derived,
      },
      {
        submissions: fixture.submissions,
        scoringComponents: season.scoringComponents,
        scouterMetricDefinitions: seasonFramework.scouterMetricDefinitions(season),
        derivedMetricDefinitions: seasonFramework.derivedMetricDefinitions(season),
      },
    );

    assertClose(overlay.sources.scouter.total, fixture.expected.scouterTotal, `${fixture.name} total`);
    assert.equal(overlay.scouting.confidence.tier, fixture.expected.confidenceTier);
    if (typeof fixture.expected.flaggedCount === "number") {
      assert.equal(overlay.scouting.flaggedCount, fixture.expected.flaggedCount, `${fixture.name} flagged count`);
    }
    if (Array.isArray(fixture.expected.flagLabels)) {
      const labels = overlay.flags.map((flag) => flag.label);
      fixture.expected.flagLabels.forEach((label) => {
        assert.ok(labels.includes(label), `${fixture.name} should include flag ${label}`);
      });
    }

    Object.entries(fixture.expected.derived).forEach(([metricId, expectedValue]) => {
      assertClose(Number(overlay.derived[metricId] || 0), expectedValue, `${fixture.name} ${metricId}`);
    });
  });
});
