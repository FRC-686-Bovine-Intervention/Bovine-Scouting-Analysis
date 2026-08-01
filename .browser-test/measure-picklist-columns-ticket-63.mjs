import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "./node_modules/playwright/index.mjs";

const appUrl = "http://127.0.0.1:4174";
const fixture = JSON.parse(fs.readFileSync(
  "D:/FIRST/Scouting/Scouting-Analysis/tests/fixtures/canonical-scouting-datasets/2026chcmp.json",
  "utf8",
));
const schema = JSON.parse(fs.readFileSync(
  "D:/FIRST/Scouting/Scouting-Analysis/tests/fixtures/canonical-scouting-datasets/2026chcmp_profile-v1.json",
  "utf8",
));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(appUrl);
  await page.waitForLoadState("load");
  await page.locator("#existingUser").selectOption("Avery");
  await page.locator("#loginButton").click();
  await page.locator('[data-view="admin"]').click();
  await page.locator("#adminEventCodeInput").fill("2026chcmp");
  await page.locator("#adminEventCodeInput").press("Enter");
  await page.waitForTimeout(500);

  const result = await page.evaluate(({ fixturePayload, schemaPayload }) => {
    const eventModel = currentEvent();
    const preview = ScoutingJsonImport.previewScoutingJsonImport({
      jsonText: JSON.stringify(fixturePayload),
      schemaJsonText: JSON.stringify(schemaPayload),
      eventModel,
      activeEventKey: eventModel.key,
      existingSubmissions: [],
    });
    if (!preview.ok) throw new Error((preview.errors || []).join("; "));
    __scoutingAppState.importResult = preview;
    commitImportPreview();

    const metricId = orderedRankableMetrics()
      .find((metric) => metric.kind === "source" && metric.sourceId === "scouter")?.id;
    if (!metricId) throw new Error("Expected a scouting metric.");
    const metricIds = Array(4).fill(metricId);

    __scoutingAppState.activeView = "picklistBuilder";
    __scoutingAppState.picklistColumns = metricIds.map((id) => `metric:${id}`);
    __scoutingAppState.picklistColumnSortDirections = ["desc", "desc", "desc", "desc"];
    render();

    const expectedForDirection = (direction) => metricIds.map((metricId) => {
      const metric = metricById(metricId);
      return [...currentTeams()]
        .map((team) => ({ team, score: picklistMetricValue(team, metric) }))
        .sort((left, right) => {
          if (!Number.isFinite(left.score)) return Number.isFinite(right.score) ? 1 : left.team.number - right.team.number;
          if (!Number.isFinite(right.score)) return -1;
          return direction === "asc"
            ? left.score - right.score || left.team.number - right.team.number
            : right.score - left.score || left.team.number - right.team.number;
        })
        .map(({ team, score }) => ({ number: team.number, score: Number.isFinite(score) ? score.toFixed(1) : "-" }));
    });
    const expected = expectedForDirection("desc");
    const expectedAscending = expectedForDirection("asc");
    const displayed = [...document.querySelectorAll("[data-grid-column]")].map((column) =>
      [...column.querySelectorAll(".picklist-tile")].map((tile) => ({
        number: Number(tile.querySelector(".tile-label")?.textContent),
        score: String(tile.querySelector(".tile-score")?.textContent || "").trim(),
      })),
    );

    const samples = [];
    const originalPicklistMetricValue = picklistMetricValue;
    let builderMetricValueCalls = 0;
    picklistMetricValue = (...args) => {
      builderMetricValueCalls += 1;
      return originalPicklistMetricValue(...args);
    };
    renderPicklistBuilder();
    picklistMetricValue = originalPicklistMetricValue;
    let directMetricValueCalls = 0;
    picklistMetricValue = (...args) => {
      directMetricValueCalls += 1;
      return originalPicklistMetricValue(...args);
    };
    const metricValueCache = new Map();
    metricIds.forEach((metricId) => gridColumnModel(`metric:${metricId}`, { metricValueCache }));
    picklistMetricValue = originalPicklistMetricValue;
    for (let index = 0; index < 12; index += 1) {
      const startedAt = performance.now();
      render();
      samples.push(performance.now() - startedAt);
    }
    samples.sort((left, right) => left - right);
    return {
      metricIds,
      expected,
      expectedAscending,
      displayed,
      builderMetricValueCalls,
      directMetricValueCalls,
      medianRenderMs: Number(samples[Math.floor(samples.length / 2)].toFixed(1)),
      samplesMs: samples.map((sample) => Number(sample.toFixed(1))),
    };
  }, { fixturePayload: fixture, schemaPayload: schema });

  await page.locator('[data-grid-column="0"]').click({ button: "right" });
  await page.locator('button[data-grid-column-sort="0:asc"]').click();
  const ascendingColumn = await page.locator('[data-grid-column="0"] .picklist-tile').evaluateAll((tiles) =>
    tiles.map((tile) => ({
      number: Number(tile.querySelector(".tile-label")?.textContent),
      score: String(tile.querySelector(".tile-score")?.textContent || "").trim(),
    })),
  );

  console.log(JSON.stringify({
    metricIds: result.metricIds,
    builderMetricValueCalls: result.builderMetricValueCalls,
    directMetricValueCalls: result.directMetricValueCalls,
    medianRenderMs: result.medianRenderMs,
    samplesMs: result.samplesMs,
  }, null, 2));
  assert.deepEqual(result.displayed, result.expected, "Picklist comparison columns changed their displayed ranking or scores.");
  assert.deepEqual(ascendingColumn, result.expectedAscending[0], "The comparison-column ascending sort control changed its ranking or scores.");
  assert.ok(result.builderMetricValueCalls <= 350, `Picklist Builder evaluated ${result.builderMetricValueCalls} metric values; expected the shared grid cache to keep it below 350.`);
  assert.ok(result.directMetricValueCalls <= 55, `Picklist comparison columns evaluated ${result.directMetricValueCalls} metric values; expected no more than one per team.`);
  assert.ok(result.medianRenderMs < 300, `Picklist comparison columns took ${result.medianRenderMs} ms to render; expected under 300 ms.`);
} finally {
  await browser.close();
}
