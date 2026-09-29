import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRecordedEngine } from "../eventSimulator/engine.mjs";
import { createServer } from "../eventSimulator/server.mjs";

const appUrl = process.env.SCOUTING_APP_URL || "http://localhost:4173/index.html";
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || "";
const playwrightPath = [
  path.resolve(".browser-test/node_modules/playwright/index.mjs"),
  path.resolve("node_modules/playwright/index.mjs"),
].find((candidate) => fs.existsSync(candidate));
if (!playwrightPath) throw new Error("Playwright was not found in .browser-test/node_modules or node_modules.");
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const simulatorStatePath = path.join(os.tmpdir(), `alliance-reorder-205-${process.pid}.json`);
const simulator = createRecordedEngine({ recordingPath: path.resolve("recordings/2026azscor"), statePath: simulatorStatePath });
const simulatorServer = createServer({ simulator });
let browser;

try {
  await new Promise((resolve, reject) => {
    simulatorServer.once("error", reject);
    simulatorServer.listen(0, "127.0.0.1", resolve);
  });
  const simulatorPort = simulatorServer.address().port;
  const response = await fetch(`http://127.0.0.1:${simulatorPort}/api/tba/event/2026azscor/teams`);
  assert.equal(response.status, 200, "The recorded event simulator should serve the real team list.");
  const recordedTeams = await response.json();
  const recordedTeam = recordedTeams.find((team) => team.team_number === 10988);
  assert.ok(recordedTeam, "The recorded event must include real team 10988.");
  const baseTeam = {
    id: "frc10988", key: recordedTeam.key, number: 10988, label: "10988",
    name: recordedTeam.nickname, isSuffixed: false, matches: [], sources: {}, derived: {},
  };
  const browserFixture = [
    baseTeam,
    { ...baseTeam, id: "frc10988B", key: "frc10988B", label: "10988B", isSuffixed: true },
    { ...baseTeam, id: "frc4638", key: "frc4638", number: 4638, label: "4638", name: "Ravens" },
    { ...baseTeam, id: "frc9999", key: "frc9999", number: 9999, label: "9999", name: "Continuation team" },
  ];
  browser = await chromium.launch({ headless: true, ...(executablePath && fs.existsSync(executablePath) ? { executablePath } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript((teams) => {
    globalThis.eventCatalog = [{
      key: "2026chcmp", season: 2026, seasonLabel: "2026", name: "Alliance Reorder Regression",
      teams, teamNumbers: teams.map((team) => team.number), matches: [], matchesComplete: 0,
      scoringComponents: [], metrics: [], seedPicklists: [], seedSortEquations: [], formulaFieldDefinitions: [], dataSources: [],
    }];
  }, browserFixture);
  await page.goto(appUrl);
  await page.waitForFunction(() => globalThis.__scoutingAppState && globalThis.render);
  await page.evaluate(() => {
    globalThis.__allianceBoardDragEvents = { dragstart: 0, drop: 0 };
    document.addEventListener("dragstart", () => globalThis.__allianceBoardDragEvents.dragstart++, true);
    document.addEventListener("drop", () => globalThis.__allianceBoardDragEvents.drop++, true);
    globalThis.firebaseCurrentUser = { uid: "ticket-205-browser-test" };
    const state = globalThis.__scoutingAppState;
    state.user = "Ticket 205 test";
    state.activeEventKey = "2026chcmp";
    state.activeView = "alliance";
    state.picklists = [{ id: "simulator-source", name: "Recorded event source", teams: [10988, "frc10988B", 4638, 9999] }];
    state.loadedSources = ["picklist:simulator-source"];
    state.allianceBoard = ["frc10988B", 10988, 4638, ...Array(21).fill(null)];
    state.picklistCompareTeams = [null, null, null, null];
    localStorage.setItem("frc-scouting-alliance-board:2026chcmp", JSON.stringify(state.allianceBoard));
    localStorage.setItem("frc-scouting-picklists:2026chcmp", JSON.stringify(state.picklists));
    localStorage.setItem("frc-scouting-loaded-picklists:2026chcmp", JSON.stringify(state.loadedSources));
    globalThis.render();
  });

  const source = page.locator('[data-board-cell="0"]');
  const target = page.locator('[data-board-cell="1"]');
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  assert.ok(sourceBox && targetBox, "The occupied source and target board cells must be visible.");
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 8, sourceBox.y + sourceBox.height / 2 + 4, { steps: 4 });
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
  await page.mouse.up();

  const afterReorder = await page.evaluate(() => ({
    state: globalThis.__scoutingAppState.allianceBoard.slice(0, 4),
    selectedTeams: globalThis.__scoutingAppState.allianceBoard.filter((team) => team !== null),
    dom: [...document.querySelectorAll("[data-board-cell]")].slice(0, 4).map((cell) => cell.dataset.boardTeam || null),
    displayedTeams: [...document.querySelectorAll("[data-board-cell]")].map((cell) => cell.dataset.boardTeam).filter(Boolean),
    dragEvents: globalThis.__allianceBoardDragEvents,
    saved: JSON.parse(localStorage.getItem("frc-scouting-alliance-board:2026chcmp") || "null"),
  }));
  assert.deepEqual(afterReorder.state.slice(0, 3), [10988, "frc10988B", 4638], `Dragging the first occupant over the second should reorder the board: ${JSON.stringify(afterReorder)}.`);
  assert.deepEqual(afterReorder.selectedTeams, [10988, "frc10988B", 4638], "Reordering must leave every selected team present exactly once.");
  assert.deepEqual(afterReorder.dom.slice(0, 3), ["10988", "frc10988B", "4638"], "The board DOM must immediately reflect the new order.");
  assert.deepEqual(afterReorder.displayedTeams, ["10988", "frc10988B", "4638"], "The full board must display each selected team exactly once.");
  assert.ok(afterReorder.dragEvents?.dragstart > 0 && afterReorder.dragEvents?.drop > 0, "The reorder must use an actual board-cell dragstart and drop.");
  assert.deepEqual(afterReorder.saved?.slice(0, 3), [10988, "frc10988B", 4638], "The reordered identities must be persisted.");

  const sourceTile = page.locator('[data-alliance-team="9999"]');
  const emptyCell = page.locator('[data-board-cell="3"]');
  const sourceTileBox = await sourceTile.boundingBox();
  const emptyCellBox = await emptyCell.boundingBox();
  assert.ok(sourceTileBox && emptyCellBox, "A remaining source team and an empty slot must be visible after reordering.");
  await page.mouse.move(sourceTileBox.x + sourceTileBox.width / 2, sourceTileBox.y + sourceTileBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceTileBox.x + sourceTileBox.width / 2 + 8, sourceTileBox.y + sourceTileBox.height / 2 + 4, { steps: 4 });
  await page.mouse.move(emptyCellBox.x + emptyCellBox.width / 2, emptyCellBox.y + emptyCellBox.height / 2, { steps: 12 });
  await page.mouse.up();
  const continuedOrder = await page.evaluate(() => globalThis.__scoutingAppState.allianceBoard.filter((team) => team !== null));
  assert.deepEqual(continuedOrder, [10988, "frc10988B", 4638, 9999], "Selection must continue after reordering without losing or duplicating a selected team.");
  await page.reload();
  await page.waitForFunction(() => globalThis.__scoutingAppState && globalThis.render);
  const afterReload = await page.evaluate(() => globalThis.__scoutingAppState.allianceBoard.filter((team) => team !== null));
  assert.deepEqual(afterReload, [10988, "frc10988B", 4638, 9999], "The reordered order and continued selection must survive reload without duplicates or losses.");
  console.log(JSON.stringify({ pass: true, simulator: "2026azscor", simulatorPort, afterReorder, afterReload, continuedOrder }, null, 2));
} finally {
  if (browser) await browser.close();
  if (simulatorServer.listening) await new Promise((resolve) => simulatorServer.close(resolve));
  fs.rmSync(simulatorStatePath, { force: true });
}
