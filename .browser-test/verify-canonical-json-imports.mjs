import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const appUrl = "file:///D:/FIRST/Scouting/Scouting-Analysis/index.html";

const datasets = [
  {
    eventKey: "2024mdsev",
    filePath: path.resolve("tests/fixtures/canonical-scouting-datasets/2024mdsev.json"),
    expectedAnalysisMetricId: "source:scouter:autoSpeakerMade",
    expectedDerivedMetricId: "scouting.autoSpeakerMade",
  },
  {
    eventKey: "2025chcmp",
    filePath: path.resolve("tests/fixtures/canonical-scouting-datasets/2025chcmp.json"),
    expectedAnalysisMetricId: "source:scouter:autoL4Made",
    expectedDerivedMetricId: "scouting.autoL4Made",
  },
  {
    eventKey: "2026chcmp",
    filePath: path.resolve("tests/fixtures/canonical-scouting-datasets/2026chcmp.json"),
    expectedAnalysisMetricId: "source:scouter:autoFuelPct",
    expectedDerivedMetricId: "scouting.autoFuelPct",
  },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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
  await page.waitForFunction((expectedEventKey) => globalThis.__scoutingAppState?.activeEventKey === expectedEventKey, eventKey);
  await page.waitForTimeout(500);
}

async function chooseLocalJsonFile(page, filePath) {
  await page.selectOption("#scoutingAttachmentFormatSelect", "scouting-json");
  await page.fill("#scoutingAttachmentTranslatorId", "canonical-json-v1");
  await page.fill("#importSourceUrl", filePath);
  await page.locator("#saveScoutingAttachmentButton").click();
}

async function loadAndCommitImport(page, jsonText) {
  await page.evaluate((nextJsonText) => {
    loadPreparedScoutingJson(nextJsonText, { autoCommit: false });
  }, jsonText);
  await page.waitForFunction(() => Boolean(globalThis.__scoutingAppState?.importResult?.summary));
  await page.locator("#commitImportButton").click();
  await page.waitForFunction(() => globalThis.__scoutingAppState?.importResult === null);
  await page.waitForTimeout(400);
}

async function collectAnalysisMetricOptions(page) {
  await page.evaluate(() => {
    globalThis.__scoutingAppState.activeView = "analysis";
    render();
  });
  await page.waitForSelector("#metricSelect");
  return page.evaluate(() => [...document.querySelector("#metricSelect").options].map((option) => option.value));
}

async function collectDerivedMetricCatalog(page) {
  await page.evaluate(() => {
    globalThis.__scoutingAppState.activeView = "derivedBuilder";
    render();
  });
  await page.waitForSelector(".builder-list.metric-catalog");
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-derived-preview-metric]")].map((element) => element.dataset.derivedPreviewMetric),
  );
}

async function clearImportedScoutingDataForEvent(page, eventKey) {
  await page.evaluate((targetEventKey) => {
    const appState = globalThis.__scoutingAppState;
    appState.scoutingSubmissions = (appState.scoutingSubmissions || []).filter((submission) => submission.eventKey !== targetEventKey);
    localStorage.removeItem(`frc-scouting-submissions:${targetEventKey}`);
    saveState();
  }, eventKey);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));
await page.addInitScript(() => {
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function patchedSetItem(key, value) {
    try {
      return originalSetItem.call(this, key, value);
    } catch (error) {
      if (String(key || "").startsWith("frc-scouting-submissions:")) return undefined;
      throw error;
    }
  };
});

const result = { pageErrors, datasets: [] };

try {
  await page.goto(appUrl);
  await waitForApp(page);
  await login(page);
  await openAdmin(page);

  for (const dataset of datasets) {
    await switchEvent(page, dataset.eventKey);
    await chooseLocalJsonFile(page, dataset.filePath);
    await loadAndCommitImport(page, fs.readFileSync(dataset.filePath, "utf8"));

    const verification = await page.evaluate(({ eventKey }) => ({
      activeEventKey: globalThis.__scoutingAppState?.activeEventKey,
      importedRows: currentScoutingSubmissions().length,
      activeAttachmentFormat: currentScoutingAttachment()?.format || "",
      activeTranslatorId: currentScoutingAttachment()?.translatorId || "",
      sourceValue: currentScoutingAttachment()?.location?.path || currentScoutingAttachment()?.location?.url || "",
      eventKey,
    }), { eventKey: dataset.eventKey });

    const analysisMetricOptions = await collectAnalysisMetricOptions(page);
    const derivedMetricCatalog = await collectDerivedMetricCatalog(page);

    assert(verification.activeEventKey === dataset.eventKey, `Expected active event ${dataset.eventKey}, got ${JSON.stringify(verification)}`);
    assert(verification.importedRows > 0, `Expected imported scouting rows for ${dataset.eventKey}, got ${JSON.stringify(verification)}`);
    assert(verification.activeAttachmentFormat === "scouting-json", `Expected JSON attachment format for ${dataset.eventKey}, got ${JSON.stringify(verification)}`);
    assert(verification.activeTranslatorId === "canonical-json-v1", `Expected canonical-json-v1 for ${dataset.eventKey}, got ${JSON.stringify(verification)}`);
    assert(String(verification.sourceValue).toLowerCase().endsWith(".json"), `Expected JSON source path for ${dataset.eventKey}, got ${JSON.stringify(verification)}`);
    assert(analysisMetricOptions.includes(dataset.expectedAnalysisMetricId), `Expected ${dataset.expectedAnalysisMetricId} in Analysis for ${dataset.eventKey}, got ${JSON.stringify(analysisMetricOptions)}`);
    assert(derivedMetricCatalog.includes(dataset.expectedDerivedMetricId), `Expected ${dataset.expectedDerivedMetricId} in Derived Builder for ${dataset.eventKey}, got ${JSON.stringify(derivedMetricCatalog)}`);

    result.datasets.push({
      eventKey: dataset.eventKey,
      importedRows: verification.importedRows,
      analysisMetricFound: dataset.expectedAnalysisMetricId,
      derivedMetricFound: dataset.expectedDerivedMetricId,
    });

    await clearImportedScoutingDataForEvent(page, dataset.eventKey);
    await openAdmin(page);
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
