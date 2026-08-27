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
      { id: "2026bracket_qf1m1", number: 1, compLevel: "qf", setNumber: 1, red: [3, 1, 2], blue: [4, 5, 6], redScore: 100, blueScore: 90, hasScore: true },
      { id: "2026bracket_qf1m2", number: 2, compLevel: "qf", setNumber: 2, red: [7, 8, 9], blue: [1, 2, 3], redScore: -1, blueScore: -1, hasScore: false },
      { id: "2026bracket_qf1m4", number: 4, compLevel: "qf", setNumber: 4, red: [686, 8, 9], blue: [1, 2, 3], redScore: 95, blueScore: 90, hasScore: true },
      { id: "2026bracket_f1m1", number: 1, compLevel: "f", red: [1, 2, 3], blue: [4, 5, 6], redScore: 110, blueScore: 100, hasScore: true },
      { id: "2026bracket_f1m2", number: 2, compLevel: "f", red: [1, 2, 3], blue: [4, 5, 6], redScore: 105, blueScore: 98, hasScore: true },
    ],
    playoffAlliances: [
      { number: 1, name: "Alliance 1", picks: [1, 2, 3], status: { playoff_status: "active" } },
      { number: 2, name: "Alliance 2", picks: [4, 5, 6, 7], status: { playoff_status: "eliminated" } },
      { number: 3, name: "Alliance 3", picks: [686, 8, 9], status: { playoff_status: "active" } },
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
      firstAllianceOrder: [...document.querySelectorAll(".playoff-alliance-card:nth-child(1) .playoff-team")].map((node) => node.textContent.trim()),
      allianceTeamGap: getComputedStyle(document.querySelector(".playoff-alliance-teams")).rowGap,
      highlightedAllianceCards: document.querySelectorAll(".playoff-alliance-card.schedule-highlight-team").length,
      nextMatch: document.querySelector('[data-playoff-next="true"] strong')?.textContent.trim(),
      nextMatchClass: document.querySelector('[data-playoff-next="true"]')?.className,
      highlightedTeamMatches: [...document.querySelectorAll(".playoff-bracket-match.schedule-highlight-team")].filter((node) => node.textContent.includes("686")).map((node) => node.querySelector("strong")?.textContent.trim()),
      finalCardPositions: [...document.querySelectorAll(".playoff-bracket-finals .playoff-bracket-match")].map((node) => node.getBoundingClientRect().top),
      highlightedAllianceBackgrounds: (() => { const match = [...document.querySelectorAll(".playoff-bracket-match.schedule-highlight-team")].find((node) => node.querySelector("strong")?.textContent.trim() === "M4"); return match ? [...match.querySelectorAll(".playoff-bracket-alliance")].map((node) => getComputedStyle(node).backgroundColor) : []; })(),
      highlightBackground: getComputedStyle(document.querySelector(".playoff-bracket-match.schedule-highlight-team")).backgroundColor,
      accentSoft: getComputedStyle(document.documentElement).getPropertyValue("--accent-soft").trim(),
      eliminated: document.querySelectorAll(".playoff-alliance-card.playoff-eliminated").length,
      bracketMatches: document.querySelectorAll(".playoff-bracket-match").length,
      bracketRounds: [...document.querySelectorAll(".playoff-bracket-column-labels h3")].map((node) => node.textContent.trim()),
      lanes: [...document.querySelectorAll(".playoff-bracket-lane-labels span")].map((node) => node.textContent.trim()),
      connectorPath: document.querySelector(".playoff-bracket-connectors path")?.getAttribute("d"),
      score: document.querySelector(".playoff-bracket-match header span")?.textContent.trim(),
      firstMatchRed: document.querySelector('.playoff-bracket-match strong')?.closest('.playoff-bracket-match')?.querySelector('.red')?.textContent.trim(),
      downstream: [...document.querySelectorAll(".playoff-bracket-match")].filter((node) => ["M5", "M7"].includes(node.querySelector("strong")?.textContent)).map((node) => ({ label: node.querySelector("strong").textContent, red: node.querySelector(".red").textContent.trim(), blue: node.querySelector(".blue").textContent.trim() })),
      highlightDefault: document.querySelector("#playoffBracketHighlightTeam")?.value,
      boardOverflowX: getComputedStyle(document.querySelector(".playoff-bracket-board")).overflowX,
      boardOverflowY: getComputedStyle(document.querySelector(".playoff-bracket-board")).overflowY,
    };
  });
  assert.equal(result.nav, "Playoff Bracket");
  assert.equal(result.cards, 8, "The bracket always reserves eight alliance cards.");
  assert.equal(result.firstTeams, 3, "Regular events show three alliance picks.");
  assert.equal(result.secondTeams, 4, "World Championship-style alliances show four picks.");
  assert.deepEqual(result.firstAllianceOrder, ["1 Team 1", "2 Team 2", "3 Team 3"], "Alliance cards preserve TBA captain/pick order.");
  assert.equal(result.allianceTeamGap, "0px", "Alliance card team names have no extra gap.");
  assert.equal(result.highlightedAllianceCards, 1, "The selected team highlights its alliance card.");
  assert.equal(result.nextMatch, "M2", "The next unplayed playoff match is highlighted.");
  assert.match(result.nextMatchClass, /schedule-current/, "The next playoff match uses the schedule current-match highlight.");
  assert.deepEqual(result.highlightedTeamMatches, ["M4", "M8"], "Resolved downstream playoff matches highlight the selected team.");
  assert.equal(result.finalCardPositions.length, 2, "Both finals matches are rendered.");
  assert.ok(result.finalCardPositions[1] > result.finalCardPositions[0], "Finals 2 is below Finals 1.");
  assert.ok(result.highlightedAllianceBackgrounds.every((background) => !background.startsWith("rgba")), "Highlighted red and blue alliance strips remain opaque.");
  assert.notEqual(result.highlightBackground, "rgb(250, 191, 143)", "The beige highlight color is no longer used.");
  assert.equal(result.eliminated, 1);
  assert.equal(result.bracketMatches, 15, "The rendered bracket reserves every Figure 10-2 match slot plus both finals.");
  assert.deepEqual(result.bracketRounds, ["Round 1", "Round 2", "Round 3", "Round 4", "Round 5", "Finals"]);
  assert.deepEqual(result.lanes, ["Upper bracket", "Lower bracket"]);
  assert.match(result.connectorPath, /M175 5H184/);
  assert.equal(result.score, "100 - 90");
  assert.deepEqual(result.downstream, [
    { label: "M5", red: "A2: 4 - 5 - 6", blue: "Loser of M2" },
    { label: "M7", red: "A1: 1 - 2 - 3", blue: "Winner of M2" },
  ], "Completed input matches populate ordered, identified downstream alliances.");
  assert.equal(result.firstMatchRed, "A1: 1 - 2 - 3", "Bracket rows identify alliances and use captain/pick order.");
  await page.evaluate(() => {
    globalThis.__ticket167Fixture.matches[0].hasScore = false;
    globalThis.__ticket167Fixture.matches[0].redScore = -1;
    globalThis.__ticket167Fixture.matches[0].blueScore = -1;
    globalThis.render();
  });
  const pending = await page.evaluate(() => [...document.querySelectorAll(".playoff-bracket-match")].filter((node) => ["M5", "M7"].includes(node.querySelector("strong")?.textContent)).map((node) => ({ label: node.querySelector("strong").textContent, red: node.querySelector(".red").textContent.trim(), blue: node.querySelector(".blue").textContent.trim() })));
  assert.deepEqual(pending, [
    { label: "M5", red: "Loser of M1", blue: "Loser of M2" },
    { label: "M7", red: "Winner of M1", blue: "Winner of M2" },
  ], "Pending input matches retain the target graphic source labels.");
  await page.evaluate(() => {
    globalThis.__ticket167Fixture.playoffAlliances[1].status = { playoff_status: "active" };
    globalThis.__ticket167Fixture.matches.push(
      { id: "2026bracket_sf99m1", compLevel: "sf", setNumber: 99, number: 1, red: [4, 5, 6], blue: [1, 2, 3], redScore: 90, blueScore: 100, winningAlliance: "blue", hasScore: true },
      { id: "2026bracket_sf100m1", compLevel: "sf", setNumber: 100, number: 1, red: [4, 5, 6], blue: [1, 2, 3], redScore: 80, blueScore: 100, winningAlliance: "blue", hasScore: true },
    );
    globalThis.render();
  });
  assert.equal(await page.locator(".playoff-alliance-card:nth-child(2).playoff-eliminated").count(), 1, "Two recorded playoff losses gray an alliance without status metadata.");
  assert.equal(result.highlightDefault, "686");
  assert.equal(result.boardOverflowX, "visible", "The fluid bracket should not need an inner horizontal scrollbar.");
  assert.equal(result.boardOverflowY, "visible", "The bracket should not create a redundant inner vertical scrollbar.");
  console.log("PASS rendered playoff bracket supports eight cards, three/four-team alliances, scores, and elimination state");
} finally {
  await browser.close();
}
