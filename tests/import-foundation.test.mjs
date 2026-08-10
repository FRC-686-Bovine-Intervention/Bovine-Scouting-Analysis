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

runTest("commitScoutingImport can replace existing submissions for source-of-truth imports", () => {
  const context = loadBrowserContext(["src/scouting-source-utils.js", "src/import-foundation.js"]);
  const existingSubmissions = [{ id: "old-1", teamNumber: 686, matchNumber: 1 }];
  const preview = {
    ok: true,
    summary: {
      newRows: 2,
      duplicateGroups: 0,
      confidenceImpactTeams: 0,
      metadata: { eventKey: "2025chcmp" },
      submissions: [
        { id: "new-1", teamNumber: 686, matchNumber: 10 },
        { id: "new-2", teamNumber: 686, matchNumber: 20 },
      ],
    },
  };

  const committed = context.ImportFoundation.commitScoutingImport({
    preview,
    existingSubmissions,
    existingActivity: [],
    replaceExisting: true,
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(committed.submissions.map((submission) => submission.id))),
    ["new-1", "new-2"],
  );
});

runTest("previewScoutingImport rejects an HTML response before it becomes scouting data", () => {
  const context = loadBrowserContext(["src/scouting-source-utils.js", "src/import-foundation.js"]);
  const preview = context.ImportFoundation.previewScoutingImport({
    csvText: "<!doctype html><html><head><script>window.p = {};</script></head><body>Access denied</body></html>",
    eventModel: { season: 2026, key: "2026chcmp", formulaFieldDefinitions: [] },
    activeEventKey: "2026chcmp",
  });

  assert.equal(preview.ok, false);
  assert.match(preview.errors[0], /HTML document instead of CSV/i);
});

runTest("previewScoutingImport uses event-owned field definitions without SeasonFramework", () => {
  const context = loadBrowserContext(["src/scouting-source-utils.js", "src/import-foundation.js"]);
  const eventModel = {
    season: 2027,
    key: "2027demo",
    seasonLabel: "2027 Demo",
    metrics: [{ id: "source:scouter:customCounter", label: "Scouting Custom Counter", unit: "count" }],
    criteriaSources: [{ id: "scouter", label: "Scouting", components: [{ id: "customCounter", label: "Custom Counter" }] }],
    formulaFieldDefinitions: [
      { id: "customCounter", label: "Custom Counter", unit: "count" },
      { id: "driverTag", label: "Driver Tag", unit: "text" },
    ],
    scouterMetricDefinitions: [
      { id: "customCounter", label: "Custom Counter", unit: "count" },
    ],
  };
  const csvText = [
    "meta,season,eventKey,schemaVersion,templateProfileId",
    "value,2027,2027demo,match-v3,custom-profile-v1",
    "",
    "matchNumber,teamNumber,scoutUser,alliance,station,defensePlayed,robotStatus,notes,customCounter,driverTag",
    "7,2537,Scout A,blue,2,no,ok,,3,steady",
  ].join("\n");

  const preview = context.ImportFoundation.previewScoutingImport({
    csvText,
    eventModel,
    activeEventKey: "2027demo",
    existingSubmissions: [],
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.summary.submissions[0].rawMetrics.customCounter, 3);
  assert.equal(preview.summary.submissions[0].rawMetrics.driverTag, "steady");
  assert.deepEqual(
    JSON.parse(JSON.stringify(preview.summary.schemaFields.map((field) => field.id))),
    ["customCounter", "driverTag"],
  );
});

runTest("previewScoutingImport preserves raw strings and warns on type outliers", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-source-utils.js", "src/import-foundation.js"]);
  const season2026 = context.LegacyGameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2026,
    key: "2026chcmp",
    seasonLabel: season2026.label,
    metrics: context.SeasonFramework.buildMetrics(season2026),
    criteriaSources: context.SeasonFramework.buildCriteriaSources(season2026),
  };
  const metricHeaders = context.SeasonFramework.formulaFieldDefinitions(eventModel).map((metricDefinition) =>
    context.SeasonFramework.csvHeaderForMetric(metricDefinition));
  const headerRow = ["matchNumber", "teamNumber", "scoutUser", "alliance", "station", "defensePlayed", "robotStatus", "notes", ...metricHeaders];
  const emptyMetricRow = Object.fromEntries(metricHeaders.map((header) => [header, ""]));
  const buildRow = (baseValues, metricValues) => {
    const merged = { ...emptyMetricRow, ...metricValues };
    return [
      baseValues.matchNumber,
      baseValues.teamNumber,
      baseValues.scoutUser,
      baseValues.alliance,
      baseValues.station,
      baseValues.defensePlayed,
      baseValues.robotStatus,
      baseValues.notes,
      ...metricHeaders.map((header) => merged[header]),
    ].join(",");
  };
  const csvText = [
    "meta,season,eventKey,schemaVersion,templateProfileId",
    "value,2026,2026chcmp,match-v2,match-current-v2",
    "",
    headerRow.join(","),
    buildRow({ matchNumber: 1, teamNumber: 111, scoutUser: "Scout A", alliance: "Blue", station: 1, defensePlayed: "no", robotStatus: "ok", notes: "" }, { autoFuelPct: 40, autoPrimaryRole: "Score", overallDriver: 4 }),
    buildRow({ matchNumber: 2, teamNumber: 222, scoutUser: "Scout B", alliance: "Blue", station: 2, defensePlayed: "no", robotStatus: "ok", notes: "" }, { autoFuelPct: 35, autoPrimaryRole: "Defense", overallDriver: 3 }),
    buildRow({ matchNumber: 4, teamNumber: 444, scoutUser: "Scout D", alliance: "Blue", station: 1, defensePlayed: "no", robotStatus: "ok", notes: "" }, { autoFuelPct: 30, autoPrimaryRole: "Score", overallDriver: 4 }),
    buildRow({ matchNumber: 5, teamNumber: 555, scoutUser: "Scout E", alliance: "Blue", station: 2, defensePlayed: "no", robotStatus: "ok", notes: "" }, { autoFuelPct: 25, autoPrimaryRole: "Score", overallDriver: 4 }),
    buildRow({ matchNumber: 6, teamNumber: 666, scoutUser: "Scout F", alliance: "Blue", station: 3, defensePlayed: "no", robotStatus: "ok", notes: "" }, { autoFuelPct: 20, autoPrimaryRole: "Score", overallDriver: 4 }),
    buildRow({ matchNumber: 7, teamNumber: 777, scoutUser: "Scout G", alliance: "Blue", station: 1, defensePlayed: "no", robotStatus: "ok", notes: "" }, { autoFuelPct: 15, autoPrimaryRole: "Score", overallDriver: 4 }),
    buildRow({ matchNumber: 8, teamNumber: 888, scoutUser: "Scout H", alliance: "Blue", station: 2, defensePlayed: "no", robotStatus: "ok", notes: "" }, { autoFuelPct: 10, autoPrimaryRole: "Score", overallDriver: 4 }),
    buildRow({ matchNumber: 9, teamNumber: 999, scoutUser: "Scout I", alliance: "Blue", station: 3, defensePlayed: "no", robotStatus: "ok", notes: "" }, { autoFuelPct: 5, autoPrimaryRole: "Score", overallDriver: 4 }),
    buildRow({ matchNumber: 10, teamNumber: 1010, scoutUser: "Scout J", alliance: "Blue", station: 1, defensePlayed: "no", robotStatus: "ok", notes: "" }, { autoFuelPct: 12, autoPrimaryRole: "Score", overallDriver: 4 }),
    buildRow({ matchNumber: 3, teamNumber: 333, scoutUser: "Scout C", alliance: "Blue", station: 3, defensePlayed: "no", robotStatus: "ok", notes: "" }, { autoFuelPct: "abc", autoPrimaryRole: "Score", overallDriver: 5 }),
  ].join("\n");

  const preview = context.ImportFoundation.previewScoutingImport({
    csvText,
    eventModel,
    activeEventKey: "2026chcmp",
    existingSubmissions: [],
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.summary.submissions[0].rawMetrics.autoPrimaryRole, "Score");
  assert.equal(preview.summary.submissions.find((submission) => submission.teamNumber === 333).rawMetrics.autoFuelPct, "abc");
  assert.equal(preview.summary.submissions[0].provenance.mode, "csv-import");
  assert.equal(preview.summary.submissions[0].provenance.sourceRowNumber, 1);
  assert.equal(preview.summary.submissions[0].provenance.templateProfileId, "match-current-v2");
  assert.ok(preview.warnings.some((warning) => warning.includes("Auto Fuel %") && warning.includes("most of that column is number")));
});

runTest("season sheet adapters preserve blank subjective ratings as missing values", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-source-utils.js", "src/sheet-import-adapters.js", "src/import-foundation.js"]);
  const season2026 = context.LegacyGameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2026,
    key: "2026chcmp",
    seasonLabel: season2026.label,
    metrics: context.SeasonFramework.buildMetrics(season2026),
    criteriaSources: context.SeasonFramework.buildCriteriaSources(season2026),
  };
  const rawSheetCsv = [
    "Shifts Auto Primary Role,Shifts Auto Secondary Role,Shifts Auto Fuel Pct,Shifts Auto Starting Position,Shifts Auto Climb,Shifts Transition Primary Role,Shifts Transition Secondary Role,Shifts Transition Fuel Pct,Shifts Transition Defense On,Shifts Shift1 Primary Role,Shifts Shift1 Secondary Role,Shifts Shift1 Fuel Pct,Shifts Shift1 Defense On,Shifts Shift2 Primary Role,Shifts Shift2 Secondary Role,Shifts Shift2 Fuel Pct,Shifts Shift2 Defense On,Shifts Shift3 Primary Role,Shifts Shift3 Secondary Role,Shifts Shift3 Fuel Pct,Shifts Shift3 Defense On,Shifts Shift4 Primary Role,Shifts Shift4 Secondary Role,Shifts Shift4 Fuel Pct,Shifts Shift4 Defense On,Shifts Endgame Primary Role,Shifts Endgame Secondary Role,Shifts Endgame Fuel Pct,Shifts Endgame Defense On,Shifts Endgame Climb,_id,_uuid,__v,Alliance,Created At,Event Key,Match Key,Match Number,No Show,Overall Defense Avoidance,Overall Defense,Overall Driver,Overall Intake,Overall Notes,Overall Passer,Overall Shooter,Scouter,Team Number,Updated At",
    "\"Score\",\"None\",\"20\",\"Hub\",\"Not Attempted\",\"Score\",\"None\",\"30\",\"None\",\"Score\",\"None\",\"30\",\"None\",\"Score\",\"None\",\"30\",\"None\",\"Score\",\"None\",\"30\",\"None\",\"Score\",\"None\",\"30\",\"None\",\"Score\",\"None\",\"20\",\"None\",\"Not Attempted\",\"1\",\"2\",\"\",\"red\",\"2026-04-10T20:22:54.392Z\",\"2026chcmp\",\"2026chcmp_qm25\",\"25\",\"\",\"\",\"\",\"3\",\"3\",\"\",\"\",\"\",\"Scout\",\"1262\",\"2026-04-10T20:22:54.392Z\"",
  ].join("\n");

  const adaptedCsv = context.SheetImportAdapters.adaptEventSheetCsv(eventModel, rawSheetCsv);
  const preview = context.ImportFoundation.previewScoutingImport({
    csvText: adaptedCsv,
    eventModel,
    activeEventKey: "2026chcmp",
    existingSubmissions: [],
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.summary.submissions[0].rawMetrics.overallShooter, null);
  assert.equal(preview.summary.submissions[0].rawMetrics.overallPasser, null);
  assert.equal(preview.summary.submissions[0].rawMetrics.overallDriver, 3);
});

runTest("season sheet adapters honor an explicit attachment profile in canonical metadata", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-source-utils.js", "src/sheet-import-adapters.js", "src/import-foundation.js"]);
  const season2026 = context.LegacyGameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2026,
    key: "2026chcmp",
    seasonLabel: season2026.label,
    sheet: {
      recommendedProfileId: "match-current-v2",
    },
    metrics: context.SeasonFramework.buildMetrics(season2026),
    criteriaSources: context.SeasonFramework.buildCriteriaSources(season2026),
  };
  const rawSheetCsv = [
    "Shifts Auto Primary Role,Shifts Auto Secondary Role,Shifts Auto Fuel Pct,Shifts Auto Starting Position,Shifts Auto Climb,Shifts Transition Primary Role,Shifts Transition Secondary Role,Shifts Transition Fuel Pct,Shifts Transition Defense On,Shifts Shift1 Primary Role,Shifts Shift1 Secondary Role,Shifts Shift1 Fuel Pct,Shifts Shift1 Defense On,Shifts Shift2 Primary Role,Shifts Shift2 Secondary Role,Shifts Shift2 Fuel Pct,Shifts Shift2 Defense On,Shifts Shift3 Primary Role,Shifts Shift3 Secondary Role,Shifts Shift3 Fuel Pct,Shifts Shift3 Defense On,Shifts Shift4 Primary Role,Shifts Shift4 Secondary Role,Shifts Shift4 Fuel Pct,Shifts Shift4 Defense On,Shifts Endgame Primary Role,Shifts Endgame Secondary Role,Shifts Endgame Fuel Pct,Shifts Endgame Defense On,Shifts Endgame Climb,_id,_uuid,__v,Alliance,Created At,Event Key,Match Key,Match Number,No Show,Overall Defense Avoidance,Overall Defense,Overall Driver,Overall Intake,Overall Notes,Overall Passer,Overall Shooter,Scouter,Team Number,Updated At",
    "\"Score\",\"None\",\"20\",\"Hub\",\"Not Attempted\",\"Score\",\"None\",\"30\",\"None\",\"Score\",\"None\",\"30\",\"None\",\"Score\",\"None\",\"30\",\"None\",\"Score\",\"None\",\"30\",\"None\",\"Score\",\"None\",\"30\",\"None\",\"Score\",\"None\",\"20\",\"None\",\"Not Attempted\",\"1\",\"2\",\"\",\"red\",\"2026-04-10T20:22:54.392Z\",\"2026chcmp\",\"2026chcmp_qm25\",\"25\",\"\",\"\",\"\",\"3\",\"3\",\"\",\"\",\"\",\"Scout\",\"1262\",\"2026-04-10T20:22:54.392Z\"",
  ].join("\n");

  const adaptedCsv = context.SheetImportAdapters.adaptEventSheetCsv(eventModel, rawSheetCsv, {
    templateProfileId: "match-legacy-v1",
  });
  const preview = context.ImportFoundation.previewScoutingImport({
    csvText: adaptedCsv,
    eventModel,
    activeEventKey: "2026chcmp",
    existingSubmissions: [],
    templateProfileId: "match-legacy-v1",
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.summary.metadata.schemaVersion, "match-v1");
  assert.equal(preview.summary.metadata.templateProfileId, "match-legacy-v1");
  assert.equal(preview.summary.metadata.translationVersion, "2026-thin-v2");
});

runTest("previewScoutingImport flags duplicate groups but keeps rows reviewable in the preview summary", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-source-utils.js", "src/import-foundation.js"]);
  const season2026 = context.LegacyGameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2026,
    key: "2026chcmp",
    seasonLabel: season2026.label,
    metrics: context.SeasonFramework.buildMetrics(season2026),
    criteriaSources: context.SeasonFramework.buildCriteriaSources(season2026),
  };
  const metricHeaders = context.SeasonFramework.formulaFieldDefinitions(eventModel).map((metricDefinition) =>
    context.SeasonFramework.csvHeaderForMetric(metricDefinition));
  const csvText = [
    "meta,season,eventKey,schemaVersion,templateProfileId",
    "value,2026,2026chcmp,match-v2,match-current-v2",
    "",
    ["matchNumber", "teamNumber", "scoutUser", "alliance", "station", "defensePlayed", "robotStatus", "notes", ...metricHeaders].join(","),
    ["12", "686", "Scout A", "Blue", "1", "no", "ok", "", ...metricHeaders.map((header) => (header === "autoFuelPct" ? "40" : ""))].join(","),
    ["12", "686", "Scout B", "Blue", "1", "no", "ok", "", ...metricHeaders.map((header) => (header === "autoFuelPct" ? "42" : ""))].join(","),
  ].join("\n");

  const preview = context.ImportFoundation.previewScoutingImport({
    csvText,
    eventModel,
    activeEventKey: "2026chcmp",
    existingSubmissions: [],
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.summary.duplicateGroups, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(preview.summary.duplicateGroupKeys)), ["2026chcmp:12:686"]);
  assert.equal(preview.summary.submissions.length, 2);
  assert.equal(preview.summary.submissions[0].validity, "flagged");
  assert.equal(preview.summary.submissions[1].validity, "flagged");
  assert.ok(preview.summary.submissions.every((submission) => submission.confidenceReasons.includes("duplicate_submission")));
});

runTest("previewScoutingImport still detects duplicates when helper scripts load after import-foundation", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/import-foundation.js", "src/scouting-source-utils.js"]);
  const season2026 = context.LegacyGameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2026,
    key: "2026chcmp",
    seasonLabel: season2026.label,
    metrics: context.SeasonFramework.buildMetrics(season2026),
    criteriaSources: context.SeasonFramework.buildCriteriaSources(season2026),
  };
  const metricHeaders = context.SeasonFramework.formulaFieldDefinitions(eventModel).map((metricDefinition) =>
    context.SeasonFramework.csvHeaderForMetric(metricDefinition));
  const csvText = [
    "meta,season,eventKey,schemaVersion,templateProfileId",
    "value,2026,2026chcmp,match-v2,match-current-v2",
    "",
    ["matchNumber", "teamNumber", "scoutUser", "alliance", "station", "defensePlayed", "robotStatus", "notes", ...metricHeaders].join(","),
    ["12", "686", "Scout A", "Blue", "1", "no", "ok", "", ...metricHeaders.map((header) => (header === "autoFuelPct" ? "40" : ""))].join(","),
    ["12", "686", "Scout B", "Blue", "1", "no", "ok", "", ...metricHeaders.map((header) => (header === "autoFuelPct" ? "42" : ""))].join(","),
  ].join("\n");

  const preview = context.ImportFoundation.previewScoutingImport({
    csvText,
    eventModel,
    activeEventKey: "2026chcmp",
    existingSubmissions: [],
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.summary.duplicateGroups, 1);
  assert.ok(preview.summary.submissions.every((submission) => submission.validity === "flagged"));
});

runTest("previewScoutingImport can fall back to generic field mapping when no profile matches", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-source-utils.js", "src/import-foundation.js"]);
  const season2026 = context.LegacyGameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2026,
    key: "2026chcmp",
    seasonLabel: season2026.label,
    metrics: context.SeasonFramework.buildMetrics(season2026),
    criteriaSources: context.SeasonFramework.buildCriteriaSources(season2026),
  };
  const csvText = [
    ["qual match", "team #", "observer", "color", "ds", "comments", "overall driver", "auto fuel pct"].join(","),
    ["12", "686", "Scout A", "Blue", "2", "Looked solid", "4", "40"].join(","),
  ].join("\n");

  const preview = context.ImportFoundation.previewScoutingImport({
    csvText,
    eventModel,
    activeEventKey: "2026chcmp",
    existingSubmissions: [],
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.summary.profileId, "");
  assert.equal(preview.summary.metadata.templateProfileId, "");
  assert.equal(preview.summary.submissions[0].teamNumber, 686);
  assert.equal(preview.summary.submissions[0].rawMetrics.overallDriver, 4);
  assert.equal(preview.summary.submissions[0].rawMetrics.autoFuelPct, 40);
  assert.equal(preview.summary.submissions[0].provenance.mode, "csv-import");
  assert.equal(preview.summary.submissions[0].provenance.sourceRowNumber, 1);
  assert.ok(preview.warnings.some((warning) => warning.includes("No importer profile matched")));
});

runTest("previewScoutingImport still flags missing required identity fields during generic fallback", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/scouting-source-utils.js", "src/import-foundation.js"]);
  const season2026 = context.LegacyGameDefinitions["2026"];
  const eventModel = {
    ...season2026,
    season: 2026,
    key: "2026chcmp",
    seasonLabel: season2026.label,
    metrics: context.SeasonFramework.buildMetrics(season2026),
    criteriaSources: context.SeasonFramework.buildCriteriaSources(season2026),
  };
  const csvText = [
    ["qual match", "observer", "color", "ds", "driver"].join(","),
    ["12", "Scout A", "Blue", "2", "4"].join(","),
  ].join("\n");

  const preview = context.ImportFoundation.previewScoutingImport({
    csvText,
    eventModel,
    activeEventKey: "2026chcmp",
    existingSubmissions: [],
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.summary.excludedRows, 1);
  assert.equal(preview.summary.submissions[0].validity, "excluded");
  assert.ok(preview.warnings.some((warning) => warning.includes("missing required identity fields")));
});
