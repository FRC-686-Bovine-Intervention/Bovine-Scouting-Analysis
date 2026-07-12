import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

function loadBrowserContext(relativePaths) {
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
  };
  context.globalThis = context;
  relativePaths.forEach((relativePath) => {
    const sourcePath = path.resolve(relativePath);
    const source = fs.readFileSync(sourcePath, "utf8");
    vm.runInNewContext(source, context, { filename: sourcePath });
  });
  return context;
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

function metricValueFromId(team, metricId) {
  if (metricId.startsWith("source:")) {
    const [, sourceId, componentId] = metricId.split(":");
    if (componentId === "total") return Number(team.sources?.[sourceId]?.total || 0);
    return Number(team.sources?.[sourceId]?.components?.[componentId] || 0);
  }
  if (metricId.startsWith("derived:")) return Number(team.derived?.[metricId.slice("derived:".length)] || 0);
  throw new Error(`Unsupported comparison metric id: ${metricId}`);
}

function parseSpreadsheetNumber(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized === "#DIV/0!") return null;
  const numeric = Number(normalized.replace(/%$/, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function detectHeaderRow(rows) {
  return rows.findIndex((row) => String(row[0] || "").trim() === "Team #");
}

function rowsToObjects(rows, headerRowIndex) {
  const headers = rows[headerRowIndex] || [];
  return rows
    .slice(headerRowIndex + 1)
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? "").trim()])));
}

const context = loadBrowserContext([
  "src/season-framework.js",
  "src/metric-engine.js",
  "src/scouting-source-utils.js",
  "src/scouting-json-schema.js",
  "src/scouting-json-import.js",
  "src/event-model-builder.js",
  "src/real-event-snapshots.js",
  "src/real-event-data.js",
  "src/import-foundation.js",
  "src/sheet-import-adapters.js",
]);

const metricEngine = context.MetricEngine;
const seasonFramework = context.SeasonFramework;
const scoutingJsonImport = context.ScoutingJsonImport;
const importFoundation = context.ImportFoundation;
const sheetImportAdapters = context.SheetImportAdapters;
const eventCatalog = context.eventCatalog;

const migrationFixtures = [
  {
    eventKey: "2024mdsev",
    season: 2024,
    canonicalFixturePath: "tests/fixtures/canonical-scouting-datasets/2024mdsev.json",
    rawSheetPath: "src/real-source-cache/2024mdsev-sheet.csv",
    representativeMetrics: [
      { teamNumber: 686, metricId: "derived:autoSpeakerAccuracy", tolerance: 0.001 },
      { teamNumber: 9072, metricId: "source:scouter:autoSpeakerMade", tolerance: 0.001 },
      { teamNumber: 1629, metricId: "source:scouter:teleSpeakerMade", tolerance: 0.001 },
    ],
  },
  {
    eventKey: "2025chcmp",
    season: 2025,
    canonicalFixturePath: "tests/fixtures/canonical-scouting-datasets/2025chcmp.json",
    teamCalculationsPath: "tests/fixtures/2025 CHS DCMP Scouting Analysis - TeamCalculations.csv",
    representativeTeams: [
      {
        teamNumber: 3136,
        comparisons: [{ metricId: "derived:driverPerformanceAvg", column: "Driver Performance", tolerance: 0.11 }],
      },
      {
        teamNumber: 122,
        comparisons: [{ metricId: "derived:driverPerformanceAvg", column: "Driver Performance Recent", tolerance: 0.11, window: "recent" }],
      },
      {
        teamNumber: 401,
        comparisons: [{ metricId: "derived:driverPerformanceAvg", column: "Driver Performance Recent", tolerance: 0.11, window: "recent" }],
      },
    ],
  },
  {
    eventKey: "2026chcmp",
    season: 2026,
    canonicalFixturePath: "tests/fixtures/canonical-scouting-datasets/2026chcmp.json",
    teamCalculationsPath: "tests/fixtures/2026 Scouting Analysis CHCMP - TeamCalculations.csv",
    representativeTeams: [
      {
        teamNumber: 4638,
        comparisons: [
          { metricId: "derived:overallShooterAvg", column: "Shooter Performance Average Score Overall", tolerance: 0.11 },
          { metricId: "derived:overallDriverAvg", column: "Driver Performance Average Score Overall", tolerance: 0.11 },
          { metricId: "derived:overallShooterAvg", column: "Shooter Performance Average Score Recent", tolerance: 0.11, window: "recent" },
          { metricId: "derived:overallDriverAvg", column: "Driver Performance Average Score Recent", tolerance: 0.11, window: "recent" },
        ],
      },
      {
        teamNumber: 1262,
        comparisons: [
          { metricId: "derived:overallShooterAvg", column: "Shooter Performance Average Score Recent", tolerance: 0.11, window: "recent" },
          { metricId: "derived:overallDriverAvg", column: "Driver Performance Average Score Recent", tolerance: 0.11, window: "recent" },
        ],
      },
      {
        teamNumber: 2537,
        comparisons: [
          { metricId: "derived:overallShooterAvg", column: "Shooter Performance Average Score Recent", tolerance: 0.11, window: "recent" },
          { metricId: "derived:overallDriverAvg", column: "Driver Performance Average Score Recent", tolerance: 0.11, window: "recent" },
        ],
      },
    ],
  },
];

migrationFixtures.forEach((fixture) => {
  runTest(`${fixture.eventKey} canonical fixture imports successfully`, () => {
    const eventModel = eventCatalog.find((event) => event.key === fixture.eventKey);
    assert.ok(eventModel, `Event ${fixture.eventKey} should exist`);
    assert.equal(eventModel.season, fixture.season);

    const jsonText = fs.readFileSync(path.resolve(fixture.canonicalFixturePath), "utf8");
    const preview = scoutingJsonImport.previewScoutingJsonImport({
      jsonText,
      eventModel,
      activeEventKey: fixture.eventKey,
      existingSubmissions: [],
    });

    assert.equal(preview.ok, true, (preview.errors || []).join("; "));
    assert.ok(preview.summary?.submissions?.length, `Canonical fixture should produce submissions for ${fixture.eventKey}`);
  });
});

runTest("2024mdsev canonical fixture preserves representative outputs from the legacy adapted import path", () => {
  const fixture = migrationFixtures.find((candidate) => candidate.eventKey === "2024mdsev");
  const eventModel = eventCatalog.find((event) => event.key === fixture.eventKey);
  const rawSheetCsv = fs.readFileSync(path.resolve(fixture.rawSheetPath), "utf8");
  const adaptedCsv = sheetImportAdapters.adaptEventSheetCsv(eventModel, rawSheetCsv);
  const legacyPreview = importFoundation.previewScoutingImport({
    csvText: adaptedCsv,
    eventModel,
    activeEventKey: fixture.eventKey,
    existingSubmissions: [],
  });
  const canonicalPreview = scoutingJsonImport.previewScoutingJsonImport({
    jsonText: fs.readFileSync(path.resolve(fixture.canonicalFixturePath), "utf8"),
    eventModel,
    activeEventKey: fixture.eventKey,
    existingSubmissions: [],
  });

  assert.equal(legacyPreview.ok, true);
  assert.equal(canonicalPreview.ok, true);
  assert.equal(canonicalPreview.summary.submissions.length, legacyPreview.summary.submissions.length);

  const legacyOverlaysByTeam = new Map(
    eventModel.teams.map((team) => [
      team.number,
      metricEngine.buildTeamScoutingOverlay(team, {
        submissions: legacyPreview.summary.submissions,
        scoringComponents: eventModel.scoringComponents,
        scouterMetricDefinitions: seasonFramework.scouterMetricDefinitions(eventModel),
        derivedMetricDefinitions: seasonFramework.derivedMetricDefinitions(eventModel),
      }),
    ]),
  );
  const canonicalOverlaysByTeam = new Map(
    eventModel.teams.map((team) => [
      team.number,
      metricEngine.buildTeamScoutingOverlay(team, {
        submissions: canonicalPreview.summary.submissions,
        scoringComponents: eventModel.scoringComponents,
        scouterMetricDefinitions: seasonFramework.scouterMetricDefinitions(eventModel),
        derivedMetricDefinitions: seasonFramework.derivedMetricDefinitions(eventModel),
      }),
    ]),
  );

  fixture.representativeMetrics.forEach((comparison) => {
    const legacyOverlay = legacyOverlaysByTeam.get(comparison.teamNumber);
    const canonicalOverlay = canonicalOverlaysByTeam.get(comparison.teamNumber);
    const legacyValue = metricValueFromId(legacyOverlay, comparison.metricId);
    const canonicalValue = metricValueFromId(canonicalOverlay, comparison.metricId);
    assert.ok(
      Math.abs(legacyValue - canonicalValue) <= comparison.tolerance,
      `${comparison.metricId} for team ${comparison.teamNumber}: expected ${legacyValue}, got ${canonicalValue}`,
    );
  });
});

[migrationFixtures[1], migrationFixtures[2]].forEach((fixture) => {
  runTest(`${fixture.eventKey} canonical fixture reproduces representative TeamCalculations outputs`, () => {
    const eventModel = eventCatalog.find((event) => event.key === fixture.eventKey);
    const preview = scoutingJsonImport.previewScoutingJsonImport({
      jsonText: fs.readFileSync(path.resolve(fixture.canonicalFixturePath), "utf8"),
      eventModel,
      activeEventKey: fixture.eventKey,
      existingSubmissions: [],
    });
    assert.equal(preview.ok, true, (preview.errors || []).join("; "));

    const overlaysByTeam = new Map(
      eventModel.teams.map((team) => [
        team.number,
        metricEngine.buildTeamScoutingOverlay(team, {
          submissions: preview.summary.submissions,
          scoringComponents: eventModel.scoringComponents,
          scouterMetricDefinitions: seasonFramework.scouterMetricDefinitions(eventModel),
          derivedMetricDefinitions: seasonFramework.derivedMetricDefinitions(eventModel),
          recentMatchCount: 4,
        }),
      ]),
    );

    const teamCalculationRows = sheetImportAdapters.parseCsvText(fs.readFileSync(path.resolve(fixture.teamCalculationsPath), "utf8"));
    const headerRowIndex = detectHeaderRow(teamCalculationRows);
    assert.ok(headerRowIndex >= 0, `Header row should be found in ${fixture.teamCalculationsPath}`);
    const rows = rowsToObjects(teamCalculationRows, headerRowIndex);
    const rowByTeam = new Map(rows.map((row) => [Number(row["Team #"]), row]));

    fixture.representativeTeams.forEach((teamFixture) => {
      const row = rowByTeam.get(teamFixture.teamNumber);
      const overlay = overlaysByTeam.get(teamFixture.teamNumber);
      assert.ok(row, `Representative team ${teamFixture.teamNumber} should exist`);
      assert.ok(overlay, `Representative team ${teamFixture.teamNumber} should exist in overlay`);
      teamFixture.comparisons.forEach((comparison) => {
        const expectedValue = parseSpreadsheetNumber(row[comparison.column]);
        assert.notEqual(expectedValue, null, `${comparison.column} should be numeric for team ${teamFixture.teamNumber}`);
        const target = comparison.window === "recent" ? { sources: overlay.recentWindow?.sources, derived: overlay.recentWindow?.derived } : overlay;
        const actual = metricValueFromId(target, comparison.metricId);
        assert.ok(
          Math.abs(actual - expectedValue) <= comparison.tolerance,
          `${fixture.eventKey} team ${teamFixture.teamNumber} ${comparison.metricId}: expected ${expectedValue}, got ${actual}, tolerance ${comparison.tolerance}`,
        );
      });
    });
  });
});
