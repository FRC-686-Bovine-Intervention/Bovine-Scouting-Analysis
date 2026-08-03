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

function buildEventModel(context) {
  const season2026 = context.LegacyGameDefinitions["2026"];
  return {
    ...season2026,
    season: 2026,
    key: "2026chcmp",
    seasonLabel: season2026.label,
    metrics: context.SeasonFramework.buildMetrics(season2026),
    criteriaSources: context.SeasonFramework.buildCriteriaSources(season2026),
  };
}

runTest("buildCanonicalSchemaForEventModel emits canonical field metadata for active event fields", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-json-schema.js"]);
  const eventModel = buildEventModel(context);
  const schema = context.ScoutingJsonSchema.buildCanonicalSchemaForEventModel(eventModel);
  const autoFuel = schema.expectedScoutingFields.find((field) => field === "autoFuelPct");
  const autoRole = schema.expectedScoutingFields.find((field) => field === "autoPrimaryRole");

  assert.equal(schema.schemaId, "2026-match-v1");
  assert.equal(autoFuel, "autoFuelPct");
  assert.equal(autoRole, "autoPrimaryRole");
});

runTest("buildCanonicalSchemaForEventModel uses event-owned field definitions without SeasonFramework", () => {
  const context = loadBrowserContext(["src/scouting-json-schema.js"]);
  const schema = context.ScoutingJsonSchema.buildCanonicalSchemaForEventModel({
    season: 2027,
    key: "2027demo",
    formulaFieldDefinitions: [
      { id: "autoCoral", label: "Auto Coral", unit: "count" },
      { id: "driverTag", label: "Driver Tag", unit: "text" },
    ],
  });

  assert.equal(schema.schemaId, "2027-match-v1");
  assert.equal(schema.expectedScoutingFields.some((field) => field === "autoCoral"), true);
  assert.equal(schema.expectedScoutingFields.some((field) => field === "driverTag"), true);
});

runTest("validateCanonicalSchema accepts fixture-backed canonical scouting JSON", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-json-schema.js"]);
  const eventModel = buildEventModel(context);
  const payload = JSON.parse(fs.readFileSync(path.resolve("tests/fixtures/canonical-scouting-json/valid-2026chcmp-match.entries.json"), "utf8"));
  const schemaPayload = JSON.parse(fs.readFileSync(path.resolve("tests/fixtures/canonical-scouting-json/valid-2026chcmp-match.schema.json"), "utf8"));
  const validation = context.ScoutingJsonSchema.validateCanonicalSchema(payload, eventModel, "2026chcmp", schemaPayload);

  assert.equal(validation.errors.length, 0);
  assert.equal(validation.schema.schemaId, "2026-match-v1");
  assert.equal(validation.profile.id, "canonical-json-v1");
  assert.equal(validation.schemaFieldMap.get("autoFuelPct").type, "number");
});

runTest("validateCanonicalSchema rejects missing schema.expectedScoutingFields with actionable errors", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-json-schema.js"]);
  const eventModel = buildEventModel(context);
  const payload = JSON.parse(fs.readFileSync(path.resolve("tests/fixtures/canonical-scouting-json/invalid-missing-schema-fields.entries.json"), "utf8"));
  const schemaPayload = JSON.parse(fs.readFileSync(path.resolve("tests/fixtures/canonical-scouting-json/invalid-missing-schema-fields.schema.json"), "utf8"));
  const validation = context.ScoutingJsonSchema.validateCanonicalSchema(payload, eventModel, "2026chcmp", schemaPayload);

  assert.equal(validation.errors.some((error) => error.includes("schema.expectedScoutingFields must be an array")), true);
});

runTest("validateCanonicalSchema accepts split entries and schema artifacts", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-json-schema.js"]);
  const eventModel = buildEventModel(context);
  const entriesPayload = {
    meta: {
      format: "frc-scouting-analysis/v1",
      season: 2026,
      eventKey: "2026chcmp",
      entryType: "match",
    },
    entries: [{ entryId: "split-1", matchNumber: 1, teamNumber: 686, alliance: "red", rawMetrics: { autoFuelPct: 80 } }],
  };
  const schemaPayload = {
    meta: {
      format: "frc-scouting-analysis/v1",
      templateProfileId: "canonical-json-v1",
    },
    schema: context.ScoutingJsonSchema.buildCanonicalSchemaForEventModel(eventModel),
  };
  const validation = context.ScoutingJsonSchema.validateCanonicalSchema(entriesPayload, eventModel, "2026chcmp", schemaPayload);

  assert.equal(validation.errors.length, 0);
  assert.equal(validation.schemaMeta.templateProfileId, "canonical-json-v1");
  assert.equal(validation.profile.id, "canonical-json-v1");
  assert.equal(validation.entries.length, 1);
});

runTest("validateCanonicalSchema infers contextual rawMetrics fields as string-backed when schema ids are bare strings", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-json-schema.js"]);
  const season2025 = context.LegacyGameDefinitions["2025"];
  const eventModel = {
    ...season2025,
    season: 2025,
    key: "2025chcmp",
    seasonLabel: season2025.label,
  };
  const entriesPayload = {
    meta: {
      format: "frc-scouting-analysis/v1",
      season: 2025,
      eventKey: "2025chcmp",
      entryType: "match",
    },
    entries: [{
      entryId: "entry-1",
      matchNumber: 1,
      teamNumber: 686,
      alliance: "blue",
      rawMetrics: {
        scoutUser: "Scout A",
        station: "1",
        defensePlayed: false,
        robotStatus: "ok",
        notes: "",
      },
    }],
  };
  const schemaPayload = {
    meta: {
      format: "frc-scouting-analysis/v1",
      templateProfileId: "canonical-json-v1",
    },
    schema: {
      schemaId: "2025-match-v1",
      expectedScoutingFields: ["scoutUser", "station", "defensePlayed", "robotStatus", "notes"],
    },
  };
  const validation = context.ScoutingJsonSchema.validateCanonicalSchema(entriesPayload, eventModel, "2025chcmp", schemaPayload);

  assert.equal(validation.errors.length, 0);
  assert.equal(validation.schemaFieldMap.get("scoutUser").type, "string");
  assert.equal(validation.schemaFieldMap.get("station").type, "string");
  assert.equal(validation.schemaFieldMap.get("defensePlayed").type, "string");
  assert.equal(validation.schemaFieldMap.get("robotStatus").type, "string");
  assert.equal(validation.schemaFieldMap.get("notes").type, "string");
});

runTest("validateCanonicalSchema rejects contextual fields at the top level of entries", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-json-schema.js"]);
  const eventModel = buildEventModel(context);
  const entriesPayload = {
    meta: {
      format: "frc-scouting-analysis/v1",
      season: 2026,
      eventKey: "2026chcmp",
      entryType: "match",
    },
    entries: [{
      entryId: "split-1",
      matchNumber: 1,
      teamNumber: 686,
      alliance: "red",
      scoutUser: "Top Level Scout",
      rawMetrics: { autoFuelPct: 80, scoutUser: "Payload Scout", station: "1" },
    }],
  };
  const schemaPayload = {
    meta: {
      format: "frc-scouting-analysis/v1",
      templateProfileId: "canonical-json-v1",
    },
    schema: context.ScoutingJsonSchema.buildCanonicalSchemaForEventModel(eventModel),
  };
  const validation = context.ScoutingJsonSchema.validateCanonicalSchema(entriesPayload, eventModel, "2026chcmp", schemaPayload);

  assert.equal(validation.errors.some((error) => error.includes("must store scoutUser inside rawMetrics")), true);
});
