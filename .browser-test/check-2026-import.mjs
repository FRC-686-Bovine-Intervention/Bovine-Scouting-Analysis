import fs from "node:fs";
import path from "node:path";
import { chromium } from "./node_modules/playwright/index.mjs";

const appUrl = "file:///D:/FIRST/Scouting/Bovine-Scouting-Analysis/index.html";
const rawSheetCsv = fs.readFileSync(path.resolve("src/real-source-cache/2026chcmp-sheet.csv"), "utf8");

async function waitForApp(page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(1000);
}

async function login(page) {
  const existingUser = page.locator("#existingUser");
  if (await existingUser.count()) {
    await existingUser.selectOption("Avery");
    await page.locator("#loginButton").click();
    await page.waitForSelector('[data-view="teams"]');
  }
}

async function openAdmin(page) {
  await page.locator('[data-view="admin"]').click();
  await page.waitForSelector("#adminEventSelect");
}

async function switchEvent(page, eventKey) {
  await page.selectOption("#adminEventSelect", eventKey);
  await page.waitForTimeout(750);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(appUrl);
  await waitForApp(page);
  await login(page);
  await openAdmin(page);
  await switchEvent(page, "2026chcmp");
  const before = await page.evaluate(() => ({
    previewOk: globalThis.__scoutingAppState.importResult?.ok || false,
    existingRows: (globalThis.__scoutingAppState.scoutingSubmissions || []).length,
  }));
  await page.evaluate((csvText) => {
    const eventModel = currentEvent();
    const adaptedCsv = sharedAdaptEventSheetCsv(eventModel, csvText);
    loadPreparedScoutingCsv(adaptedCsv, "");
  }, rawSheetCsv);
  await page.waitForTimeout(1000);
  const preview = await page.evaluate(() => {
    const previewResult = globalThis.__scoutingAppState.importResult;
    const summary = previewResult?.summary;
    return {
      ok: previewResult?.ok || false,
      errors: previewResult?.errors || [],
      warnings: previewResult?.warnings || [],
      rowCount: summary?.rowCount || 0,
      submissionCount: summary?.submissions?.length || 0,
      sample122: (summary?.submissions || [])
        .filter((submission) => Number(submission.teamNumber) === 122)
        .slice(0, 5)
        .map((submission) => ({
          teamNumber: submission.teamNumber,
          matchNumber: submission.matchNumber,
          validity: submission.validity,
          rawMetrics: submission.rawMetrics,
        })),
    };
  });
  if (await page.locator("#commitImportButton").isEnabled()) {
    await page.locator("#commitImportButton").click();
    await page.waitForTimeout(1500);
  }
  const after = await page.evaluate(() => ({
    storedRows: (globalThis.__scoutingAppState.scoutingSubmissions || []).length,
    sample122: (globalThis.__scoutingAppState.scoutingSubmissions || [])
      .filter((submission) => Number(submission.teamNumber) === 122)
      .slice(0, 5)
      .map((submission) => ({
        teamNumber: submission.teamNumber,
        matchNumber: submission.matchNumber,
        validity: submission.validity,
        rawMetrics: submission.rawMetrics,
      })),
  }));
  console.log(JSON.stringify({ before, preview, after }, null, 2));
} finally {
  await browser.close();
}
