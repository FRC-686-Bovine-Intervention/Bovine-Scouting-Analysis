import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const candidates = [path.resolve("node_modules/playwright/index.mjs"), "C:/Users/rich/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs"];
const playwrightPath = candidates.find((candidate) => fs.existsSync(candidate));
if (!playwrightPath) throw new Error("Playwright is unavailable.");
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || "C:/Users/rich/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe";
const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage();

await page.addInitScript(() => {
  globalThis.eventCatalog = [{
    key: "2026chcmp",
    season: 2026,
    seasonLabel: "2026",
    name: "Example Event",
    teams: [{ number: 1, name: "Example Team", flags: [], matches: [], sources: {}, derived: {} }],
    teamNumbers: [1],
    matches: [{ number: 1, red: [1], blue: [2], scoreBreakdown: { red: { autoPoints: 4 }, blue: { autoPoints: 0 } } }],
    matchesComplete: 1,
    scoringComponents: [],
    metrics: [],
    seedPicklists: [],
    seedSortEquations: [],
    formulaFieldDefinitions: [],
    dataSources: [],
  }];
});

try {
  await page.goto("http://localhost:4175", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => globalThis.__scoutingAppState);
  const result = await page.evaluate(() => {
    globalThis.firebaseCurrentUser = { uid: "test-user" };
    const appState = globalThis.__scoutingAppState;
    appState.user = "Jordan";
    appState.activeEventKey = "2026chcmp";
    appState.activeView = "analysis";
    appState.scoutingProfileCatalog = {
      "2026chcmp": [{
        id: "test-profile",
        label: "Test Profile",
        fields: [],
        derivedEquations: [
          { id: "isAutoScoring", name: "isAutoScoring", formula: "tba.scoreBreakdown.autoPoints > 0" },
          { id: "autoPoints", name: "autoPoints", formula: "tba.scoreBreakdown.autoPoints" },
        ],
      }],
    };
    appState.importResult = { summary: { profileId: "test-profile" } };
    globalThis.render();
    const filterOptions = [...document.querySelectorAll("#analysisFilterSelect option")].map((option) => option.value);
    const metricOptions = [...document.querySelectorAll("#metricSelect option")].map((option) => option.value);
    return { filterOptions, metricOptions };
  });
  assert(result.filterOptions.includes("isAutoScoring"), "Boolean-valued metric should be offered in Filter.");
  assert(!result.filterOptions.includes("autoPoints"), "Numeric metric should not be offered in Filter.");
  assert(result.metricOptions.some((value) => value.includes("autoPoints")), "Numeric metric should remain available for plotting.");
} finally {
  await browser.close();
}

console.log("PASS Analysis Filter offers boolean-valued metrics and preserves numeric plotting metrics.");
