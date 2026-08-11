import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const appUrl = process.env.SCOUTING_APP_URL || "http://localhost:4173/index.html";
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const snapshotFixture = fs.readFileSync(path.resolve("tests/fixtures/real-event-snapshots.js"), "utf8");
const snapshots = JSON.parse(snapshotFixture.replace(/^globalThis\.realEventSnapshots\s*=\s*/, "").replace(/;\s*$/, ""));
const rawSheetCsv = fs.readFileSync(path.resolve("src/real-source-cache/2026chcmp-sheet.csv"), "utf8");
const chcmpSnapshot = snapshots.events.find((event) => event.key === "2026chcmp");
const eventCatalog = [{
  ...chcmpSnapshot,
  key: "2026chcmp",
  season: 2026,
  name: "2026 Chesapeake Championship",
  seasonLabel: "2026",
  teams: JSON.parse(chcmpSnapshot.tbaTeamsText || "[]").map((team) => ({
    number: Number(team.team_number),
    name: team.nickname || `Team ${team.team_number}`,
    flags: [],
    matches: [],
    sources: {},
    derived: {},
  })),
  matches: JSON.parse(chcmpSnapshot.tbaMatchesText || "[]").map((match) => ({
    ...match,
    compLevel: match.comp_level || "qm",
    number: Number(match.match_number),
    red: (match.alliances?.red?.team_keys || []).map((team) => Number(String(team).replace("frc", ""))),
    blue: (match.alliances?.blue?.team_keys || []).map((team) => Number(String(team).replace("frc", ""))),
    redScore: match.alliances?.red?.score,
    blueScore: match.alliances?.blue?.score,
    hasScore: Number(match.alliances?.red?.score) >= 0 && Number(match.alliances?.blue?.score) >= 0,
  })),
  formulaFieldDefinitions: [],
  scoringComponents: [],
  derivedMetricDefinitions: [],
  scouterMetricDefinitions: [],
  seedPicklists: [],
  seedSortEquations: [],
  picklists: [],
  sortEquations: [],
  dataSources: [],
}];

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function loadPlaywright() {
  const candidates = [
    path.resolve(".browser-test/node_modules/playwright/index.mjs"),
    path.resolve("node_modules/playwright/index.mjs"),
    "C:/Users/rich/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
  ];
  const candidate = candidates.find((entry) => fs.existsSync(entry));
  assertCondition(candidate, "Playwright was not found.");
  return import(pathToFileURL(candidate).href);
}

async function login(page) {
  await page.fill("#firebaseEmailInput", "admin@example.test");
  await page.fill("#firebasePasswordInput", "local-admin-password");
  await page.click("#firebaseLoginButton");
  await page.waitForSelector('[data-view="teams"]', { state: "visible" });
}

async function loadEvent(page) {
  await page.evaluate(() => {
    const state = globalThis.__scoutingAppState;
    state.activeEventKey = "2026chcmp";
    state.eventWorkspace = createEventWorkspace(globalEventCatalog.find((event) => event.key === "2026chcmp"));
    state.activeView = "teams";
    render();
  });
  await page.waitForFunction(() => window.__scoutingAppState?.activeEventKey === "2026chcmp", null, { timeout: 15000 });
  await page.evaluate((csvText) => {
    const eventModel = currentEvent();
    const adaptedCsv = sharedAdaptEventSheetCsv(eventModel, csvText);
    loadPreparedScoutingCsv(adaptedCsv, "");
    commitImportPreview();
  }, rawSheetCsv);
  await page.evaluate(() => {
    const state = globalThis.__scoutingAppState;
    globalThis.firebaseUserRole = "admin";
    const teamNumbers = currentEvent().teams.map((team) => team.number);
    state.picklists = [{ id: "ticket136-smoke", name: "Ticket 136 smoke", teams: teamNumbers }];
    state.activePicklist = "ticket136-smoke";
    state.sortEquations = [{ id: "ticket136-sort", name: "Ticket 136 sort", clauses: [] }];
    state.activeSortEquation = "ticket136-sort";
    render();
  });
  await page.waitForTimeout(250);
}

async function measurePageTransition(page, targetView) {
  const result = await page.evaluate((target) => {
    const startedAt = performance.now();
    const state = globalThis.__scoutingAppState;
    if (target.startsWith("admin")) globalThis.firebaseUserRole = "admin";
    state.activeView = target;
    const renderStartedAt = performance.now();
    render();
    return { startedAt, renderMs: Number((performance.now() - renderStartedAt).toFixed(2)), activeView: state?.activeView || "" };
  }, targetView);
  assertCondition(result.activeView === targetView, `${targetView} render was redirected to ${result.activeView || "<missing>"}.`);
  try {
    await page.waitForFunction((target) => (
      globalThis.__scoutingAppState?.activeView === target
        && document.querySelector(`[data-view="${target}"]`)?.classList.contains("active")
    ), targetView);
  } catch (error) {
    throw new Error(`${targetView} navigation did not settle: ${await page.evaluate(() => globalThis.__scoutingAppState?.activeView || "<missing>")}; console=${pageErrors.join(" | ")}`, { cause: error });
  }
  return page.evaluate(({ startedAt, renderMs }) => {
    return {
      transitionMs: Number((performance.now() - startedAt).toFixed(2)),
      renderMs,
      activeView: globalThis.__scoutingAppState?.activeView || "",
    };
  }, result);
}

async function verifyDeferredAnalysis(page) {
  await page.evaluate(() => { globalThis.__scoutingAppState.activeView = "analysis"; render(); });
  await page.waitForFunction(() => globalThis.__scoutingAppState?.activeView === "analysis").catch(async (error) => {
    throw new Error(`Analysis navigation failed; active=${await page.evaluate(() => globalThis.__scoutingAppState?.activeView || "<missing>")}; console=${pageErrors.join(" | ")}`, { cause: error });
  });
  await page.waitForSelector("#metricSelect", { state: "visible", timeout: 5000 }).catch(async (error) => {
    throw new Error(`Analysis controls missing; active=${await page.evaluate(() => globalThis.__scoutingAppState?.activeView || "<missing>")}; console=${pageErrors.join(" | ")}`, { cause: error });
  });
  const metricValues = await page.locator("#metricSelect option").evaluateAll((options) => options.map((option) => option.value).filter(Boolean));
  assertCondition(metricValues.length > 0, "Analysis did not expose any selectable metrics.");
  await page.selectOption("#metricSelect", metricValues[0]);
  await page.evaluate(() => { globalThis.__scoutingAppState.activeView = "teams"; render(); });
  await page.waitForFunction(() => globalThis.__scoutingAppState?.activeView === "teams");
  await page.evaluate(() => { globalThis.__scoutingAppState.activeView = "analysis"; render(); });
  await page.waitForFunction(() => globalThis.__scoutingAppState?.activeView === "analysis");
  await page.waitForFunction(() => Number(globalThis.__analysisPerf?.calculations || 0) >= 1, null, { timeout: 15000 });
  const firstCalculationCount = await page.evaluate(() => globalThis.__analysisPerf?.calculations || 0);
  const alternateMetric = metricValues.find((value) => value !== metricValues[0]);
  if (alternateMetric) {
    await page.selectOption("#metricSelect", alternateMetric);
    await page.waitForFunction((count) => Number(globalThis.__analysisPerf?.calculations || 0) === count + 1, firstCalculationCount, { timeout: 15000 });
  } else {
    const filterValues = await page.locator("#analysisFilterSelect option").evaluateAll((options) => options.map((option) => option.value).filter(Boolean));
    assertCondition(filterValues.length > 0, "Analysis did not expose a second metric or filter to invalidate its cache.");
    await page.selectOption("#analysisFilterSelect", filterValues[0]);
    await page.waitForFunction((count) => Number(globalThis.__analysisPerf?.calculations || 0) === count + 1, firstCalculationCount, { timeout: 15000 });
  }
  const afterMetricChangeCount = await page.evaluate(() => globalThis.__analysisPerf?.calculations || 0);
  await page.evaluate(() => { globalThis.__scoutingAppState.activeView = "teams"; render(); });
  await page.waitForFunction(() => globalThis.__scoutingAppState?.activeView === "teams");
  await page.evaluate(() => { globalThis.__scoutingAppState.activeView = "analysis"; render(); });
  await page.waitForFunction(() => globalThis.__scoutingAppState?.activeView === "analysis");
  await page.waitForTimeout(100);
  const finalCalculationCount = await page.evaluate(() => globalThis.__analysisPerf?.calculations || 0);
  assertCondition(finalCalculationCount === afterMetricChangeCount, "Analysis recalculated after returning to a cached metric.");
  return { firstCalculationCount, afterMetricChangeCount, finalCalculationCount, cacheReused: true };
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(executablePath) ? executablePath : undefined });
const context = await browser.newContext();
await context.addInitScript((fixture) => { globalThis.realEventSnapshots = fixture; }, snapshots);
await context.addInitScript((catalog) => { globalThis.eventCatalog = catalog; }, eventCatalog);
await context.addInitScript(() => localStorage.clear());
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error" && /Render failed|Fallback render failed/.test(message.text())) pageErrors.push(message.text());
});

try {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await login(page);
  await loadEvent(page);
  const pageBudgetsMs = {
    teams: 500,
    rankings: 500,
    schedule: 500,
    matchup: 500,
    analysis: 1500,
    derivedBuilder: 500,
    picklistBuilder: 500,
    alliance: 500,
    adminEventControl: 500,
    adminDataQuality: 500,
    adminUserControl: 500,
  };
  const pageViews = Object.keys(pageBudgetsMs);
  const measurements = [];
  for (const targetView of pageViews) {
    const measurement = await measurePageTransition(page, targetView);
    measurements.push({ targetView, ...measurement, budgetMs: pageBudgetsMs[targetView], pass: measurement.transitionMs < pageBudgetsMs[targetView] });
    assertCondition(measurement.transitionMs < pageBudgetsMs[targetView], `${targetView} transition exceeded ${pageBudgetsMs[targetView]}ms: ${measurement.transitionMs}ms.`);
  }
  const warmMeasurements = [];
  for (const targetView of pageViews) {
    const measurement = await measurePageTransition(page, targetView);
    warmMeasurements.push({ targetView, ...measurement, budgetMs: pageBudgetsMs[targetView], pass: measurement.transitionMs < pageBudgetsMs[targetView] });
    assertCondition(measurement.transitionMs < pageBudgetsMs[targetView], `Warm ${targetView} transition exceeded ${pageBudgetsMs[targetView]}ms: ${measurement.transitionMs}ms.`);
  }
  const deferredAnalysis = await verifyDeferredAnalysis(page);
  assertCondition(pageErrors.length === 0, `Page errors detected: ${pageErrors.join("; ")}`);
  console.log(JSON.stringify({ eventKey: "2026chcmp", pageBudgetsMs, measurements, warmMeasurements, deferredAnalysis, pageErrors }, null, 2));
} finally {
  await browser.close();
}
