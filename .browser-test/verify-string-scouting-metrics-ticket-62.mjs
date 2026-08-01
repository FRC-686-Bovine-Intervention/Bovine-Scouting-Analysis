import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "./node_modules/playwright/index.mjs";

const appUrl = "file:///D:/FIRST/Scouting/Scouting-Analysis/index.html";
const rawSheetCsv = fs.readFileSync(
  "D:/FIRST/Scouting/Scouting-Analysis/src/real-source-cache/2026chcmp-sheet.csv",
  "utf8",
);

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

  const imported = await page.evaluate((csvText) => {
    const eventModel = currentEvent();
    loadPreparedScoutingCsv(sharedAdaptEventSheetCsv(eventModel, csvText), "");
    commitImportPreview();
    return __scoutingAppState.scoutingSubmissions
      .filter((submission) => submission.teamNumber === 122)
      .map((submission) => submission.rawMetrics.autoSecondaryRole);
  }, rawSheetCsv);
  assert.ok(imported.includes("Score"), "Sheet-backed import should retain team 122's string role values.");

  await page.locator('[data-view="derivedBuilder"]').click();
  await page.locator('[data-derived-preview-metric="scouting.autoPrimaryRole"]').click();
  const values = await page.locator('[data-derived-scroll="result"] .derived-grid-cell').allTextContents();
  assert.ok(values.includes("Score"), "Derived Equation Builder should render the imported string value.");
  assert.ok(!values.includes("0"), "Derived Equation Builder should not coerce the imported string value to zero.");
  console.log("PASS Derived Equation Builder renders 2026chcmp string scouting metrics");
} finally {
  await browser.close();
}
