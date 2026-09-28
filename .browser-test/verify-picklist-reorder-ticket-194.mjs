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
const candidates = [
  path.resolve(".browser-test/node_modules/playwright/index.mjs"),
  path.resolve("node_modules/playwright/index.mjs"),
];
const playwrightPath = candidates.find((candidate) => fs.existsSync(candidate));
if (!playwrightPath) throw new Error(`Playwright was not found: ${candidates.join(", ")}`);
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const simulatorStatePath = path.join(os.tmpdir(), `picklist-reorder-194-${process.pid}.json`);
const simulator = createRecordedEngine({ recordingPath: path.resolve("recordings/2026azscor"), statePath: simulatorStatePath });
simulator.setState({ cursor: 513 });
const simulatorServer = createServer({ simulator });
await new Promise((resolve, reject) => {
  simulatorServer.once("error", reject);
  simulatorServer.listen(0, "127.0.0.1", resolve);
});
const simulatorPort = simulatorServer.address().port;
const browser = await chromium.launch({ headless: true, ...(executablePath && fs.existsSync(executablePath) ? { executablePath } : {}) });
const context = await browser.newContext();
const page = await context.newPage();

async function visibleOrder() {
  return page.locator("[data-reorder-team]").evaluateAll((tiles) => tiles.map((tile) => tile.dataset.reorderTeam));
}

async function waitForVisibleOrder(expected) {
  await page.waitForFunction((order) => JSON.stringify([...document.querySelectorAll("[data-reorder-team]")].map((tile) => tile.dataset.reorderTeam)) === JSON.stringify(order), expected, { timeout: 5000 });
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

  const longOrder = await visibleOrder();
  assert.ok(longOrder.length >= 5, `Expected a long seeded picklist, got ${longOrder.length} teams.`);
  const draggedTeam = "frc10988B";
  const baseTeam = "10988";
  const teamDiagnostics = await page.evaluate(() => ({ eventKey: currentEvent().key, teamCount: currentEvent().teams.length, currentCount: currentTeams().length, suffixedRoster: currentEvent().teams.filter((team) => team.isSuffixed).map((team) => ({ id: team.id, number: team.number, label: team.label })) }));
  assert.ok(longOrder.includes(draggedTeam), `Arizona Scorcher picklist omitted ${draggedTeam}; team diagnostics: ${JSON.stringify(teamDiagnostics)}`);
  assert.ok(longOrder.includes(baseTeam), "Arizona Scorcher roster omitted the base 10988 team.");
  assert.equal(new Set(longOrder).size, longOrder.length, "The picklist should contain unique identities for base and suffixed teams.");
  await page.setViewportSize({ width: 1920, height: 1800 });
  await page.addStyleTag({ content: ".current-picklist-list { max-height: 1600px !important; }" });
  const draggedIndex = longOrder.indexOf(draggedTeam);
  const targetTeam = longOrder[4];
  assert.ok(Math.abs(draggedIndex - longOrder.indexOf(targetTeam)) >= 10, "The long-list drag should cross multiple positions.");
  const expectedLongOrder = longOrder.filter((team) => team !== draggedTeam);
  expectedLongOrder.splice(expectedLongOrder.indexOf(targetTeam), 0, draggedTeam);
  await page.locator(`[data-reorder-team="${draggedTeam}"]`).dragTo(page.locator(`[data-reorder-team="${targetTeam}"]`));
  await waitForVisibleOrder(expectedLongOrder);
  assert.deepEqual(await visibleOrder(), expectedLongOrder, "Dragging the suffixed team in a long picklist should place the same identity before the target without duplicating it.");
  await page.waitForTimeout(800);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("frc-scouting-picklists:2026azscor"))[0].teams.map(String)), expectedLongOrder, "The suffixed-team drag order should be saved in event-scoped local storage.");
  await page.evaluate(() => render());
  assert.deepEqual(await visibleOrder(), expectedLongOrder, "The long picklist should keep its order after an app rerender.");

  await page.evaluate(() => {
    const picklist = activePicklist();
    const base = picklist.teams.find((team) => String(team) === "10988");
    const suffixed = picklist.teams.find((team) => String(team) === "frc10988B");
    picklist.teams = [suffixed, base];
    saveState();
    render();
  });
  const shortOrder = await visibleOrder();
  assert.equal(shortOrder.length, 2, `Expected a two-team picklist, got ${shortOrder.length} teams.`);
  assert.match(baseTeam, /^\d+$/, "The base team drag should exercise the ordinary numeric-ID case.");
  assert.deepEqual(shortOrder, [draggedTeam, baseTeam], "The short list should retain separate base and suffixed team identities.");
  await page.locator(`[data-reorder-team="${baseTeam}"]`).dragTo(page.locator(`[data-reorder-team="${draggedTeam}"]`));
  const expectedNumericOrder = [baseTeam, draggedTeam];
  await waitForVisibleOrder(expectedNumericOrder);
  assert.deepEqual(await visibleOrder(), expectedNumericOrder, "Dragging a numeric-ID team should move its existing number rather than append a duplicate string.");
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("frc-scouting-picklists:2026azscor"))[0].teams.map(String)), expectedNumericOrder, "The numeric-team drag order should persist to event-scoped local storage.");
  await page.evaluate(() => render());
  assert.deepEqual(await visibleOrder(), expectedNumericOrder, "The numeric-team order should survive an app rerender.");
  const movedTeam = draggedTeam;
  await page.locator(`[data-builder-team="${movedTeam}"]`).click();
  await page.keyboard.press("Shift+ArrowUp");
  const expectedShortOrder = [draggedTeam, baseTeam];
  await waitForVisibleOrder(expectedShortOrder);
  assert.deepEqual(await visibleOrder(), expectedShortOrder, "Shift+ArrowUp should move the suffixed team in a short picklist.");
  const announcement = await page.locator("#picklistReorderStatus").textContent();
  assert.match(announcement || "", /10988B.*position 1 of 2/i, "Keyboard reordering should announce the suffixed team's new visible position.");
  await page.keyboard.press("Shift+ArrowUp");
  assert.deepEqual(await visibleOrder(), expectedShortOrder, "A keyboard move at the top boundary should leave the short-list order unchanged.");
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("frc-scouting-picklists:2026azscor"))[0].teams.map(String)), expectedShortOrder, "The keyboard order should be saved in event-scoped local storage.");
  await page.evaluate(() => render());
  assert.deepEqual(await visibleOrder(), expectedShortOrder, "The short picklist should keep its order after an app rerender.");
  assert.equal((await visibleOrder()).filter((team) => team === baseTeam).length, 1, "Base team 10988 should remain unique after the reorder and rerender.");
  console.log(JSON.stringify({ pass: true, recording: "2026azscor", longOrder: expectedLongOrder, shortOrder: expectedShortOrder, announcement: announcement.trim() }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => simulatorServer.close(resolve));
  fs.rmSync(simulatorStatePath, { force: true });
}
