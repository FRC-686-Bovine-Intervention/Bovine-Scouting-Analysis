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
  const season = context.SeasonFramework.gameDefinitions[2025];
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

runTest("stampScoutingSubmissionMetadata uses event-owned field definitions without SeasonFramework", () => {
  const context = loadBrowserContext(["src/scouting-import-repair.js"]);
  const eventModel = {
    key: "2027demo",
    season: 2027,
    formulaFieldDefinitions: [
      { id: "customCounter", label: "Custom Counter", unit: "count", aggregate: "average" },
      { id: "driverTag", label: "Driver Tag", unit: "text", aggregate: "" },
    ],
  };
  const stamped = context.ScoutingImportRepair.stampScoutingSubmissionMetadata(
    [
      {
        teamNumber: 2537,
        matchNumber: 7,
        schemaVersion: "match-v3",
        templateProfileId: "custom-profile-v1",
        rawMetrics: { customCounter: 3, driverTag: "steady" },
      },
    ],
    eventModel,
  );

  const parsedSignature = JSON.parse(stamped[0].scoutingSchemaSignature);
  assert.deepEqual(
    JSON.parse(JSON.stringify(parsedSignature.fields.map((field) => field.id))),
    ["customCounter", "driverTag"],
  );
});

runTest("stamped submissions do not refresh when the current schema matches", () => {
  const context = loadBrowserContext(["src/season-framework.js", "src/scouting-import-repair.js"]);
  const season = context.SeasonFramework.gameDefinitions[2025];
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

runTest("sample-backed 2026 submissions refresh when newly added formula fields are missing", () => {
  const context = loadBrowserContext(["src/season-framework.js", "src/scouting-import-repair.js"]);
  const season = context.SeasonFramework.gameDefinitions[2026];
  const eventModel = {
    key: "2026chcmp",
    season: 2026,
    sheet: { sampleCsvText: "header\nvalue" },
    scoringComponents: season.scoringComponents,
    scouterMetricDefinitions: context.SeasonFramework.scouterMetricDefinitions(season),
    formulaFieldDefinitions: context.SeasonFramework.formulaFieldDefinitions(season),
  };
  const stamped = context.ScoutingImportRepair.stampScoutingSubmissionMetadata(
    [
      {
        teamNumber: 346,
        matchNumber: 3,
        schemaVersion: "match-v2",
        templateProfileId: "match-current-v2",
        rawMetrics: {
          autoFuelPct: 90,
          transitionFuelPct: 0,
          shift1FuelPct: 60,
          shift2FuelPct: 0,
          shift3FuelPct: 0,
          shift4FuelPct: 60,
          endgameFuelPct: 60,
          overallShooter: 4,
          overallPasser: 4,
          overallIntake: 3,
          overallDriver: 5,
          overallDefenseAvoidance: 0,
          overallDefense: 0,
          noShow: 0,
        },
      },
    ],
    eventModel,
  );

  assert.equal(context.ScoutingImportRepair.shouldRefreshSampleBackedScoutingSubmissions(stamped, eventModel), true);
});

runTest("stamped submissions can use explicit schema fields instead of season-seeded defaults", () => {
  const context = loadBrowserContext(["src/season-framework.js", "src/scouting-import-repair.js"]);
  const season = context.SeasonFramework.gameDefinitions[2026];
  const eventModel = {
    key: "2026chcmp",
    season: 2026,
    sheet: { sampleCsvText: "header\nvalue" },
    scoringComponents: season.scoringComponents,
    scouterMetricDefinitions: context.SeasonFramework.scouterMetricDefinitions(season),
    formulaFieldDefinitions: context.SeasonFramework.formulaFieldDefinitions(season),
  };
  const schemaFields = [
    { id: "customDriverTag", label: "Custom Driver Tag", type: "string", unit: "text", aggregate: "" },
    { id: "newCounter", label: "New Counter", type: "number", unit: "count", aggregate: "average" },
  ];
  const stamped = context.ScoutingImportRepair.stampScoutingSubmissionMetadata(
    [
      {
        teamNumber: 346,
        matchNumber: 3,
        schemaVersion: "match-v2",
        templateProfileId: "custom-profile-v1",
        rawMetrics: {
          customDriverTag: "steady",
          newCounter: 3,
        },
      },
    ],
    eventModel,
    { schemaFields },
  );

  assert.equal(
    stamped[0].scoutingSchemaSignature,
    context.ScoutingImportRepair.buildScoutingSchemaSignatureFromFields({
      eventKey: eventModel.key,
      season: eventModel.season,
      fields: schemaFields,
    }),
  );
  assert.equal(
    context.ScoutingImportRepair.shouldRefreshSampleBackedScoutingSubmissions(stamped, eventModel, {
      schemaFields,
    }),
    false,
  );
});

runTest("repairLegacySubmissionRawMetrics backfills 2024 climbAttempt from climbSuccess", () => {
  const context = loadBrowserContext(["src/season-framework.js", "src/scouting-import-repair.js"]);
  const eventModel = { key: "2024mdsev", season: 2024 };

  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        context.ScoutingImportRepair.repairLegacySubmissionRawMetrics(
          {
            autoSpeakerMade: 3,
            climbSuccess: 1,
          },
          eventModel,
        ),
      ),
    ),
    {
      autoSpeakerMade: 3,
      climbSuccess: 1,
      climbAttempt: 1,
    },
  );
});

runTest("repairLegacySubmissionRawMetrics preserves explicit 2024 climbAttempt", () => {
  const context = loadBrowserContext(["src/season-framework.js", "src/scouting-import-repair.js"]);
  const eventModel = { key: "2024mdsev", season: 2024 };

  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        context.ScoutingImportRepair.repairLegacySubmissionRawMetrics(
          {
            climbSuccess: 1,
            climbAttempt: 0,
          },
          eventModel,
        ),
      ),
    ),
    {
      climbSuccess: 1,
      climbAttempt: 0,
    },
  );
});

runTest("sample-backed submissions refresh when the thin translation version changes", () => {
  const context = loadBrowserContext(["src/season-framework.js", "src/sheet-import-adapters.js", "src/scouting-import-repair.js"]);
  const season = context.SeasonFramework.gameDefinitions[2026];
  const eventModel = {
    key: "2026chcmp",
    season: 2026,
    sheet: { sampleCsvText: "header\nvalue" },
    scoringComponents: season.scoringComponents,
    scouterMetricDefinitions: context.SeasonFramework.scouterMetricDefinitions(season),
    formulaFieldDefinitions: context.SeasonFramework.formulaFieldDefinitions(season),
  };

  assert.equal(
    context.ScoutingImportRepair.shouldRefreshSampleBackedScoutingSubmissions(
      [
        {
          teamNumber: 346,
          matchNumber: 3,
          schemaVersion: "match-v2",
          templateProfileId: "match-current-v2",
          importTranslationVersion: "2026-thin-v1",
          scoutingSchemaSignature: context.ScoutingImportRepair.buildScoutingSchemaSignature(eventModel),
          rawMetrics: Object.fromEntries(
            context.SeasonFramework.formulaFieldDefinitions(season).map((metricDefinition) => [metricDefinition.id, 0]),
          ),
        },
      ],
      eventModel,
    ),
    true,
  );
});
