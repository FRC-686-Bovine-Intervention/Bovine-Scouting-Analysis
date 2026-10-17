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
const simulatorStatePath = path.join(os.tmpdir(), `alliance-drop-207-${process.pid}.json`);
const simulator = createRecordedEngine({ recordingPath: path.resolve("recordings/2026azscor"), statePath: simulatorStatePath });
const simulatorServer = createServer({ simulator });
let browser;

try {
  await new Promise((resolve, reject) => {
    simulatorServer.once("error", reject);
    simulatorServer.listen(0, "127.0.0.1", resolve);
  });
  const simulatorPort = simulatorServer.address().port;
  const simulatorTeamsResponse = await fetch(`http://127.0.0.1:${simulatorPort}/api/tba/event/2026azscor/teams`);
  assert.equal(simulatorTeamsResponse.status, 200, "The recorded event simulator should serve the real team list.");
  const simulatorTeams = await simulatorTeamsResponse.json();
  const simulatorTeam = simulatorTeams.find((team) => team.team_number === 10988);
  assert.ok(simulatorTeam, "The recorded event must include real team 10988.");
  const baseTeam = {
    id: "frc10988",
    key: simulatorTeam.key,
    number: simulatorTeam.team_number,
    label: String(simulatorTeam.team_number),
    name: simulatorTeam.nickname,
    isSuffixed: false,
    matches: [],
    sources: {},
    derived: {},
  };
  // A test-only B identity shares the simulator's real base team number. It exercises
  // selector identity preservation without inventing any provider data for that robot.
  const bTeam = { ...baseTeam, id: "frc10988B", key: "frc10988B", label: "10988B", isSuffixed: true };
  const browserFixture = [baseTeam, bTeam, { ...baseTeam, id: "frc4638", key: "frc4638", number: 4638, label: "4638", name: "Ravens" }];

  browser = await chromium.launch({ headless: true, ...(executablePath && fs.existsSync(executablePath) ? { executablePath } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript((teams) => {
    globalThis.eventCatalog = [{
      key: "2026chcmp",
      season: 2026,
      seasonLabel: "2026",
      name: "Alliance Drop Regression",
      teams,
      teamNumbers: teams.map((team) => team.number),
      matches: [],
      matchesComplete: 0,
      scoringComponents: [],
      metrics: [],
      seedPicklists: [],
      seedSortEquations: [],
      formulaFieldDefinitions: [],
      dataSources: [],
    }];
    globalThis.__allianceDropStarted = false;
  }, browserFixture);
  await page.goto(appUrl);
  await page.waitForFunction(() => globalThis.__scoutingAppState && globalThis.render);

  await page.evaluate(() => {
    globalThis.firebaseCurrentUser = { uid: "ticket-207-browser-test" };
    const state = globalThis.__scoutingAppState;
    state.user = "Ticket 207 test";
    state.activeEventKey = "2026chcmp";
    state.activeView = "alliance";
    state.picklists = [{ id: "simulator-source", name: "Recorded event source", teams: [10988, "frc10988B", 4638] }];
    state.loadedSources = ["picklist:simulator-source"];
    state.allianceBoard = Array(24).fill(null);
    state.picklistCompareTeams = [null, null, null, null];
    globalThis.render();
    const tile = document.querySelector('[data-alliance-team="10988"]');
    const bTile = document.querySelector('[data-alliance-team="frc10988B"]');
    if (!tile || !bTile) throw new Error(`Base and B-robot source tiles were not rendered: ${JSON.stringify({ tileCount: document.querySelectorAll("[data-alliance-team]").length, activeEventKey: state.activeEventKey, activeView: state.activeView, loadedSources: state.loadedSources, picklists: state.picklists })}.`);
    bTile.addEventListener("dragstart", () => { globalThis.__allianceDropStarted = true; }, { once: true });
  });

  const dragToBoard = async (teamId, cellIndex, waitForSlowDrag = false) => {
    const source = page.locator(`[data-alliance-team="${teamId}"]`);
    const target = page.locator(`[data-board-cell="${cellIndex}"]`);
    await source.scrollIntoViewIfNeeded();
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    assert.ok(sourceBox && targetBox, `Selector source ${teamId} and board slot ${cellIndex + 1} must be visible.`);
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 8, sourceBox.y + sourceBox.height / 2 + 4, { steps: 4 });
    if (waitForSlowDrag) {
      await page.waitForFunction(() => globalThis.__allianceDropStarted, null, { timeout: 3000 });
      await page.waitForTimeout(350);
    }
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
    await page.mouse.up();
  };
  await dragToBoard("frc10988B", 0, true);
  const afterFirstDrop = await page.evaluate(() => ({
    boardState: globalThis.__scoutingAppState.allianceBoard[0],
    cell: document.querySelector('[data-board-cell="0"]')?.outerHTML,
  }));
  assert.equal(afterFirstDrop.boardState, "frc10988B", `The first drop must retain the B-robot identity: ${JSON.stringify(afterFirstDrop)}.`);
  assert.match(afterFirstDrop.cell || "", /10988B/, `The B-robot team number must be visible immediately after the first drop: ${JSON.stringify(afterFirstDrop)}.`);
  assert.match(afterFirstDrop.cell || "", /occupied/, "The first drop must immediately communicate its selected state.");
  await dragToBoard("10988", 1);

  const afterDrop = await page.evaluate(() => ({
    boardState: globalThis.__scoutingAppState.allianceBoard.slice(0, 2),
    cells: [...document.querySelectorAll('[data-board-cell]')].slice(0, 2).map((cell) => cell.outerHTML),
  }));
  assert.deepEqual(afterDrop.boardState, ["frc10988B", 10988], `Both B and base team identities must be retained: ${JSON.stringify(afterDrop)}.`);
  assert.match(afterDrop.cells[0], /10988B/, `The B-robot team number must remain visible: ${JSON.stringify(afterDrop)}.`);
  assert.match(afterDrop.cells[0], /occupied/, "The B-robot's selected state must remain visible.");
  assert.match(afterDrop.cells[1], /10988/, `The base team number must remain visible after its drop: ${JSON.stringify(afterDrop)}.`);
  assert.match(afterDrop.cells[1], /occupied/, "The base team's selected state must be visible.");
  console.log(JSON.stringify({ pass: true, simulator: "2026azscor", simulatorPort, selectedTeams: [10988, "frc10988B"], afterDrop }, null, 2));
} finally {
  if (browser) await browser.close();
  if (simulatorServer.listening) await new Promise((resolve) => simulatorServer.close(resolve));
  fs.rmSync(simulatorStatePath, { force: true });
}
