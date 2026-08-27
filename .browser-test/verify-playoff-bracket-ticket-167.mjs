import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const candidates = [path.resolve("node_modules/playwright/index.mjs"), "C:/Users/rich/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs"];
const playwrightPath = candidates.find((candidate) => fs.existsSync(candidate));
if (!playwrightPath) throw new Error("Playwright is unavailable.");
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || "C:/Users/rich/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe" });
const page = await browser.newPage();
await page.setViewportSize({ width: 1818, height: 716 });

await page.addInitScript(() => {
  const teams = Array.from({ length: 9 }, (_, index) => ({ number: index + 1, name: `Team ${index + 1}`, flags: [], matches: [], sources: {}, derived: {} }));
  globalThis.__ticket167Fixture = {
    key: "2026bracket",
    season: 2026,
    seasonLabel: "2026",
    name: "Playoff Bracket Test Event",
    teams,
    teamNumbers: teams.map((team) => team.number),
    matches: [
      { id: "2026bracket_qf1m1", number: 1, compLevel: "qf", setNumber: 1, red: [1, 2, 3], blue: [4, 5, 6], redScore: 100, blueScore: 90, hasScore: true },
    ],
    playoffAlliances: [
      { number: 1, name: "Alliance 1", picks: [1, 2, 3], status: { playoff_status: "active" } },
      { number: 2, name: "Alliance 2", picks: [4, 5, 6, 7], status: { playoff_status: "eliminated" } },
    ],
    matchesComplete: 1, scoringComponents: [], metrics: [], seedPicklists: [], seedSortEquations: [], formulaFieldDefinitions: [], dataSources: [],
  };
  globalThis.eventCatalog = [globalThis.__ticket167Fixture];
});

try {
  await page.goto("http://localhost:4175", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => globalThis.__scoutingAppState);
  await page.evaluate(() => {
    globalThis.firebaseCurrentUser = { uid: "test-user" };
    const state = globalThis.__scoutingAppState;
    globalThis.eventCatalog.splice(0, globalThis.eventCatalog.length, globalThis.__ticket167Fixture);
    state.user = "Jordan";
    state.activeEventKey = "2026bracket";
    state.activeView = "bracket";
    state.highlightTeam = 686;
    globalThis.render();
    return { ready: true };
  });
  const result = await page.evaluate(() => {
    return {
      nav: document.querySelector('[data-view="bracket"]')?.getAttribute("title"),
      cards: document.querySelectorAll(".playoff-alliance-card").length,
      firstTeams: document.querySelectorAll(".playoff-alliance-card:nth-child(1) .playoff-team").length,
      secondTeams: document.querySelectorAll(".playoff-alliance-card:nth-child(2) .playoff-team").length,
      eliminated: document.querySelectorAll(".playoff-alliance-card.playoff-eliminated").length,
      bracketMatches: document.querySelectorAll(".playoff-bracket-match").length,
      bracketRounds: [...document.querySelectorAll(".playoff-bracket-column-labels h3")].map((node) => node.textContent.trim()),
      lanes: [...document.querySelectorAll(".playoff-bracket-lane-labels span")].map((node) => node.textContent.trim()),
      connectorPath: document.querySelector(".playoff-bracket-connectors path")?.getAttribute("d"),
      score: document.querySelector(".playoff-bracket-match header span")?.textContent.trim(),
      highlightDefault: document.querySelector("#playoffBracketHighlightTeam")?.value,
      boardOverflowX: getComputedStyle(document.querySelector(".playoff-bracket-board")).overflowX,
      boardOverflowY: getComputedStyle(document.querySelector(".playoff-bracket-board")).overflowY,
    };
  });
  assert.equal(result.nav, "Playoff Bracket");
  assert.equal(result.cards, 8, "The bracket always reserves eight alliance cards.");
  assert.equal(result.firstTeams, 3, "Regular events show three alliance picks.");
  assert.equal(result.secondTeams, 4, "World Championship-style alliances show four picks.");
  assert.equal(result.eliminated, 1);
  assert.equal(result.bracketMatches, 14, "The rendered bracket reserves every Figure 10-2 match slot.");
  assert.deepEqual(result.bracketRounds, ["Round 1", "Round 2", "Round 3", "Round 4", "Round 5", "Finals"]);
  assert.deepEqual(result.lanes, ["Upper bracket", "Lower bracket"]);
  assert.match(result.connectorPath, /M171 38H183/);
  assert.equal(result.score, "100 - 90");
  assert.equal(result.highlightDefault, "686");
  assert.equal(result.boardOverflowX, "visible", "The fluid bracket should not need an inner horizontal scrollbar.");
  assert.equal(result.boardOverflowY, "visible", "The bracket should not create a redundant inner vertical scrollbar.");
  console.log("PASS rendered playoff bracket supports eight cards, three/four-team alliances, scores, and elimination state");
} finally {
  await browser.close();
}
