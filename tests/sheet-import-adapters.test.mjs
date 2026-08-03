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

runTest("translateEventSheetToCanonical emits canonical dataset metadata and entries for 2026 sheets", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-json-schema.js", "src/sheet-import-adapters.js"]);
  const season2026 = context.LegacyGameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2026,
    key: "2026chcmp",
    seasonLabel: season2026.label,
    sheet: { recommendedProfileId: "match-current-v2" },
  };
  const rawSheetCsv = [
    "Shifts Auto Primary Role,Shifts Auto Secondary Role,Shifts Auto Fuel Pct,Shifts Auto Starting Position,Shifts Auto Climb,Shifts Transition Primary Role,Shifts Transition Secondary Role,Shifts Transition Fuel Pct,Shifts Transition Defense On,Shifts Shift1 Primary Role,Shifts Shift1 Secondary Role,Shifts Shift1 Fuel Pct,Shifts Shift1 Defense On,Shifts Shift2 Primary Role,Shifts Shift2 Secondary Role,Shifts Shift2 Fuel Pct,Shifts Shift2 Defense On,Shifts Shift3 Primary Role,Shifts Shift3 Secondary Role,Shifts Shift3 Fuel Pct,Shifts Shift3 Defense On,Shifts Shift4 Primary Role,Shifts Shift4 Secondary Role,Shifts Shift4 Fuel Pct,Shifts Shift4 Defense On,Shifts Endgame Primary Role,Shifts Endgame Secondary Role,Shifts Endgame Fuel Pct,Shifts Endgame Defense On,Shifts Endgame Climb,_id,_uuid,__v,Alliance,Created At,Event Key,Match Key,Match Number,No Show,Overall Defense Avoidance,Overall Defense,Overall Driver,Overall Intake,Overall Notes,Overall Passer,Overall Shooter,Scouter,Team Number,Updated At",
    "\"Score\",\"None\",\"20\",\"Hub\",\"Not Attempted\",\"Score\",\"None\",\"30\",\"None\",\"Score\",\"None\",\"30\",\"None\",\"Score\",\"None\",\"30\",\"None\",\"Score\",\"None\",\"30\",\"None\",\"Score\",\"None\",\"30\",\"None\",\"Score\",\"None\",\"20\",\"None\",\"Not Attempted\",\"1\",\"2\",\"\",\"red\",\"2026-04-10T20:22:54.392Z\",\"2026chcmp\",\"2026chcmp_qm25\",\"25\",\"\",\"\",\"\",\"3\",\"3\",\"\",\"\",\"\",\"Scout\",\"1262\",\"2026-04-10T20:22:54.392Z\"",
  ].join("\n");

  const dataset = context.SheetImportAdapters.translateEventSheetToCanonical(eventModel, rawSheetCsv, {
    templateProfileId: "match-legacy-v1",
  });

  assert.equal(dataset.meta.format, "frc-scouting-analysis/v1");
  assert.equal(dataset.schemaMeta.templateProfileId, "match-legacy-v1");
  assert.equal(dataset.schemaMeta.translationVersion, "2026-thin-v2");
  assert.equal(dataset.schema.schemaId, "match-v1");
  assert.equal(dataset.entries.length, 1);
  assert.equal(dataset.entries[0].teamNumber, 1262);
  assert.equal(dataset.entries[0].rawMetrics.autoPrimaryRole, "Score");
  assert.equal(dataset.entries[0].rawMetrics.overallShooter, null);
  assert.equal(dataset.entries[0].rawMetrics.scoutUser, "Scout");
  assert.equal(dataset.entries[0].rawMetrics.station, "Hub");
  assert.equal(dataset.entries[0].provenance.mode, "legacy-sheet-translation");
  assert.equal(dataset.entries[0].provenance.sourceRowNumber, 2);
  assert.equal(dataset.entries[0].provenance.translatorVersion, "2026-thin-v2");
  assert.equal(dataset.entries[0].provenance.collectedAt, "2026-04-10T20:22:54.392Z");
  assert.equal(dataset.entries[0].provenance.sourceMatchKey, "2026chcmp_qm25");
});

runTest("translateEventSheetToCanonical preserves extra legacy sheet columns as canonical raw metrics", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-json-schema.js", "src/sheet-import-adapters.js"]);
  const season2026 = context.LegacyGameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2026,
    key: "2026chcmp",
    seasonLabel: season2026.label,
    sheet: { recommendedProfileId: "match-current-v2" },
  };
  const rawSheetCsv = [
    "Match Number,Team Number,Scouter,Alliance,Overall Driver,Overall Notes,Custom Driver Tag,New Counter",
    "5,686,Scout A,red,4,Looked steady,calm,3",
  ].join("\n");

  const dataset = context.SheetImportAdapters.translateEventSheetToCanonical(eventModel, rawSheetCsv, {
    templateProfileId: "match-legacy-v1",
  });

  assert.equal(dataset.entries.length, 1);
  assert.equal(dataset.entries[0].matchNumber, 5);
  assert.equal(dataset.entries[0].teamNumber, 686);
  assert.equal(dataset.entries[0].rawMetrics.overallDriver, 4);
  assert.equal(dataset.entries[0].rawMetrics.customDriverTag, "calm");
  assert.equal(dataset.entries[0].rawMetrics.newCounter, 3);
  assert.ok(dataset.schema.expectedScoutingFields.some((field) => field === "customDriverTag"));
  assert.ok(dataset.schema.expectedScoutingFields.some((field) => field === "newCounter"));
});

runTest("translateEventSheetToCanonical can match a legacy adapter by headers even when season differs", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-json-schema.js", "src/sheet-import-adapters.js"]);
  const season2026 = context.LegacyGameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2027,
    key: "2027demo",
    seasonLabel: "2027 Demo",
    sheet: { recommendedProfileId: "match-current-v2" },
  };
  const rawSheetCsv = [
    "Shifts Auto Primary Role,Shifts Auto Secondary Role,Shifts Auto Fuel Pct,Shifts Auto Starting Position,Shifts Auto Climb,Shifts Transition Primary Role,Shifts Transition Secondary Role,Shifts Transition Fuel Pct,Shifts Transition Defense On,Shifts Shift1 Primary Role,Shifts Shift1 Secondary Role,Shifts Shift1 Fuel Pct,Shifts Shift1 Defense On,Shifts Shift2 Primary Role,Shifts Shift2 Secondary Role,Shifts Shift2 Fuel Pct,Shifts Shift2 Defense On,Shifts Shift3 Primary Role,Shifts Shift3 Secondary Role,Shifts Shift3 Fuel Pct,Shifts Shift3 Defense On,Shifts Shift4 Primary Role,Shifts Shift4 Secondary Role,Shifts Shift4 Fuel Pct,Shifts Shift4 Defense On,Shifts Endgame Primary Role,Shifts Endgame Secondary Role,Shifts Endgame Fuel Pct,Shifts Endgame Defense On,Shifts Endgame Climb,_id,_uuid,__v,Alliance,Created At,Event Key,Match Key,Match Number,No Show,Overall Defense Avoidance,Overall Defense,Overall Driver,Overall Intake,Overall Notes,Overall Passer,Overall Shooter,Scouter,Team Number,Updated At",
    "\"Score\",\"None\",\"20\",\"Hub\",\"Not Attempted\",\"Score\",\"None\",\"30\",\"None\",\"Score\",\"None\",\"30\",\"None\",\"Score\",\"None\",\"30\",\"None\",\"Score\",\"None\",\"30\",\"None\",\"Score\",\"None\",\"30\",\"None\",\"Score\",\"None\",\"20\",\"None\",\"Not Attempted\",\"1\",\"2\",\"\",\"red\",\"2026-04-10T20:22:54.392Z\",\"2027demo\",\"2027demo_qm25\",\"25\",\"\",\"\",\"\",\"3\",\"3\",\"\",\"\",\"\",\"Scout\",\"1262\",\"2026-04-10T20:22:54.392Z\"",
  ].join("\n");

  const dataset = context.SheetImportAdapters.translateEventSheetToCanonical(eventModel, rawSheetCsv);

  assert.equal(dataset.schemaMeta.translationVersion, "2026-thin-v2");
  assert.equal(dataset.entries.length, 1);
  assert.equal(dataset.entries[0].teamNumber, 1262);
  assert.equal(dataset.entries[0].rawMetrics.autoPrimaryRole, "Score");
  assert.equal(dataset.entries[0].provenance.mode, "legacy-sheet-translation");
});

runTest("legacy scoring-component backfill follows the matched adapter instead of event season", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-json-schema.js", "src/sheet-import-adapters.js"]);
  const season2025 = context.LegacyGameDefinitions["2025"];
  const eventModel = {
    ...season2025,
    season: 2027,
    key: "2027reefdemo",
    seasonLabel: "2027 Reef Demo",
    sheet: { recommendedProfileId: "match-current-v2" },
  };
  const rawSheetCsv = [
    "MatchNumber,Team Number,ScouterName,Alliiance,Alliance Index,Auto-L4Make,Auto-L3Make,Auto-L2Make,Auto-TroughMake,Auto-ScoredProcessorMake,Auto-ScoredBargeMake,Tele-Op-L4Make,Tele-Op-L3Make,Tele-Op-L2Make,Tele-Op-TroughMake,Tele-Op-ScoredProcessorMake,Tele-Op-ScoredBargeMake,Climbing,Notes",
    "9,686,Scout A,red,1,1,0,1,1,1,0,2,1,0,3,1,1,3,Strong finish",
  ].join("\n");

  const dataset = context.SheetImportAdapters.translateEventSheetToCanonical(eventModel, rawSheetCsv);

  assert.equal(dataset.schemaMeta.translationVersion, "2025-thin-v2");
  assert.equal(dataset.entries.length, 1);
  assert.equal(dataset.entries[0].rawMetrics.auto, 20);
  assert.equal(dataset.entries[0].rawMetrics.coral, 20);
  assert.equal(dataset.entries[0].rawMetrics.algae, 10);
  assert.equal(dataset.entries[0].rawMetrics.climb, 8);
});

runTest("translateEventSheetToCanonical falls back to generic canonical sheet conversion for unmapped headers", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-json-schema.js", "src/sheet-import-adapters.js"]);
  const season2026 = context.LegacyGameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2027,
    key: "2027demo",
    seasonLabel: season2026.label,
  };
  const rawSheetCsv = [
    "Match Number,Team Number,Scout User,Alliance,Station,Custom Driver Tag,Custom Auto Bursts",
    "7,2537,Scout B,blue,2,aggressive,5",
  ].join("\n");

  const dataset = context.SheetImportAdapters.translateEventSheetToCanonical(eventModel, rawSheetCsv);

  assert.equal(dataset.schemaMeta.templateProfileId, "canonical-json-v1");
  assert.equal(dataset.schemaMeta.translationVersion, "sheet-fallback-v1");
  assert.equal(dataset.entries.length, 1);
  assert.equal(dataset.entries[0].rawMetrics.scoutUser, "Scout B");
  assert.equal(dataset.entries[0].rawMetrics.customDriverTag, "aggressive");
  assert.equal(dataset.entries[0].rawMetrics.customAutoBursts, 5);
  assert.equal(dataset.entries[0].provenance.mode, "sheet-column-canonicalization");
});

runTest("translateEventSheetToCanonical can emit split entries and schema artifacts", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-json-schema.js", "src/sheet-import-adapters.js"]);
  const season2026 = context.LegacyGameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2026,
    key: "2026chcmp",
    seasonLabel: season2026.label,
  };
  const rawSheetCsv = [
    "Match Number,Team Number,Scout User,Alliance,Station,Custom Driver Tag",
    "7,2537,Scout B,blue,2,aggressive",
  ].join("\n");

  const dataset = context.SheetImportAdapters.translateEventSheetToCanonical(eventModel, rawSheetCsv);
  const entriesArtifact = JSON.parse(context.SheetImportAdapters.buildCanonicalEntriesJsonText(dataset));
  const schemaArtifact = JSON.parse(context.SheetImportAdapters.buildCanonicalSchemaJsonText(dataset));

  assert.deepEqual(Object.keys(entriesArtifact).sort(), ["entries", "meta"]);
  assert.deepEqual(Object.keys(schemaArtifact).sort(), ["meta", "profile", "schema"]);
  assert.equal(entriesArtifact.meta.eventKey, "2026chcmp");
  assert.equal(schemaArtifact.meta.templateProfileId, "canonical-json-v1");
  assert.equal(schemaArtifact.profile.id, "canonical-json-v1");
  assert.equal(entriesArtifact.entries[0].rawMetrics.scoutUser, "Scout B");
});
