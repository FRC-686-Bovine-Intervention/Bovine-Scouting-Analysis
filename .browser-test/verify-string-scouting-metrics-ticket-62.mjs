import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "./node_modules/playwright/index.mjs";

const appUrl = "file:///D:/FIRST/Scouting/Scouting-Analysis/index.html";
const fixture = JSON.parse(fs.readFileSync(
  "D:/FIRST/Scouting/Scouting-Analysis/tests/fixtures/canonical-scouting-datasets/2026chcmp.json",
  "utf8",
));
const schema = JSON.parse(fs.readFileSync(
  "D:/FIRST/Scouting/Scouting-Analysis/tests/fixtures/canonical-scouting-datasets/2026chcmp_profile-v1.json",
  "utf8",
));
const updatedFixture = {
  ...fixture,
  entries: fixture.entries.map((entry) => ({
    ...entry,
    rawMetrics: {
      ...entry.rawMetrics,
      autoSecondaryRole: "Updated Score",
      autoFuelPct: 42,
      defensePlayed: true,
    },
  })),
};

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

  const imported = await page.evaluate(({ fixturePayload, schemaPayload }) => {
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
    return __scoutingAppState.scoutingSubmissions.map((submission) => submission.rawMetrics);
  }, { fixturePayload: fixture, schemaPayload: schema });
  assert.ok(imported.some((metrics) => metrics.autoSecondaryRole === "Score"), "File import should retain string role values.");
  assert.ok(imported.some((metrics) => metrics.autoFuelPct === 80), "File import should retain numeric fuel values.");
  assert.ok(imported.some((metrics) => metrics.defensePlayed === false), "File import should retain logical defense values.");

  const updated = await page.evaluate(({ fixturePayload, schemaPayload }) => {
    const eventModel = currentEvent();
    __scoutingAppState.scoutingSubmissions = [];
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
    return __scoutingAppState.scoutingSubmissions.map((submission) => submission.rawMetrics);
  }, { fixturePayload: updatedFixture, schemaPayload: schema });
  assert.ok(updated.some((metrics) => metrics.autoSecondaryRole === "Updated Score"), "Updated file import should retain string role values.");
  assert.ok(updated.some((metrics) => metrics.autoFuelPct === 42), "Updated file import should retain numeric fuel values.");
  assert.ok(updated.some((metrics) => metrics.defensePlayed === true), "Updated file import should retain logical defense values.");

  await page.locator('[data-view="derivedBuilder"]').click();
  for (const [metricId, expectedValue] of [
    ["scouting.autoSecondaryRole", "Updated Score"],
    ["scouting.autoFuelPct", "42"],
    ["scouting.defensePlayed", "true"],
  ]) {
    await page.locator(`[data-derived-preview-metric="${metricId}"]`).click();
    const values = await page.locator('[data-derived-scroll="result"] .derived-grid-cell').allTextContents();
    assert.ok(values.includes(expectedValue), `Derived Equation Builder should render ${metricId} as ${expectedValue}.`);
  }
  console.log("PASS Derived Equation Builder passes through 2026chcmp strings, numerics, and logicals");
} finally {
  await browser.close();
}
