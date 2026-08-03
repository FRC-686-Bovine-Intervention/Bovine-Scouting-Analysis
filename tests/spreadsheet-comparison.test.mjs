import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { legacyGameDefinitions } from "./fixtures/legacy-game-definitions.mjs";

function loadBrowserContext(relativePaths) {
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

const browserContext = loadBrowserContext([
  "src/legacy-scouting-schema-seeds.js",
  "src/season-framework.js",
  "src/metric-engine.js",
  "src/real-event-snapshots.js",
  "src/real-event-data.js",
  "src/scouting-source-utils.js",
  "src/scouting-json-schema.js",
  "src/scouting-json-import.js",
  "src/import-foundation.js",
  "src/sheet-import-adapters.js",
]);
const metricEngine = browserContext.MetricEngine;
const seasonFramework = browserContext.SeasonFramework;
const importFoundation = browserContext.ImportFoundation;
const scoutingJsonImport = browserContext.ScoutingJsonImport;
const sheetImportAdapters = browserContext.SheetImportAdapters;
const eventCatalog = browserContext.eventCatalog;
const fixtures = JSON.parse(fs.readFileSync(path.resolve("tests/spreadsheet-comparison-fixtures.json"), "utf8"));

fixtures.forEach((fixture) => {
  runTest(`${fixture.name} (${fixture.provenance}${fixture.sheetTab ? ` / ${fixture.sheetTab}` : ""})`, () => {
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

    Object.entries(fixture.expectedMetrics).forEach(([metricId, expectedValue]) => {
      const actual = metricValueFromId(overlay, metricId);
      const tolerance = Number(fixture.tolerance ?? 0.001);
      assert.ok(
        Math.abs(actual - expectedValue) <= tolerance,
        `${fixture.name} ${metricId}: expected ${expectedValue}, got ${actual}, tolerance ${tolerance}`,
      );
    });
  });
});

[
  {
    name: "2025 TeamCalculations aggregate verification",
    eventKey: "2025chcmp",
    season: 2025,
    recentMatchCount: 4,
    rawSheetPath: "src/real-source-cache/2025chcmp-sheet.csv",
    teamCalculationsPath: "tests/fixtures/2025 CHS DCMP Scouting Analysis - TeamCalculations.csv",
    requiredColumns: [
      "Auto Trough %",
      "Auto L2 %",
      "Auto L3 %",
      "Auto L4 %",
      "Tele-Op Trough %",
      "Tele-Op L2 %",
      "Tele-Op L3 %",
      "Tele-Op L4 %",
      "Driver Performance",
      "Driver Performance Recent",
    ],
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
    name: "2026 TeamCalculations aggregate verification",
    eventKey: "2026chcmp",
    season: 2026,
    recentMatchCount: 4,
    rawSheetPath: "src/real-source-cache/2026chcmp-sheet.csv",
    teamCalculationsPath: "tests/fixtures/2026 Scouting Analysis CHCMP - TeamCalculations.csv",
    requiredColumns: [
      "Shooter Performance Average Score Overall",
      "Passer Performance Average Score Overall",
      "Intake Performance Average Score Overall",
      "Defense Avoidance Average Score Overall",
      "Defender Performance Average Score Overall",
      "Driver Performance Average Score Overall",
      "Shooter Performance Average Score Recent",
      "Driver Performance Average Score Recent",
    ],
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
].forEach((fixture) => {
  runTest(fixture.name, () => {
    const eventModel = eventCatalog.find((event) => event.key === fixture.eventKey);
    const seasonDefinition = legacyGameDefinitions[fixture.season];
    assert.ok(eventModel, `Event ${fixture.eventKey} should exist`);
    assert.equal(eventModel.season, fixture.season);

    const rawSheetCsv = fs.readFileSync(path.resolve(fixture.rawSheetPath), "utf8");
    const translated = sheetImportAdapters.translateEventSheetToCanonical(eventModel, rawSheetCsv);
    const preview = scoutingJsonImport.previewScoutingJsonImport({
      jsonText: sheetImportAdapters.buildCanonicalJsonText(translated),
      eventModel,
      activeEventKey: fixture.eventKey,
      existingSubmissions: [],
      profileId: translated.templateProfileId,
      profileLabel: translated.profileLabel,
      translationVersion: translated.translatorVersion,
    });
    assert.ok(preview.ok, `Import preview should succeed for ${fixture.eventKey}: ${(preview.errors || []).join("; ")}`);
    assert.ok(preview.summary?.submissions?.length, `Import preview should produce submissions for ${fixture.eventKey}`);

    const submissions = preview.summary.submissions;
    const overlaysByTeam = new Map(
      eventModel.teams.map((team) => [
        team.number,
        metricEngine.buildTeamScoutingOverlay(team, {
          submissions,
          scoringComponents: eventModel.scoringComponents,
          scouterMetricDefinitions: seasonFramework.scouterMetricDefinitions(seasonDefinition),
          derivedMetricDefinitions: seasonFramework.derivedMetricDefinitions(seasonDefinition),
          recentMatchCount: fixture.recentMatchCount || 4,
        }),
      ]),
    );

    const teamCalculationRows = sheetImportAdapters.parseCsvText(fs.readFileSync(path.resolve(fixture.teamCalculationsPath), "utf8"));
    const headerRowIndex = detectHeaderRow(teamCalculationRows);
    assert.ok(headerRowIndex >= 0, `Header row should be found in ${fixture.teamCalculationsPath}`);
    const rows = rowsToObjects(teamCalculationRows, headerRowIndex);
    const headers = teamCalculationRows[headerRowIndex] || [];
    fixture.requiredColumns.forEach((column) => {
      assert.ok(headers.includes(column), `${column} should exist in ${fixture.teamCalculationsPath}`);
    });

    const rowByTeam = new Map(rows.map((row) => [Number(row["Team #"]), row]));
    const overlappingTeams = eventModel.teams.filter((team) => rowByTeam.has(team.number)).length;
    assert.ok(overlappingTeams > 0, `TeamCalculations export should overlap event teams for ${fixture.eventKey}`);

    fixture.representativeTeams.forEach((teamFixture) => {
      const row = rowByTeam.get(teamFixture.teamNumber);
      assert.ok(row, `Representative team ${teamFixture.teamNumber} should exist in ${fixture.teamCalculationsPath}`);
      const overlay = overlaysByTeam.get(teamFixture.teamNumber);
      assert.ok(overlay, `Representative team ${teamFixture.teamNumber} should exist in overlay for ${fixture.eventKey}`);
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
