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

runTest("commitScoutingImport can replace existing submissions for source-of-truth imports", () => {
  const context = loadBrowserContext(["src/import-foundation.js"]);
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

runTest("previewScoutingImport preserves raw strings and warns on type outliers", () => {
  const context = loadBrowserContext(["src/season-framework.js", "src/import-foundation.js"]);
  const season2026 = context.SeasonFramework.seasonDefinitions["2026"];
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
  assert.ok(preview.warnings.some((warning) => warning.includes("Auto Fuel %") && warning.includes("most of that column is number")));
});
