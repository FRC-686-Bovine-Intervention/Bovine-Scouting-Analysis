import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "../eventSimulator/server.mjs";
import { createRecordedEngine } from "../eventSimulator/engine.mjs";

const appUrl = process.env.SCOUTING_APP_URL || "http://127.0.0.1:4173/index.html";
const email = process.env.FIREBASE_LOCAL_ADMIN_EMAIL || "admin@example.test";
const password = process.env.FIREBASE_LOCAL_ADMIN_PASSWORD || "local-admin-password";
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const playwrightPath = [
  path.resolve(".browser-test/node_modules/playwright/index.mjs"),
  path.resolve("node_modules/playwright/index.mjs"),
].find((candidate) => fs.existsSync(candidate));
if (!playwrightPath) throw new Error("Playwright was not found in .browser-test/node_modules or node_modules.");
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const simulatorStatePath = path.join(os.tmpdir(), `picklist-panel-height-212-${process.pid}.json`);
const simulator = createRecordedEngine({ recordingPath: path.resolve("recordings/2026azscor"), statePath: simulatorStatePath });
simulator.setState({ cursor: 500 });
const simulatorServer = createServer({ simulator });
await new Promise((resolve, reject) => {
  simulatorServer.once("error", reject);
  simulatorServer.listen(0, "127.0.0.1", resolve);
});
const simulatorPort = simulatorServer.address().port;
const browser = await chromium.launch({ headless: true, ...(fs.existsSync(executablePath) ? { executablePath } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

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
  await page.waitForSelector("[data-current-picklist] [data-builder-team]");

  const desktop = await page.evaluate(() => {
    const currentList = document.querySelector("[data-current-picklist]");
    const currentCard = document.querySelector(".current-picklist-card");
    const comparisonCard = document.querySelector(".picklist-builder-layout > .card:last-child");
    const comparisonColumns = document.querySelectorAll(".builder-grid-columns > .grid-column");
    const template = currentList.firstElementChild;
    for (let index = currentList.children.length; index < 75; index += 1) {
      const tile = template.cloneNode(true);
      tile.dataset.builderTeam = `height-${index + 1}`;
      tile.querySelector(".tile-rank").textContent = String(index + 1);
      tile.querySelector(".tile-label").textContent = `World Championship team ${index + 1}`;
      currentList.append(tile);
    }
    // Model a tall comparison grid, the layout condition reported in #212.
    comparisonCard.style.minHeight = "900px";
    const cardRect = currentCard.getBoundingClientRect();
    const comparisonRect = comparisonCard.getBoundingClientRect();
    const headerHeight = currentCard.querySelector(":scope > .section-heading").getBoundingClientRect().height;
    const listRect = currentList.getBoundingClientRect();
    return {
      currentCardHeight: cardRect.height,
      comparisonCardHeight: comparisonRect.height,
      currentListHeight: listRect.height,
      headerHeight,
      listScrollHeight: currentList.scrollHeight,
      listClientHeight: currentList.clientHeight,
      columns: comparisonColumns.length,
      listMaxHeight: getComputedStyle(currentList).maxHeight,
    };
  });

  assert.equal(desktop.columns, 4, "the comparison grid retains four columns");
  assert.ok(Math.abs(desktop.currentCardHeight - desktop.comparisonCardHeight) <= 1, `the active card stretches to the comparison card: ${JSON.stringify(desktop)}`);
  assert.ok(desktop.currentListHeight >= desktop.currentCardHeight - desktop.headerHeight - 90, `the active team list fills the available panel height: ${JSON.stringify(desktop)}`);
  assert.ok(desktop.listScrollHeight > desktop.listClientHeight, "a long active picklist remains internally scrollable");
  const finalTeamReachable = await page.locator("[data-current-picklist]").evaluate((list) => {
    list.scrollTop = list.scrollHeight;
    return list.lastElementChild.getBoundingClientRect().bottom <= list.getBoundingClientRect().bottom + 1;
  });
  assert.equal(finalTeamReachable, true, "the final team remains reachable after expanding the list viewport");

  await page.setViewportSize({ width: 390, height: 844 });
  const compact = await page.locator("[data-current-picklist]").evaluate((list) => ({
    listHeight: list.getBoundingClientRect().height,
    listScrollHeight: list.scrollHeight,
    clientHeight: list.clientHeight,
    maxHeight: getComputedStyle(list).maxHeight,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
  }));
  assert.ok(compact.clientHeight > 0 && compact.clientHeight <= 0.7 * 844 + 1, `the phone list keeps its bounded viewport: ${JSON.stringify(compact)}`);
  assert.ok(compact.listScrollHeight > compact.clientHeight, "the phone list still scrolls internally");
  assert.equal(compact.horizontalOverflow, false, "the responsive picklist builder does not overflow horizontally");

  console.log(JSON.stringify({ pass: true, desktop, compact }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => simulatorServer.close(resolve));
  fs.rmSync(simulatorStatePath, { force: true });
}
