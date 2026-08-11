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

async function measureSwitch(page) {
  await page.click('[data-view="picklistBuilder"]');
  await page.waitForSelector('[data-view="picklistBuilder"]', { state: "visible" });
  const startedAt = await page.evaluate(() => performance.now());
  await page.click('[data-view="derivedBuilder"]');
  try {
    await page.waitForSelector('[data-builder-list-scroll="derived:equations"]', { state: "visible", timeout: 10000 });
  } catch (error) {
    const state = await page.evaluate(() => ({ activeView: window.__scoutingAppState?.activeView, text: document.body.innerText.slice(0, 500) }));
    throw new Error(`Derived Builder did not render: ${JSON.stringify(state)}; ${error.message}`);
  }
  return page.evaluate((started) => ({
    transitionMs: Number((performance.now() - started).toFixed(2)),
    renderEvents: (globalThis.__scoutingPerf?.events || []).filter((event) => event.label === "render" || event.label === "bootstrap.renderSafely").slice(-5),
    activeView: globalThis.__scoutingAppState?.activeView || "",
  }), startedAt);
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
  const measurements = [];
  for (let index = 0; index < 3; index += 1) measurements.push(await measureSwitch(page));
  const maxMs = Math.max(...measurements.map((measurement) => measurement.transitionMs));
  assertCondition(maxMs < 500, `Derived Equation Builder transition exceeded 500ms: ${maxMs}ms.`);
  assertCondition(pageErrors.length === 0, `Page errors detected: ${pageErrors.join("; ")}`);
  console.log(JSON.stringify({ eventKey: "2026chcmp", measurements, maxMs, pageErrors }, null, 2));
} finally {
  await browser.close();
}
