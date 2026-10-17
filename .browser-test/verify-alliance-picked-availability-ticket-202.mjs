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
const simulatorStatePath = path.join(os.tmpdir(), `alliance-picked-202-${process.pid}.json`);
const simulator = createRecordedEngine({ recordingPath: path.resolve("recordings/2026azscor"), statePath: simulatorStatePath });
const simulatorServer = createServer({ simulator });
let browser;

try {
  await new Promise((resolve, reject) => {
    simulatorServer.once("error", reject);
    simulatorServer.listen(0, "127.0.0.1", resolve);
  });
  const simulatorPort = simulatorServer.address().port;
  const teamsResponse = await fetch(`http://127.0.0.1:${simulatorPort}/api/tba/event/2026azscor/teams`);
  assert.equal(teamsResponse.status, 200, "The recorded simulator should provide the real event roster.");
  const recordedTeams = await teamsResponse.json();
  const recordedTeam = recordedTeams.find((team) => team.team_number === 10988);
  assert.ok(recordedTeam, "The real event roster should include team 10988.");
  const baseTeam = {
    id: "frc10988", key: recordedTeam.key, number: 10988, label: "10988",
    name: recordedTeam.nickname, isSuffixed: false, matches: [], sources: {}, derived: {},
  };
  // B identity is distinct from the live base identity; no provider data is added for it.
  const teams = [baseTeam, { ...baseTeam, id: "frc10988B", key: "frc10988B", label: "10988B", isSuffixed: true },
    { ...baseTeam, id: "frc4638", key: "frc4638", number: 4638, label: "4638", name: "Ravens" },
    { ...baseTeam, id: "frc9999", key: "frc9999", number: 9999, label: "9999", name: "Continuation team" }];

  browser = await chromium.launch({ headless: true, ...(executablePath && fs.existsSync(executablePath) ? { executablePath } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route("**/runtime-config.local.js*", (route) => route.fulfill({
    status: 200,
    contentType: "text/javascript",
    body: `globalThis.__EVENT_SIMULATOR_CONFIG = Object.freeze(${JSON.stringify({
      mode: "simulator-first",
      tbaUrl: `http://127.0.0.1:${simulatorPort}/api/tba`,
      statboticsUrl: `http://127.0.0.1:${simulatorPort}/api/statbotics`,
      scoutingUrl: `http://127.0.0.1:${simulatorPort}/api/scouting/2026azscor`,
    })});`,
  }));
  await page.addInitScript((eventTeams) => {
    globalThis.eventCatalog = [{
      key: "2026chcmp", season: 2026, seasonLabel: "2026", name: "Alliance Availability Regression",
      teams: eventTeams, teamNumbers: eventTeams.map((team) => team.number), matches: [], matchesComplete: 0,
      scoringComponents: [], metrics: [], seedPicklists: [], seedSortEquations: [], formulaFieldDefinitions: [], dataSources: [],
    }];
  }, teams);
  await page.goto(appUrl);
  await page.waitForFunction(() => globalThis.__scoutingAppState && globalThis.render);
  await page.evaluate(() => {
    globalThis.firebaseCurrentUser = { uid: "ticket-202-browser-test" };
    const state = globalThis.__scoutingAppState;
    state.user = "Ticket 202 test";
    state.activeEventKey = "2026chcmp";
    globalThis.__scoutingActiveEventKey = state.activeEventKey;
    state.activeView = "alliance";
    state.picklists = [{ id: "simulator-source", name: "Recorded event source", teams: [10988, "frc10988B", 4638, 9999] }];
    state.loadedSources = ["picklist:simulator-source"];
    state.allianceBoard = Array(24).fill(null);
    state.picklistCompareTeams = [null, null, null, null];
    saveState();
    render();
  });

  const dragToBoard = async (teamId, index) => {
    const source = page.locator(`[data-alliance-team="${teamId}"]`);
    const target = page.locator(`[data-board-cell="${index}"]`);
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    assert.ok(sourceBox && targetBox, `Team ${teamId} and board slot ${index + 1} should be visible.`);
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 8, sourceBox.y + sourceBox.height / 2 + 4, { steps: 4 });
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
    await page.mouse.up();
  };
  const styleFor = (teamId) => page.locator(`[data-alliance-team="${teamId}"]`).first().evaluate((tile) => ({
    disabled: tile.disabled,
    ariaDisabled: tile.getAttribute("aria-disabled"),
    draggable: tile.draggable,
    background: getComputedStyle(tile).backgroundColor,
    opacity: getComputedStyle(tile).opacity,
    color: getComputedStyle(tile).color,
    decoration: getComputedStyle(tile).textDecorationLine,
  }));

  await dragToBoard("frc10988B", 0);
  await dragToBoard("10988", 1);
  const unavailable = { base: await styleFor("10988"), b: await styleFor("frc10988B") };
  for (const [id, style] of Object.entries(unavailable)) {
    assert.equal(style.background, "rgb(128, 128, 128)", `${id} picked tile must have a gray background: ${JSON.stringify(style)}`);
    assert.equal(style.opacity, "0.5", `${id} picked tile must be at 50% opacity: ${JSON.stringify(style)}`);
    assert.equal(style.color, "rgb(0, 0, 0)", `${id} picked tile text must be black: ${JSON.stringify(style)}`);
    assert.equal(style.decoration, "line-through", `${id} picked tile text must be struck through: ${JSON.stringify(style)}`);
    assert.equal(style.disabled, true, `${id} picked tile must be semantically unavailable: ${JSON.stringify(style)}`);
    assert.equal(style.ariaDisabled, "true");
    assert.equal(style.draggable, false);
  }
  assert.equal(await page.evaluate(() => globalThis.placeTeamOnBoard("frc10988", 2)), false, "The same canonical identity cannot be placed twice.");
  assert.equal(await page.evaluate(() => globalThis.placeTeamOnBoard("10988B", 2)), false, "The B identity cannot be selected through its display label alias.");
  assert.equal(await page.evaluate(() => globalThis.__scoutingAppState.allianceBoard.filter(Boolean).length), 2);

  const first = page.locator('[data-board-cell="0"]');
  const second = page.locator('[data-board-cell="1"]');
  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();
  assert.ok(firstBox && secondBox);
  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(firstBox.x + firstBox.width / 2 + 8, firstBox.y + firstBox.height / 2 + 4, { steps: 4 });
  await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, { steps: 12 });
  await page.mouse.up();
  assert.deepEqual(await page.evaluate(() => globalThis.__scoutingAppState.allianceBoard.slice(0, 2)), [10988, "frc10988B"], "Reordering keeps both identities picked.");
  assert.equal((await styleFor("10988")).disabled, true, "The base team remains unavailable after board reorder.");
  assert.equal((await styleFor("frc10988B")).disabled, true, "The B identity remains unavailable after board reorder.");

  await page.locator('[data-board-cell="1"]').click({ button: "right" });
  await page.locator('[data-remove-cell="1"]').click();
  const afterRemoval = { base: await styleFor("10988"), b: await styleFor("frc10988B") };
  assert.equal(afterRemoval.base.disabled, true, "Removing the B identity must not make the base team available.");
  assert.equal(afterRemoval.b.disabled, false, "Removing a board pick immediately restores its source availability.");
  assert.equal(afterRemoval.b.draggable, true);

  await page.evaluate(() => render());
  const afterRefresh = { base: await styleFor("10988"), b: await styleFor("frc10988B") };
  assert.equal(afterRefresh.base.disabled, true, "The remaining base pick stays unavailable after Alliance view refresh.");
  assert.equal(afterRefresh.b.disabled, false, "The removed B identity stays available after Alliance view refresh.");
  assert.deepEqual(await page.evaluate(() => globalThis.__scoutingAppState.allianceBoard.filter(Boolean)), [10988], "Refresh preserves the remaining canonical selection.");
  console.log(JSON.stringify({ pass: true, simulator: "2026azscor", simulatorPort, unavailable, afterRemoval, afterRefresh }, null, 2));
} finally {
  if (browser) await browser.close();
  if (simulatorServer.listening) await new Promise((resolve) => simulatorServer.close(resolve));
  fs.rmSync(simulatorStatePath, { force: true });
}
