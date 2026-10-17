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
const simulatorStatePath = path.join(os.tmpdir(), `alliance-highlighter-201-${process.pid}.json`);
const simulator = createRecordedEngine({ recordingPath: path.resolve("recordings/2026azscor"), statePath: simulatorStatePath });
simulator.setState({ cursor: 513 });
const simulatorServer = createServer({ simulator });
await new Promise((resolve, reject) => {
  simulatorServer.once("error", reject);
  simulatorServer.listen(0, "127.0.0.1", resolve);
});
const simulatorPort = simulatorServer.address().port;
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const context = await browser.newContext();
const page = await context.newPage();

async function visibleHighlights() {
  return page.locator("[data-alliance-team].compare-selected").evaluateAll((tiles) => tiles.map((tile) => ({
    team: tile.dataset.allianceTeam,
    color: getComputedStyle(tile).getPropertyValue("--compare-accent").trim(),
  })));
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

  const chosen = await page.evaluate(() => {
    const required = ["10988", "frc10988B", "2375", "2486"];
    const available = [...required, "4183"];
    const roster = currentEvent().teams.map(teamSelectionId).map(String);
    if (!available.every((team) => roster.includes(team))) throw new Error(`Arizona source roster is missing required team identities: ${JSON.stringify(roster)}`);
    const picklist = activePicklist();
    picklist.teams = available;
    state.loadedSources = [`picklist:${picklist.id}`];
    state.picklistCompareTeams = [null, null, null, null];
    state.activeView = "alliance";
    saveState();
    render();
    return required;
  });
  for (const team of chosen) {
    await page.locator(`[data-alliance-team="${team}"]`).first().click();
  }
  const firstFour = await visibleHighlights();
  assert.equal(new Set(firstFour.map((item) => item.team)).size, 4, "Each selected identity should highlight exactly once in the source column.");
  assert.equal(new Set(firstFour.map((item) => item.color)).size, 4, "The first four selections should use distinct colors.");
  assert.deepEqual(firstFour.map((item) => item.team).sort(), [...chosen].sort());
  assert.notEqual(firstFour.find((item) => item.team === "10988")?.color, firstFour.find((item) => item.team === "frc10988B")?.color, "Base team 10988 and its B identity should occupy different color slots.");
  const selectedSlots = await page.evaluate(() => state.picklistCompareTeams.map((team) => String(team ?? "")));
  assert.deepEqual(selectedSlots, chosen, "Selection slots should retain base and B identities independently and in selection order.");
  await page.locator('[data-alliance-team="frc10988B"]').first().click();
  let highlights = await visibleHighlights();
  assert.deepEqual(highlights.map((item) => item.team).sort(), ["10988", "2375", "2486"], "Clearing one B identity should remove only its highlight.");
  await page.locator('[data-alliance-team="4183"]').first().click();
  highlights = await visibleHighlights();
  assert.equal(highlights.length, 4, "A replacement team should be able to take a freed slot.");
  assert.equal(highlights.find((item) => item.team === "4183")?.color, firstFour.find((item) => item.team === "frc10988B")?.color, "Replacement should receive the freed highlight color.");

  await page.locator('[data-view="picklistBuilder"]').click();
  const beforeOrder = await page.locator("[data-reorder-team]").evaluateAll((tiles) => tiles.map((tile) => tile.dataset.reorderTeam));
  assert.deepEqual(beforeOrder, [...chosen, "4183"], "The selected identities and replacement candidate should be present on the reorderable picklist.");
  await page.locator('[data-reorder-team="frc10988B"]').dragTo(page.locator('[data-reorder-team="2486"]'));
  const expectedOrder = ["10988", "2375", "frc10988B", "2486", "4183"];
  await page.waitForFunction((order) => JSON.stringify([...document.querySelectorAll("[data-reorder-team]")].map((tile) => tile.dataset.reorderTeam)) === JSON.stringify(order), expectedOrder);
  await page.evaluate(() => render());
  assert.deepEqual(await page.locator("[data-reorder-team]").evaluateAll((tiles) => tiles.map((tile) => tile.dataset.reorderTeam)), expectedOrder, "Reordering should retain the B team identity without duplication.");
  const preReload = await page.evaluate(() => ({ selected: state.picklistCompareTeams, stored: localStorage.getItem("frc-scouting-picklist-compare-teams:2026azscor") }));
  assert.deepEqual(preReload.selected.map(String).sort(), ["10988", "2375", "2486", "4183"].sort(), `Selections should remain set after board reorder: ${JSON.stringify(preReload)}`);
  await page.locator('[data-view="alliance"]').click();
  await page.evaluate(() => render());
  const afterReload = await visibleHighlights();
  const refreshDiagnostics = await page.evaluate(() => ({
    activeEventKey: state.activeEventKey,
    activeView: state.activeView,
    selected: state.picklistCompareTeams,
    stored: localStorage.getItem("frc-scouting-picklist-compare-teams:2026azscor"),
    allianceTiles: [...document.querySelectorAll("[data-alliance-team]")].map((tile) => ({ team: tile.dataset.allianceTeam, selected: tile.classList.contains("compare-selected") })),
  }));
  assert.deepEqual(afterReload.map((item) => item.team).sort(), ["10988", "2375", "2486", "4183"], `The exact selected identities should remain highlighted after selection-view refresh and board reorder: ${JSON.stringify(refreshDiagnostics)}`);
  assert.equal(new Set(afterReload.map((item) => item.color)).size, 4, "All four persisted selections should retain unique colors after refresh.");
  const bIdentity = await page.evaluate(() => state.picklistCompareTeams.map(String).includes("frc10988B"));
  assert.equal(bIdentity, false, "The removed B team should stay removed after refresh.");
  console.log(JSON.stringify({ pass: true, event: "2026azscor", selectedSlots, initial: firstFour, afterReplacement: highlights, afterRefresh: afterReload, order: expectedOrder }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => simulatorServer.close(resolve));
  fs.rmSync(simulatorStatePath, { force: true });
}
