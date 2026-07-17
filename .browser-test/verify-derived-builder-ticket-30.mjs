import fs from "node:fs";
import { chromium } from "./node_modules/playwright/index.mjs";

const appUrl = "file:///D:/FIRST/Scouting/Scouting-Analysis/index.html";
const rawSheetCsvPath = "D:/FIRST/Scouting/Scouting-Analysis/src/real-source-cache/2026chcmp-sheet.csv";

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
  await page.waitForSelector("#adminEventCodeInput");
}

async function switchEvent(page, eventKey) {
  await page.fill("#adminEventCodeInput", eventKey);
  await page.locator("#adminEventCodeInput").press("Enter");
  await page.waitForTimeout(750);
}

async function openDerivedBuilder(page) {
  await page.locator('[data-view="derivedBuilder"]').click();
  await page.waitForTimeout(500);
}

async function importRawSheet(page, rawSheetCsv) {
  await page.evaluate((csvText) => {
    const eventModel = currentEvent();
    const adaptedCsv = sharedAdaptEventSheetCsv(eventModel, csvText);
    loadPreparedScoutingCsv(adaptedCsv, "");
    commitImportPreview();
  }, rawSheetCsv);
  await page.waitForTimeout(1500);
}

async function verifyTbaFuelIdentifiers(page) {
  return page.evaluate(() => {
    const eventModel = currentEvent();
    const targetIds = ["tba.autoFuel", "tba.transitionFuel", "tba.hubScore.autoPoints", "tba.hubScore.transitionPoints"];
    const metrics = Object.fromEntries(targetIds.map((identifier) => {
      let hitTeamNumber = null;
      let sample = [];
      for (const candidate of (eventModel.teams || [])) {
        const context = buildTeamFormulaContext(candidate.number, eventModel);
        if (!context) continue;
        const result = resolveFormulaIdentifier(identifier, context, new Map(), [], new Map(), []);
        const finiteValues = (result?.entries || [])
          .map((entry) => Number(entry.value))
          .filter((value) => Number.isFinite(value));
        if (!finiteValues.length) continue;
        hitTeamNumber = candidate.number;
        sample = finiteValues.slice(0, 3);
        break;
      }
      return [identifier, { finiteCount: sample.length, sample, teamNumber: hitTeamNumber }];
    }));
    return {
      ok: Object.values(metrics).every((summary) => summary.finiteCount > 0),
      metrics,
    };
  });
}

async function verifyAvailableMetricsCatalog(page) {
  return page.evaluate(() => {
    const availableMetrics = currentDerivedAvailableMetrics(currentEvent()).map((entry) => entry.id);
    return {
      availableMetrics,
      hasLegacyAutoFuel: availableMetrics.includes("tba.autoFuel"),
      hasLegacyTransitionFuel: availableMetrics.includes("tba.transitionFuel"),
      hasPridgeTotal: availableMetrics.includes("pridge.total"),
      hasDerivedEquationReference: availableMetrics.includes("autoFuelTeam"),
      hasRealTbaMetric: availableMetrics.includes("tba.hubScore.autoPoints"),
      hasRealScoutingMetric: availableMetrics.includes("scouting.autoFuelPct"),
      hasRealStatboticsMetric: availableMetrics.includes("statbotics.epa.breakdown.autoPoints"),
    };
  });
}

async function verifyEquationListScroll(page) {
  const equationList = page.locator('[data-builder-list-scroll="derived:equations"]');
  const equationItems = equationList.locator(".builder-list-item");
  const count = await equationItems.count();
  assert(count > 10, `Expected a long enough derived equation list, got ${count} items.`);

  await equationList.evaluate((element) => {
    element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight - 24);
  });
  const beforeClick = await equationList.evaluate((element) => element.scrollTop);
  await equationItems.nth(count - 1).click();
  await page.waitForTimeout(250);
  const afterClick = await equationList.evaluate((element) => element.scrollTop);

  await equationList.evaluate((element) => {
    element.scrollTop = 0;
  });
  await equationItems.first().click();
  await page.waitForTimeout(100);
  for (let index = 0; index < 20; index += 1) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(250);
  const keyboardState = await equationList.evaluate((list) => {
    const active = list.querySelector(".builder-list-item.active");
    if (!active) return { visible: false, scrollTop: list.scrollTop, activeText: "" };
    const listRect = list.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    return {
      visible: activeRect.top >= listRect.top && activeRect.bottom <= listRect.bottom,
      scrollTop: list.scrollTop,
      activeText: String(active.textContent || "").trim(),
    };
  });

  return {
    beforeClick,
    afterClick,
    clickPreservedScroll: afterClick >= Math.max(0, beforeClick - 40),
    keyboardState,
  };
}

async function verifyMetricListScroll(page) {
  const metricList = page.locator('[data-builder-list-scroll="derived:metrics"]');
  const metricItems = metricList.locator(".builder-list-item");
  const count = await metricItems.count();
  assert(count > 20, `Expected a long enough metric list, got ${count} items.`);

  await metricItems.first().click();
  await page.waitForTimeout(100);
  await metricList.evaluate((element) => {
    element.scrollTop = 0;
  });
  for (let index = 0; index < 30; index += 1) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(250);
  return metricList.evaluate((list) => {
    const active = list.querySelector(".builder-list-item.active");
    if (!active) return { visible: false, scrollTop: list.scrollTop, activeText: "" };
    const listRect = list.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    return {
      visible: activeRect.top >= listRect.top && activeRect.bottom <= listRect.bottom,
      scrollTop: list.scrollTop,
      activeText: String(active.textContent || "").trim(),
    };
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));
const rawSheetCsv = fs.readFileSync(rawSheetCsvPath, "utf8");

const result = { pageErrors };

try {
  await page.goto(appUrl);
  await waitForApp(page);
  await login(page);
  await openAdmin(page);
  await switchEvent(page, "2026chcmp");
  await importRawSheet(page, rawSheetCsv);
  await openDerivedBuilder(page);

  result.tbaFuel = await verifyTbaFuelIdentifiers(page);
  result.availableCatalog = await verifyAvailableMetricsCatalog(page);
  result.equationList = await verifyEquationListScroll(page);
  result.metricList = await verifyMetricListScroll(page);
  console.log(JSON.stringify(result, null, 2));

  assert(result.tbaFuel.ok, "At least one 2026 TBA fuel identifier still has no finite values.");
  assert(!result.availableCatalog.hasLegacyAutoFuel, "Available Metrics should not list legacy tba.autoFuel.");
  assert(!result.availableCatalog.hasLegacyTransitionFuel, "Available Metrics should not list legacy tba.transitionFuel.");
  assert(!result.availableCatalog.hasPridgeTotal, "Available Metrics should only list scouting, TBA, and Statbotics source metrics.");
  assert(!result.availableCatalog.hasDerivedEquationReference, "Available Metrics should not list other derived equations.");
  assert(result.availableCatalog.hasRealTbaMetric, "Available Metrics should include real TBA identifiers.");
  assert(result.availableCatalog.hasRealScoutingMetric, "Available Metrics should include real scouting identifiers.");
  assert(result.availableCatalog.hasRealStatboticsMetric, "Available Metrics should include real Statbotics identifiers.");
  Object.entries(result.tbaFuel.metrics).forEach(([identifier, summary]) => {
    assert(summary.finiteCount > 0, `${identifier} still has no finite values.`);
  });
  assert(result.equationList.clickPreservedScroll, `Equation selection reset scroll from ${result.equationList.beforeClick} to ${result.equationList.afterClick}.`);
  assert(result.equationList.keyboardState.visible, `Equation keyboard navigation did not keep "${result.equationList.keyboardState.activeText}" visible.`);
  assert(result.equationList.keyboardState.scrollTop > 0, "Equation keyboard navigation did not advance list scroll.");
  assert(result.metricList.visible, `Metric keyboard navigation did not keep "${result.metricList.activeText}" visible.`);
  assert(result.metricList.scrollTop > 0, "Metric keyboard navigation did not advance list scroll.");
} finally {
  await browser.close();
}
