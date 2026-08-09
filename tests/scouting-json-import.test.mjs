import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { legacyGameDefinitions } from "./fixtures/legacy-game-definitions.mjs";

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
    globalThis: {}, LegacyGameDefinitions: legacyGameDefinitions,
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
  const season2026 = context.LegacyGameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2026,
    key: "2026chcmp",
    seasonLabel: season2026.label,
    metrics: context.SeasonFramework.buildMetrics(season2026),
    criteriaSources: context.SeasonFramework.buildCriteriaSources(season2026),
  };

  const preview = context.ScoutingJsonImport.previewScoutingJsonImport({
    jsonText: fs.readFileSync(path.resolve("tests/fixtures/canonical-scouting-json/valid-2026chcmp-match.entries.json"), "utf8"),
    schemaJsonText: fs.readFileSync(path.resolve("tests/fixtures/canonical-scouting-json/valid-2026chcmp-match.schema.json"), "utf8"),
    eventModel,
    activeEventKey: "2026chcmp",
    existingSubmissions: [],
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.summary.profileId, "canonical-json-v1");
  assert.equal(preview.summary.metadata.schemaId, "2026-match-v1");
  assert.equal(preview.summary.profileDefinition.id, "canonical-json-v1");
  assert.equal(preview.summary.submissions[0].rawMetrics.autoFuelPct, 80);
  assert.equal(preview.summary.submissions[0].rawMetrics.autoPrimaryRole, "Score");
  assert.equal(preview.summary.submissions[0].provenance.mode, "canonical-json-import");
  assert.equal(preview.summary.submissions[0].provenance.sourceEntryId, "entry-1");
});

runTest("previewScoutingJsonImport accepts schema-carrying canonical JSON without season-seeded field definitions", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-source-utils.js", "src/scouting-json-schema.js", "src/scouting-json-import.js"]);
  const eventModel = {
    season: 2026,
    key: "2026chcmp",
    seasonLabel: "2026 Season",
    scoringComponents: [],
    formulaFieldDefinitions: [],
    scouterMetricDefinitions: [],
    derivedMetricDefinitions: [],
    metrics: [],
  };

  const preview = context.ScoutingJsonImport.previewScoutingJsonImport({
    jsonText: fs.readFileSync(path.resolve("tests/fixtures/canonical-scouting-json/valid-2026chcmp-match.entries.json"), "utf8"),
    schemaJsonText: fs.readFileSync(path.resolve("tests/fixtures/canonical-scouting-json/valid-2026chcmp-match.schema.json"), "utf8"),
    eventModel,
    activeEventKey: "2026chcmp",
    existingSubmissions: [],
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.summary.schemaFields.length > 0, true);
  assert.equal(preview.summary.submissions[0].rawMetrics.autoFuelPct, 80);
});

runTest("previewScoutingJsonImport preserves string-only expectedScoutingFields ids from schema artifacts", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-source-utils.js", "src/scouting-json-schema.js", "src/scouting-json-import.js"]);
  const eventModel = {
    season: 2025,
    key: "2025chcmp",
    seasonLabel: "2025 Season",
    scoringComponents: [],
    formulaFieldDefinitions: [],
    scouterMetricDefinitions: [],
    derivedMetricDefinitions: [],
    metrics: [],
  };

  const preview = context.ScoutingJsonImport.previewScoutingJsonImport({
    jsonText: JSON.stringify({
      meta: {
        format: "frc-scouting-analysis/v1",
        season: 2025,
        eventKey: "2025chcmp",
        entryType: "match",
      },
      entries: [
        {
          entryId: "entry-1",
          matchNumber: 1,
          teamNumber: 686,
          alliance: "blue",
          rawMetrics: {
            autoL4Made: 1,
            climbHeight: 4,
            notes: "",
          },
        },
      ],
    }),
    schemaJsonText: JSON.stringify({
      meta: {
        format: "frc-scouting-analysis/v1",
        templateProfileId: "canonical-json-v1",
        profileLabel: "Canonical JSON",
      },
      schema: {
        schemaId: "2025-match-v1",
        expectedScoutingFields: ["autoL4Made", "climbLevel", "notes"],
      },
      profile: {
        id: "canonical-json-v1",
        label: "Canonical JSON",
      },
    }),
    eventModel,
    activeEventKey: "2025chcmp",
    existingSubmissions: [],
  });

  assert.equal(preview.ok, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(preview.summary.schemaFields.map((field) => field.id))),
    ["autoL4Made", "climbLevel", "notes"],
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(preview.summary.schemaFields.map((field) => ({ id: field.id, type: field.type, unit: field.unit })))),
    [
      { id: "autoL4Made", type: "number", unit: "" },
      { id: "climbLevel", type: "number", unit: "" },
      { id: "notes", type: "string", unit: "" },
    ],
  );
});

runTest("previewScoutingJsonImport carries schema metricPresentation into the imported profile definition", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-source-utils.js", "src/scouting-json-schema.js", "src/scouting-json-import.js"]);
  const eventModel = {
    season: 2025,
    key: "2025chcmp",
    seasonLabel: "2025 Season",
    scoringComponents: [],
    formulaFieldDefinitions: [],
    scouterMetricDefinitions: [],
    derivedMetricDefinitions: [],
    metrics: [],
  };

  const preview = context.ScoutingJsonImport.previewScoutingJsonImport({
    jsonText: JSON.stringify({
      meta: {
        format: "frc-scouting-analysis/v1",
        season: 2025,
        eventKey: "2025chcmp",
        entryType: "match",
      },
      entries: [
        {
          entryId: "entry-1",
          matchNumber: 1,
          teamNumber: 686,
          alliance: "blue",
          rawMetrics: {
            autoL4Made: 1,
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
        profileLabel: "Canonical JSON",
      },
      schema: {
        schemaId: "2025-match-v1",
        metricPresentation: {
          blacklist: {
            tba: [
              "scoreBreakdown.autoReef.*.node*",
              "scoreBreakdown.teleopReef.*.node*",
            ],
            statbotics: [],
          },
        },
        expectedScoutingFields: ["autoL4Made", "notes"],
      },
      profile: {
        id: "canonical-json-v1",
        label: "Canonical JSON",
      },
    }),
    eventModel,
    activeEventKey: "2025chcmp",
    existingSubmissions: [],
  });

  assert.equal(preview.ok, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(preview.summary.profileDefinition.metricPresentation)),
    {
      blacklist: {
        tba: [
          "scoreBreakdown.autoReef.*.node*",
          "scoreBreakdown.teleopReef.*.node*",
        ],
        statbotics: [],
      },
    },
  );
});

runTest("previewScoutingJsonImport preserves explicit entry provenance", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-source-utils.js", "src/scouting-json-schema.js", "src/scouting-json-import.js"]);
  const season2026 = context.LegacyGameDefinitions["2026"];
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
  const season2026 = context.LegacyGameDefinitions["2026"];
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
  const season2026 = context.LegacyGameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2026,
    key: "2026chcmp",
    seasonLabel: season2026.label,
    metrics: context.SeasonFramework.buildMetrics(season2026),
    criteriaSources: context.SeasonFramework.buildCriteriaSources(season2026),
  };

  const preview = context.ScoutingJsonImport.previewScoutingJsonImport({
    jsonText: fs.readFileSync(path.resolve("tests/fixtures/canonical-scouting-json/invalid-missing-schema-fields.entries.json"), "utf8"),
    schemaJsonText: fs.readFileSync(path.resolve("tests/fixtures/canonical-scouting-json/invalid-missing-schema-fields.schema.json"), "utf8"),
    eventModel,
    activeEventKey: "2026chcmp",
    existingSubmissions: [],
  });

  assert.equal(preview.ok, false);
  assert.ok(preview.errors.some((error) => error.includes("schema.expectedScoutingFields must be an array")));
});

runTest("previewScoutingJsonImport flags duplicate rows by canonical event, match, and team identity", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-source-utils.js", "src/scouting-json-schema.js", "src/scouting-json-import.js"]);
  const season2026 = context.LegacyGameDefinitions["2026"];
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
  const season2026 = context.LegacyGameDefinitions["2026"];
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
  const season2026 = context.LegacyGameDefinitions["2026"];
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
        expectedScoutingFields: ["autoFuelPct", "customDriverTag"],
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
        expectedScoutingFields: ["autoFuelPct", "customDriverTag"],
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
  const season2026 = context.LegacyGameDefinitions["2026"];
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

runTest("previewScoutingJsonImport rejects contextual fields at the top level of entries", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-source-utils.js", "src/scouting-json-schema.js", "src/scouting-json-import.js"]);
  const season2026 = context.LegacyGameDefinitions["2026"];
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
          scoutUser: "Top Level Scout",
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

  assert.equal(preview.ok, false);
  assert.ok(preview.errors.some((error) => error.includes("must store scoutUser inside rawMetrics")));
});

runTest("previewScoutingJsonImport surfaces profile equations from schema artifacts", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-source-utils.js", "src/scouting-json-schema.js", "src/scouting-json-import.js"]);
  const season2026 = context.LegacyGameDefinitions["2026"];
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
          entryId: "profile-1",
          matchNumber: 1,
          teamNumber: 686,
          alliance: "red",
          rawMetrics: { autoFuelPct: 80, scoutUser: "Scout A", station: "1" },
        },
      ],
    }),
    schemaJsonText: JSON.stringify({
      meta: {
        format: "frc-scouting-analysis/v1",
        templateProfileId: "canonical-json-v1",
        profileLabel: "Canonical JSON",
      },
      schema: context.ScoutingJsonSchema.buildCanonicalSchemaForEventModel(eventModel),
      profile: {
        id: "canonical-json-v1",
        label: "Canonical JSON",
        derivedEquations: [
          { name: "scoutingTotal", formula: "scouting.auto + scouting.cycle + scouting.endgame" },
        ],
      },
    }),
    eventModel,
    activeEventKey: "2026chcmp",
    existingSubmissions: [],
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.summary.profileDefinition.id, "canonical-json-v1");
  assert.equal(preview.summary.profileDefinition.derivedEquations.length, 1);
  assert.equal(preview.summary.profileDefinition.derivedEquations[0].name, "scoutingTotal");
  assert.equal("filters" in preview.summary.profileDefinition, false);
});
