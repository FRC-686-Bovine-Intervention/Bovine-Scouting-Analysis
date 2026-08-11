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
      { number: 1, name: "Alpha", flags: [], matches: [], sources: { statbotics: { components: { "epa.total_points": 12, "epa.auto_points": 3, "epa.teleop_points": 7, "epa.endgame_points": 2 } } }, derived: {} },
      { number: 2, name: "Bravo", flags: [], matches: [], sources: { statbotics: { components: { "epa.total_points": 30, "epa.auto_points": 8, "epa.teleop_points": 17, "epa.endgame_points": 5 } } }, derived: {} },
      { number: 3, name: "Charlie", flags: [], matches: [], sources: { statbotics: { components: { "epa.total_points": 20, "epa.auto_points": 6, "epa.teleop_points": 10, "epa.endgame_points": 4 } } }, derived: {} },
      { number: 4, name: "Delta", flags: [], matches: [], sources: { statbotics: { components: { "epa.total_points": 25, "epa.auto_points": 7, "epa.teleop_points": 14, "epa.endgame_points": 4 } } }, derived: {} },
      { number: 5, name: "Echo", flags: [], matches: [], sources: { statbotics: { components: { "epa.total_points": 10, "epa.auto_points": 2, "epa.teleop_points": 6, "epa.endgame_points": 2 } } }, derived: {} },
      { number: 6, name: "Foxtrot", flags: [], matches: [], sources: { statbotics: { components: { "epa.total_points": 5, "epa.auto_points": 1, "epa.teleop_points": 3, "epa.endgame_points": 1 } } }, derived: {} },
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
    const epaOptionLabel = [...firstMetric.options].find((option) => option.value === "source:statbotics:epa.total_points")?.textContent;
    firstMetric.value = "source:statbotics:epa.total_points";
    firstMetric.dispatchEvent(new Event("change", { bubbles: true }));
    return {
      allianceNames,
      cards,
      epaOptionLabel,
      selectedMetrics: [...document.querySelectorAll("[data-matchup-metric]")].map((node) => node.value),
      bars: document.querySelectorAll(".matchup-stacked-bar").length,
      redFirst: document.querySelector(".matchup-alliance-card.red .matchup-team")?.textContent.trim(),
    };
  });
  assert.deepEqual(result.allianceNames, ["2 Bravo", "3 Charlie", "1 Alpha", "4 Delta", "5 Echo", "6 Foxtrot"]);
  assert.equal(result.cards, 5, "The four default metrics should render with a new empty metric card.");
  assert.deepEqual(result.selectedMetrics, [
    "source:statbotics:epa.total_points",
    "source:statbotics:epa.auto_points",
    "source:statbotics:epa.teleop_points",
    "source:statbotics:epa.endgame_points",
    "",
  ]);
  assert.equal(result.bars, 8, "Each selected metric should render red and blue stacked bars.");
  assert.match(result.redFirst, /2 Bravo/);
  assert.equal(result.epaOptionLabel, "statbotics.epa.total_points", "Metric selectors should use the canonical raw metric token label.");
} finally {
  await browser.close();
}

console.log("PASS Matchup makeover ordering, metric cards, and add-metric flow.");
