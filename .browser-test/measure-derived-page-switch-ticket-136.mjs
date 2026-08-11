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
  matches: JSON.parse(chcmpSnapshot.tbaMatchesText || "[]"),
  formulaFieldDefinitions: [],
  scoringComponents: [],
  derivedMetricDefinitions: [],
  scouterMetricDefinitions: [],
  seedPicklists: [],
  seedSortEquations: [],
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
  await page.waitForTimeout(250);
}

async function measurePageTransition(page, targetView) {
  const result = await page.evaluate((target) => {
    const startedAt = performance.now();
    const state = globalThis.__scoutingAppState;
    const originalRender = globalThis.render;
    if (!originalRender) return { startedAt, renderCount: -1 };
    if (!globalThis.__ticket136RenderWrapperInstalled) {
      globalThis.__ticket136RenderWrapperInstalled = true;
      globalThis.__ticket136RenderDurations = [];
      globalThis.render = (...args) => {
        const renderStartedAt = performance.now();
        try {
          return originalRender(...args);
        } finally {
          globalThis.__ticket136RenderDurations.push({
            view: globalThis.__scoutingAppState?.activeView || target,
            durationMs: Number((performance.now() - renderStartedAt).toFixed(2)),
          });
        }
      };
    }
    return { startedAt, renderCount: globalThis.__ticket136RenderDurations.length, activeView: state?.activeView || "" };
  }, targetView);
  assertCondition(result.renderCount >= 0, "The app did not expose its render function for page timing.");
  await page.click(`[data-view="${targetView}"]`);
  await page.waitForFunction(({ target, count }) => (
    globalThis.__scoutingAppState?.activeView === target
      && (globalThis.__ticket136RenderDurations?.length || 0) > count
  ), { target: targetView, count: result.renderCount });
  return page.evaluate((startedAt) => {
    const renders = globalThis.__ticket136RenderDurations || [];
    const render = renders[renders.length - 1] || {};
    return {
      transitionMs: Number((performance.now() - startedAt).toFixed(2)),
      renderMs: render.durationMs || 0,
      activeView: globalThis.__scoutingAppState?.activeView || "",
    };
  }, result.startedAt);
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
  assertCondition(pageErrors.length === 0, `Page errors detected: ${pageErrors.join("; ")}`);
  console.log(JSON.stringify({ eventKey: "2026chcmp", pageBudgetsMs, measurements, warmMeasurements, pageErrors }, null, 2));
} finally {
  await browser.close();
}
