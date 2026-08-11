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
    name: "Matchup Test Event",
    teams: [
      { number: 1, name: "Alpha", flags: [], matches: [], sources: { statbotics: { components: { "epa.total_points": 12 } } }, derived: {} },
      { number: 2, name: "Bravo", flags: [], matches: [], sources: { statbotics: { components: { "epa.total_points": 30 } } }, derived: {} },
      { number: 3, name: "Charlie", flags: [], matches: [], sources: { statbotics: { components: { "epa.total_points": 20 } } }, derived: {} },
      { number: 4, name: "Delta", flags: [], matches: [], sources: { statbotics: { components: { "epa.total_points": 25 } } }, derived: {} },
      { number: 5, name: "Echo", flags: [], matches: [], sources: { statbotics: { components: { "epa.total_points": 10 } } }, derived: {} },
      { number: 6, name: "Foxtrot", flags: [], matches: [], sources: { statbotics: { components: { "epa.total_points": 5 } } }, derived: {} },
    ],
    teamNumbers: [1, 2, 3, 4, 5, 6],
    matches: [{ number: 1, red: [1, 2, 3], blue: [4, 5, 6] }],
    matchesComplete: 1,
    scoringComponents: [], metrics: [], seedPicklists: [], seedSortEquations: [], formulaFieldDefinitions: [], dataSources: [],
  }];
});

try {
  await page.goto("http://localhost:4175", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => globalThis.__scoutingAppState);
  const result = await page.evaluate(() => {
    globalThis.firebaseCurrentUser = { uid: "test-user" };
    const state = globalThis.__scoutingAppState;
    state.user = "Jordan";
    state.activeEventKey = "2026chcmp";
    state.selectedMatch = 1;
    state.activeView = "matchup";
    globalThis.render();
    const allianceNames = [...document.querySelectorAll(".matchup-team strong")].map((node) => node.textContent.trim());
    const cards = document.querySelectorAll(".matchup-metric-card").length;
    const firstMetric = document.querySelector("[data-matchup-metric]");
    firstMetric.value = "source:statbotics:epa.total_points";
    firstMetric.dispatchEvent(new Event("change", { bubbles: true }));
    return {
      allianceNames,
      cards,
      selectedMetrics: [...document.querySelectorAll("[data-matchup-metric]")].map((node) => node.value),
      bars: document.querySelectorAll(".matchup-stacked-bar").length,
      redFirst: document.querySelector(".matchup-alliance-card.red .matchup-team")?.textContent.trim(),
    };
  });
  assert.deepEqual(result.allianceNames, ["Bravo", "Charlie", "Alpha", "Delta", "Echo", "Foxtrot"]);
  assert.equal(result.cards, 2, "The selected metric should reveal a new empty metric card.");
  assert.deepEqual(result.selectedMetrics, ["source:statbotics:epa.total_points", ""]);
  assert.equal(result.bars, 2, "The selected metric should render red and blue stacked bars.");
  assert.match(result.redFirst, /Bravo/);
} finally {
  await browser.close();
}

console.log("PASS Matchup makeover ordering, metric cards, and add-metric flow.");
