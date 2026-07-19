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

runTest("previewScoutingJsonImport accepts canonical scouting JSON and preserves entry raw metrics", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-source-utils.js", "src/scouting-json-schema.js", "src/scouting-json-import.js"]);
  const season2026 = context.SeasonFramework.gameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2026,
    key: "2026chcmp",
    seasonLabel: season2026.label,
    metrics: context.SeasonFramework.buildMetrics(season2026),
    criteriaSources: context.SeasonFramework.buildCriteriaSources(season2026),
  };

  const preview = context.ScoutingJsonImport.previewScoutingJsonImport({
    jsonText: fs.readFileSync(path.resolve("tests/fixtures/canonical-scouting-json/valid-2026chcmp-match.json"), "utf8"),
    eventModel,
    activeEventKey: "2026chcmp",
    existingSubmissions: [],
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.summary.profileId, "canonical-json-v1");
  assert.equal(preview.summary.metadata.schemaId, "2026-match-v1");
  assert.equal(preview.summary.submissions[0].rawMetrics.autoFuelPct, 80);
  assert.equal(preview.summary.submissions[0].rawMetrics.autoPrimaryRole, "Score");
  assert.equal(preview.summary.submissions[0].provenance.mode, "canonical-json-import");
  assert.equal(preview.summary.submissions[0].provenance.sourceEntryId, "entry-1");
});

runTest("previewScoutingJsonImport preserves explicit entry provenance", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-source-utils.js", "src/scouting-json-schema.js", "src/scouting-json-import.js"]);
  const season2026 = context.SeasonFramework.gameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2026,
    key: "2026chcmp",
    seasonLabel: season2026.label,
    metrics: context.SeasonFramework.buildMetrics(season2026),
    criteriaSources: context.SeasonFramework.buildCriteriaSources(season2026),
  };

  const preview = context.ScoutingJsonImport.previewScoutingJsonImport({
    jsonText: JSON.stringify({
      meta: {
        format: "frc-scouting-analysis/v1",
        season: 2026,
        eventKey: "2026chcmp",
        entryType: "match",
      },
      schema: context.ScoutingJsonSchema.buildCanonicalSchemaForEventModel(eventModel),
      entries: [
        {
          entryId: "entry-provenance",
          matchNumber: 3,
          teamNumber: 686,
          alliance: "red",
          provenance: {
            collectedAt: "2026-04-05T13:50:00Z",
            sourceRowNumber: 41,
            notes: "Imported from tablet sync",
          },
          rawMetrics: { autoFuelPct: 80, scoutUser: "Scout A", station: "1" },
        },
      ],
    }),
    schemaJsonText: JSON.stringify({
      meta: {
        format: "frc-scouting-analysis/v1",
        sourceApp: "Custom Scouting App",
        templateProfileId: "canonical-json-v1",
      },
      schema: context.ScoutingJsonSchema.buildCanonicalSchemaForEventModel(eventModel),
    }),
    eventModel,
    activeEventKey: "2026chcmp",
    existingSubmissions: [],
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.summary.submissions[0].provenance.mode, "canonical-json-import");
  assert.equal(preview.summary.submissions[0].provenance.collectedAt, "2026-04-05T13:50:00Z");
  assert.equal(preview.summary.submissions[0].provenance.sourceRowNumber, 41);
  assert.equal(preview.summary.submissions[0].provenance.sourceApp, "Custom Scouting App");
});

runTest("previewScoutingJsonImport rejects canonical JSON for the wrong event", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-source-utils.js", "src/scouting-json-schema.js", "src/scouting-json-import.js"]);
  const season2026 = context.SeasonFramework.gameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2026,
    key: "2026chcmp",
    seasonLabel: season2026.label,
    metrics: context.SeasonFramework.buildMetrics(season2026),
    criteriaSources: context.SeasonFramework.buildCriteriaSources(season2026),
  };

  const preview = context.ScoutingJsonImport.previewScoutingJsonImport({
    jsonText: JSON.stringify({
      meta: {
        format: "frc-scouting-analysis/v1",
        season: 2026,
        eventKey: "2026other",
        entryType: "match",
      },
      schema: {
        schemaId: "2026-match-v1",
        fields: [],
      },
      entries: [],
    }),
    eventModel,
    activeEventKey: "2026chcmp",
    existingSubmissions: [],
  });

  assert.equal(preview.ok, false);
  assert.ok(preview.errors.some((error) => error.includes("does not match active event")));
  assert.equal(preview.suggestedEventKey, "2026other");
});

runTest("previewScoutingJsonImport rejects canonical JSON that omits schema field definitions", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-source-utils.js", "src/scouting-json-schema.js", "src/scouting-json-import.js"]);
  const season2026 = context.SeasonFramework.gameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2026,
    key: "2026chcmp",
    seasonLabel: season2026.label,
    metrics: context.SeasonFramework.buildMetrics(season2026),
    criteriaSources: context.SeasonFramework.buildCriteriaSources(season2026),
  };

  const preview = context.ScoutingJsonImport.previewScoutingJsonImport({
    jsonText: fs.readFileSync(path.resolve("tests/fixtures/canonical-scouting-json/invalid-missing-schema-fields.json"), "utf8"),
    eventModel,
    activeEventKey: "2026chcmp",
    existingSubmissions: [],
  });

  assert.equal(preview.ok, false);
  assert.ok(preview.errors.some((error) => error.includes("schema.fields must be an array")));
});

runTest("previewScoutingJsonImport flags duplicate rows by canonical event, match, and team identity", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-source-utils.js", "src/scouting-json-schema.js", "src/scouting-json-import.js"]);
  const season2026 = context.SeasonFramework.gameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2026,
    key: "2026chcmp",
    seasonLabel: season2026.label,
    metrics: context.SeasonFramework.buildMetrics(season2026),
    criteriaSources: context.SeasonFramework.buildCriteriaSources(season2026),
  };

  const preview = context.ScoutingJsonImport.previewScoutingJsonImport({
    jsonText: JSON.stringify({
      meta: {
        format: "frc-scouting-analysis/v1",
        season: 2026,
        eventKey: "2026chcmp",
        entryType: "match",
      },
      schema: context.ScoutingJsonSchema.buildCanonicalSchemaForEventModel(eventModel),
      entries: [
        {
          entryId: "a",
          matchNumber: 5,
          teamNumber: 686,
          alliance: "blue",
          rawMetrics: { autoFuelPct: 60, scoutUser: "Scout A", station: "1" },
        },
        {
          entryId: "b",
          matchNumber: 5,
          teamNumber: 686,
          alliance: "blue",
          rawMetrics: { autoFuelPct: 55, scoutUser: "Scout B", station: "2" },
        },
      ],
    }),
    eventModel,
    activeEventKey: "2026chcmp",
    existingSubmissions: [],
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.summary.duplicateGroups, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(preview.summary.duplicateGroupKeys)), ["2026chcmp:5:686"]);
  assert.equal(preview.summary.submissions[0].validity, "flagged");
  assert.equal(preview.summary.submissions[1].validity, "flagged");
  assert.ok(preview.summary.submissions.every((submission) => submission.confidenceReasons.includes("duplicate_submission")));
});

runTest("previewScoutingJsonImport still detects duplicates when helper scripts load after scouting-json-import", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-json-schema.js", "src/scouting-json-import.js", "src/scouting-source-utils.js"]);
  const season2026 = context.SeasonFramework.gameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2026,
    key: "2026chcmp",
    seasonLabel: season2026.label,
    metrics: context.SeasonFramework.buildMetrics(season2026),
    criteriaSources: context.SeasonFramework.buildCriteriaSources(season2026),
  };

  const preview = context.ScoutingJsonImport.previewScoutingJsonImport({
    jsonText: JSON.stringify({
      meta: {
        format: "frc-scouting-analysis/v1",
        season: 2026,
        eventKey: "2026chcmp",
        entryType: "match",
      },
      schema: context.ScoutingJsonSchema.buildCanonicalSchemaForEventModel(eventModel),
      entries: [
        {
          entryId: "a",
          matchNumber: 5,
          teamNumber: 686,
          alliance: "blue",
          rawMetrics: { autoFuelPct: 60, scoutUser: "Scout A", station: "1" },
        },
        {
          entryId: "b",
          matchNumber: 5,
          teamNumber: 686,
          alliance: "blue",
          rawMetrics: { autoFuelPct: 55, scoutUser: "Scout B", station: "2" },
        },
      ],
    }),
    eventModel,
    activeEventKey: "2026chcmp",
    existingSubmissions: [],
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.summary.duplicateGroups, 1);
  assert.ok(preview.summary.submissions.every((submission) => submission.validity === "flagged"));
});

runTest("previewScoutingJsonImport honors payload schema fields instead of forcing the season default field list", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-source-utils.js", "src/scouting-json-schema.js", "src/scouting-json-import.js"]);
  const season2026 = context.SeasonFramework.gameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2026,
    key: "2026chcmp",
    seasonLabel: season2026.label,
    metrics: context.SeasonFramework.buildMetrics(season2026),
    criteriaSources: context.SeasonFramework.buildCriteriaSources(season2026),
  };

  const preview = context.ScoutingJsonImport.previewScoutingJsonImport({
    jsonText: JSON.stringify({
      meta: {
        format: "frc-scouting-analysis/v1",
        season: 2026,
        eventKey: "2026chcmp",
        entryType: "match",
      },
      schema: {
        schemaId: "2026-match-drifted",
        fields: [
          { id: "autoFuelPct", label: "Auto Fuel %", type: "number", unit: "%", aggregate: "average" },
          { id: "customDriverTag", label: "Driver Tag", type: "string", unit: "text", aggregate: "mode" },
        ],
      },
      entries: [
        {
          entryId: "drifted-1",
          matchNumber: 12,
          teamNumber: 686,
          alliance: "blue",
          rawMetrics: {
            autoFuelPct: 65,
            customDriverTag: "calm",
            scoutUser: "Scout A",
            station: "1",
          },
        },
      ],
    }),
    schemaJsonText: JSON.stringify({
      meta: {
        format: "frc-scouting-analysis/v1",
        templateProfileId: "canonical-json-v1",
      },
      schema: {
        schemaId: "2026-match-drifted",
        fields: [
          { id: "autoFuelPct", label: "Auto Fuel %", type: "number", unit: "%", aggregate: "average" },
          { id: "customDriverTag", label: "Driver Tag", type: "string", unit: "text", aggregate: "mode" },
        ],
      },
    }),
    eventModel,
    activeEventKey: "2026chcmp",
    existingSubmissions: [],
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.summary.flaggedRows, 0);
  assert.equal(preview.summary.submissions[0].validity, "valid");
  assert.deepEqual(JSON.parse(JSON.stringify(preview.warnings)), []);
  assert.deepEqual(preview.summary.schemaFields.map((field) => field.id), ["autoFuelPct", "customDriverTag"]);
});

runTest("previewScoutingJsonImport can combine split entries and schema artifacts", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-source-utils.js", "src/scouting-json-schema.js", "src/scouting-json-import.js"]);
  const season2026 = context.SeasonFramework.gameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2026,
    key: "2026chcmp",
    seasonLabel: season2026.label,
    metrics: context.SeasonFramework.buildMetrics(season2026),
    criteriaSources: context.SeasonFramework.buildCriteriaSources(season2026),
  };

  const preview = context.ScoutingJsonImport.previewScoutingJsonImport({
    jsonText: JSON.stringify({
      meta: {
        format: "frc-scouting-analysis/v1",
        season: 2026,
        eventKey: "2026chcmp",
        entryType: "match",
      },
      entries: [
        {
          entryId: "split-1",
          matchNumber: 4,
          teamNumber: 686,
          alliance: "blue",
          rawMetrics: {
            scoutUser: "Scout Split",
            station: "2",
            autoFuelPct: 70,
          },
        },
      ],
    }),
    schemaJsonText: JSON.stringify({
      meta: {
        format: "frc-scouting-analysis/v1",
        sourceApp: "Split Exporter",
        templateProfileId: "canonical-json-v1",
        profileLabel: "Canonical JSON",
        translationVersion: "split-v1",
      },
      schema: context.ScoutingJsonSchema.buildCanonicalSchemaForEventModel(eventModel),
    }),
    eventModel,
    activeEventKey: "2026chcmp",
    existingSubmissions: [],
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.summary.metadata.templateProfileId, "canonical-json-v1");
  assert.equal(preview.summary.metadata.translationVersion, "split-v1");
  assert.equal(preview.summary.submissions[0].scoutUser, "Scout Split");
  assert.equal(preview.summary.submissions[0].station, "2");
  assert.equal(preview.summary.submissions[0].provenance.sourceApp, "Split Exporter");
});
