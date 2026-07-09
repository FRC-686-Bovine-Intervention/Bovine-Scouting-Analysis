import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function loadBrowserContext(relativePaths, extras = {}) {
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
    JSON,
    ...extras,
  };
  context.globalThis = context;
  relativePaths.forEach((relativePath) => {
    const sourcePath = path.resolve(relativePath);
    const source = fs.readFileSync(sourcePath, "utf8");
    vm.runInNewContext(source, context, { filename: sourcePath });
  });
  return context;
}

runTest("sample-backed legacy submissions are marked for refresh when schema metadata is missing", () => {
  const context = loadBrowserContext(["src/season-framework.js", "src/scouting-import-repair.js"]);
  const season = context.SeasonFramework.seasonDefinitions[2025];
  const eventModel = {
    key: "2025chcmp",
    season: 2025,
    sheet: { sampleCsvText: "header\nvalue" },
    scoringComponents: season.scoringComponents,
    scouterMetricDefinitions: context.SeasonFramework.scouterMetricDefinitions(season),
  };

  assert.equal(
    context.ScoutingImportRepair.shouldRefreshSampleBackedScoutingSubmissions(
      [
        {
          teamNumber: 686,
          matchNumber: 1,
          rawMetrics: { autoL4Made: 0 },
        },
      ],
      eventModel,
    ),
    true,
  );
});

runTest("stamped submissions do not refresh when the current schema matches", () => {
  const context = loadBrowserContext(["src/season-framework.js", "src/scouting-import-repair.js"]);
  const season = context.SeasonFramework.seasonDefinitions[2025];
  const eventModel = {
    key: "2025chcmp",
    season: 2025,
    sheet: { sampleCsvText: "header\nvalue" },
    scoringComponents: season.scoringComponents,
    scouterMetricDefinitions: context.SeasonFramework.scouterMetricDefinitions(season),
  };
  const stamped = context.ScoutingImportRepair.stampScoutingSubmissionMetadata(
    [
      {
        teamNumber: 686,
        matchNumber: 1,
        schemaVersion: "match-v2",
        templateProfileId: "match-current-v2",
        rawMetrics: Object.fromEntries(eventModel.scouterMetricDefinitions.map((metricDefinition) => [metricDefinition.id, 0])),
      },
    ],
    eventModel,
  );

  assert.equal(context.ScoutingImportRepair.shouldRefreshSampleBackedScoutingSubmissions(stamped, eventModel), false);
});
