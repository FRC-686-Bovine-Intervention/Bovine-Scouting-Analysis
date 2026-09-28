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
const playwrightPath = [".browser-test/node_modules/playwright/index.mjs", "node_modules/playwright/index.mjs"]
  .map((candidate) => path.resolve(candidate)).find((candidate) => fs.existsSync(candidate));
if (!playwrightPath) throw new Error("Playwright was not found.");
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const simulatorStatePath = path.join(os.tmpdir(), `pairwise-click-196-${process.pid}.json`);
const simulator = createRecordedEngine({ recordingPath: path.resolve("recordings/2026azscor"), statePath: simulatorStatePath });
simulator.setState({ cursor: 513 });
const simulatorServer = createServer({ simulator });
await new Promise((resolve, reject) => { simulatorServer.once("error", reject); simulatorServer.listen(0, "127.0.0.1", resolve); });
const simulatorPort = simulatorServer.address().port;
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
const page = await browser.newPage();

try {
  await page.route("**/runtime-config.local.js*", (route) => route.fulfill({
    status: 200,
    contentType: "text/javascript",
    body: `globalThis.__EVENT_SIMULATOR_CONFIG = Object.freeze(${JSON.stringify({ mode: "simulator-first", tbaUrl: `http://127.0.0.1:${simulatorPort}/api/tba`, statboticsUrl: `http://127.0.0.1:${simulatorPort}/api/statbotics`, scoutingUrl: `http://127.0.0.1:${simulatorPort}/api/scouting/2026azscor` })});`,
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
  const order = await page.locator("[data-builder-team]").evaluateAll((tiles) => tiles.map((tile) => tile.dataset.builderTeam));
  assert.ok(order.length >= 5, "Expected the simulator picklist.");
  await page.locator("[data-current-picklist]").click({ button: "right" });
  await page.locator("[data-pairwise-start]").click();

  const active = order[4];
  await page.locator(`[data-builder-team="${active}"]`).click();
  await page.keyboard.down("Shift");
  await page.keyboard.press("ArrowUp");
  const comparison = await page.evaluate(() => ({
    session: { mode: state.pairwisePicklist.session.mode, active: String(state.pairwisePicklist.session.activeTeam), compared: String(state.pairwisePicklist.session.comparedTeam) },
    order: state.pairwisePicklist.session.teams.map(String),
  }));
  assert.equal(comparison.session.mode, "sort");
  assert.ok(comparison.session.compared, "Expected a team to compare against.");
  await page.locator(`[data-builder-team="${comparison.session.compared}"]`).click();
  await page.keyboard.up("Shift");
  const after = await page.evaluate(() => ({
    session: state.pairwisePicklist.session && { mode: state.pairwisePicklist.session.mode, cursor: String(state.pairwisePicklist.session.teams[state.pairwisePicklist.session.cursorIndex]) },
    order: [...document.querySelectorAll("[data-builder-team]")].map((tile) => tile.dataset.builderTeam),
  }));
  assert.equal(after.session?.mode, "select", "Clicking a compared team must resolve the comparison.");
  assert.ok(await page.locator(`[data-builder-team="${comparison.session.compared}"].team-focused`).count(), "The clicked winning team must be visibly selected.");
  assert.ok(after.order.indexOf(comparison.session.compared) < after.order.indexOf(comparison.session.active), "The clicked team must win the pairwise comparison.");

  await page.locator(`[data-builder-team="${comparison.session.active}"]`).click();
  await page.keyboard.down("Shift");
  await page.keyboard.press("ArrowUp");
  const reverseComparison = await page.evaluate(() => ({
    active: String(state.pairwisePicklist.session.activeTeam),
    compared: String(state.pairwisePicklist.session.comparedTeam),
  }));
  await page.locator(`[data-builder-team="${reverseComparison.active}"]`).click();
  const reversed = await page.evaluate(() => ({
    mode: state.pairwisePicklist.session.mode,
    order: [...document.querySelectorAll("[data-builder-team]")].map((tile) => tile.dataset.builderTeam),
  }));
  await page.keyboard.up("Shift");
  assert.equal(reversed.mode, "select", "Clicking the active tile must also resolve the comparison.");
  assert.ok(await page.locator(`[data-builder-team="${reverseComparison.active}"].team-focused`).count(), "The active winner must be visibly selected.");
  assert.ok(reversed.order.indexOf(reverseComparison.active) < reversed.order.indexOf(reverseComparison.compared), "Clicking the active team must produce the opposite outcome.");

  await page.locator("[data-pairwise-save]").click();
  await page.evaluate(() => {
    const picklist = activePicklist();
    const base = picklist.teams.find((team) => String(team) === "10988");
    const suffixed = picklist.teams.find((team) => String(team) === "frc10988B");
    picklist.teams = [base, suffixed];
    saveState();
    render();
  });
  await page.locator("[data-current-picklist]").click({ button: "right" });
  await page.locator("[data-pairwise-start]").click();
  await page.locator('[data-builder-team="frc10988B"]').click();
  await page.keyboard.down("Shift");
  await page.keyboard.press("ArrowUp");
  assert.ok(await page.locator('[data-builder-team="frc10988B"].pairwise-active').count(), "The suffixed active team must keep its visible identity.");
  assert.ok(await page.locator('[data-builder-team="10988"].pairwise-compared').count(), "The base team must remain distinct from the suffixed comparison.");
  await page.locator('[data-builder-team="10988"]').click();
  await page.keyboard.up("Shift");
  assert.ok(await page.locator('[data-builder-team="10988"].team-focused').count(), "The clicked base team must become the selected winner against its B variant.");
  assert.ok(await page.locator('[data-builder-team="10988"]').evaluate((tile) => tile.compareDocumentPosition(document.querySelector('[data-builder-team="frc10988B"]')) & Node.DOCUMENT_POSITION_FOLLOWING), "The base team should rank above the suffixed B team after selection.");
  console.log(JSON.stringify({ pass: true, recording: "2026azscor", active: comparison.session.active, clickedWinner: comparison.session.compared, before: comparison.order, after: after.order, suffixedTeamWinner: "10988" }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => simulatorServer.close(resolve));
  fs.rmSync(simulatorStatePath, { force: true });
}
