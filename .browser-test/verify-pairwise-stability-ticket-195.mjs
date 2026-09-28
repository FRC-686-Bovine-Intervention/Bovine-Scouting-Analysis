import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "../eventSimulator/server.mjs";
import { createRecordedEngine } from "../eventSimulator/engine.mjs";

const appUrl = process.env.SCOUTING_APP_URL || "http://localhost:4173/index.html";
const email = process.env.FIREBASE_LOCAL_ADMIN_EMAIL || "admin@example.test";
const password = process.env.FIREBASE_LOCAL_ADMIN_PASSWORD || "local-admin-password";
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || "";
const playwrightPath = [
  path.resolve(".browser-test/node_modules/playwright/index.mjs"),
  path.resolve("node_modules/playwright/index.mjs"),
].find((candidate) => fs.existsSync(candidate));
if (!playwrightPath) throw new Error("Playwright was not found in .browser-test/node_modules or node_modules.");
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const simulatorStatePath = path.join(os.tmpdir(), `pairwise-stability-195-${process.pid}.json`);
const simulator = createRecordedEngine({ recordingPath: path.resolve("recordings/2026azscor"), statePath: simulatorStatePath });
simulator.setState({ cursor: 500 });
const simulatorServer = createServer({ simulator });
await new Promise((resolve, reject) => {
  simulatorServer.once("error", reject);
  simulatorServer.listen(0, "127.0.0.1", resolve);
});
const simulatorPort = simulatorServer.address().port;
const browser = await chromium.launch({ headless: true, ...(executablePath && fs.existsSync(executablePath) ? { executablePath } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 900 } });
const page = await context.newPage();

async function visibleOrder() {
  return page.locator("[data-builder-team]").evaluateAll((tiles) => tiles.map((tile) => tile.dataset.builderTeam));
}

async function assertScrollRestored(expected, message) {
  await page.waitForFunction((scrollTop) => document.querySelector("[data-current-picklist]")?.scrollTop === scrollTop, expected, { timeout: 2000 });
  assert.equal(await page.locator("[data-current-picklist]").evaluate((element) => element.scrollTop), expected, message);
}

try {
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
  await page.goto(appUrl);
  if (await page.locator("#firebaseLoginButton").count()) {
    await page.fill("#firebaseEmailInput", email);
    await page.fill("#firebasePasswordInput", password);
    await page.click("#firebaseLoginButton");
  }
  if (await page.locator(".app-shell").count()) await page.locator('[data-view="adminEventControl"]').click();
  else await page.waitForSelector("#adminEventCodeInput");
  await page.fill("#adminEventCodeInput", "2026azscor");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => state.activeEventKey === "2026azscor" && !state.eventLookupPending, null, { timeout: 60000 });
  await page.locator('[data-view="picklistBuilder"]').click();
  const initialOrder = await visibleOrder();
  assert.ok(initialOrder.length >= 20, `Expected a long picklist, received ${initialOrder.length} teams.`);

  const currentList = page.locator("[data-current-picklist]");
  await currentList.click({ button: "right" });
  await page.locator("[data-pairwise-start]").click();
  const activeTeam = initialOrder[18];
  const startingScroll = await currentList.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return element.scrollTop;
  });
  assert.ok(startingScroll > 0, "The current picklist needs to be scrolled before selecting a lower team.");
  await page.locator(`[data-builder-team="${activeTeam}"]`).click();
  assert.equal(await currentList.evaluate((element) => element.scrollTop), startingScroll, "Selecting a lower team must preserve the current list scroll position.");
  assert.ok(await page.locator(`[data-builder-team="${activeTeam}"].team-focused`).count(), "The selected lower team must remain visually marked.");
  await page.keyboard.down("Shift");
  await assertScrollRestored(startingScroll, "Beginning a pairwise comparison must preserve the current list scroll position.");
  await page.keyboard.down("ArrowUp");
  await assertScrollRestored(startingScroll, "Moving a team in pairwise mode must preserve the current list scroll position.");
  await page.keyboard.up("ArrowUp");
  await page.keyboard.up("Shift");
  await assertScrollRestored(startingScroll, "Finishing a pairwise comparison must preserve the current list scroll position.");
  const afterMove = await visibleOrder();
  const movedIndex = afterMove.indexOf(activeTeam);
  assert.equal(movedIndex, 17, "The selected lower team should move up exactly one pairwise position.");
  const unrelatedOrder = afterMove.filter((team) => team !== activeTeam);
  const prePlaybackScroll = startingScroll;
  assert.ok(prePlaybackScroll > 0, "The current picklist needs to be scrolled to reproduce the reported lower-team view.");
  const selectedIdentity = await page.locator(`[data-builder-team="${activeTeam}"]`).getAttribute("data-builder-team");
  assert.equal(selectedIdentity, activeTeam, "The selected team should remain identifiable before playback.");

  const playbackObservations = [];
  for (let tick = 0; tick < 3; tick += 1) {
    if (tick > 0) await page.waitForTimeout(5000);
    const expectedCursor = simulator.getState().cursor + 1;
    simulator.advance(1);
    await page.evaluate(() => refreshSimulatorSources({ trigger: "ticket-195-slow-playback" }));
    await page.waitForTimeout(100);
    playbackObservations.push({
      ...(await currentList.evaluate((element) => ({ scrollTop: element.scrollTop, scrollHeight: element.scrollHeight }))),
      cursor: expectedCursor,
    });
    assert.deepEqual(await visibleOrder(), afterMove, `Slow recording update ${tick + 1} must not reorder any unrelated lower teams.`);
    assert.ok(await page.locator(`[data-builder-team="${activeTeam}"].team-focused`).count(), `Slow recording update ${tick + 1} must keep the selected team visually marked.`);
    assert.equal(playbackObservations.at(-1).scrollTop, prePlaybackScroll, `Slow recording update ${tick + 1} at cursor ${expectedCursor} must preserve current-picklist scroll position.`);
  }

  await page.locator("[data-pairwise-save]").click();
  const savedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem("frc-scouting-picklists:2026azscor"))[0].teams.map(String));
  assert.deepEqual(savedOrder, afterMove, "Saving pairwise results must persist the order that was selected.");
  assert.deepEqual(savedOrder.filter((team) => team !== activeTeam), unrelatedOrder, "Saved pairwise results must retain the order of unrelated lower teams.");
  console.log(JSON.stringify({ pass: true, recording: "2026azscor", playbackIntervalSeconds: 5, updates: playbackObservations.length, activeTeam, finalIndex: movedIndex, playbackObservations }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => simulatorServer.close(resolve));
  fs.rmSync(simulatorStatePath, { force: true });
}
