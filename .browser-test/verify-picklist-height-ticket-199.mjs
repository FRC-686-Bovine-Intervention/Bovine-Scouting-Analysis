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
const simulatorStatePath = path.join(os.tmpdir(), `picklist-height-199-${process.pid}.json`);
const simulator = createRecordedEngine({ recordingPath: path.resolve("recordings/2026azscor"), statePath: simulatorStatePath });
simulator.setState({ cursor: 500 });
const simulatorServer = createServer({ simulator });
await new Promise((resolve, reject) => {
  simulatorServer.once("error", reject);
  simulatorServer.listen(0, "127.0.0.1", resolve);
});
const simulatorPort = simulatorServer.address().port;
const browser = await chromium.launch({ headless: true, ...(executablePath && fs.existsSync(executablePath) ? { executablePath } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

async function measurePicklist(viewport) {
  await page.setViewportSize(viewport);
  return page.locator("[data-current-picklist]").evaluate((list) => {
    const rect = (element) => {
      const box = element.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height };
    };
    const last = list.lastElementChild;
    const lastRect = rect(last);
    const listRect = rect(list);
    const documentWidth = document.documentElement.scrollWidth;
    const pageHeight = document.documentElement.scrollHeight;
    const pageViewportHeight = document.documentElement.clientHeight;
    list.scrollTop = list.scrollHeight;
    const lastVisibleAfterScroll = last.getBoundingClientRect().bottom <= list.getBoundingClientRect().bottom + 1;
    list.scrollTop = 0;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      list: { ...listRect, scrollHeight: list.scrollHeight, clientHeight: list.clientHeight, maxHeight: getComputedStyle(list).maxHeight },
      count: list.children.length,
      lastInitiallyVisible: lastRect.bottom <= listRect.bottom + 1,
      lastVisibleAfterScroll,
      documentWidth,
      pageHeight,
      pageViewportHeight,
      horizontalOverflow: documentWidth > innerWidth,
    };
  });
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
  await page.waitForSelector("[data-current-picklist] [data-builder-team]");

  const seededCount = await page.locator("[data-current-picklist]").evaluate((list) => {
    const template = list.firstElementChild;
    for (let index = list.children.length; index < 75; index += 1) {
      const tile = template.cloneNode(true);
      tile.dataset.builderTeam = `layout-${index + 1}`;
      tile.dataset.reorderTeam = `layout-${index + 1}`;
      tile.querySelector(".tile-rank").textContent = String(index + 1);
      tile.querySelector(".tile-label").textContent = `World Championship team ${index + 1}`;
      list.append(tile);
    }
    return list.children.length;
  });
  assert.equal(seededCount, 75, "The layout fixture should contain a division-sized 75-team picklist.");

  const desktop = await measurePicklist({ width: 1440, height: 900 });
  assert.ok(desktop.list.clientHeight > 62 * 9, `Desktop list should exceed the previous 62vh cap: ${JSON.stringify(desktop)}`);
  assert.ok(desktop.list.scrollHeight > desktop.list.clientHeight, "A 75-team list should remain internally scrollable.");
  assert.ok(desktop.lastVisibleAfterScroll, "The final team should be reachable by scrolling the picklist.");
  assert.equal(desktop.horizontalOverflow, false, `Desktop page should not overflow horizontally: ${JSON.stringify(desktop)}`);
  assert.ok(desktop.pageHeight <= desktop.pageViewportHeight, `Desktop page content should fit the viewport without a second vertical scroll: ${JSON.stringify(desktop)}`);

  const compact = await measurePicklist({ width: 390, height: 844 });
  assert.ok(compact.list.clientHeight > 0, "Compact layout should preserve a visible picklist area.");
  assert.ok(compact.list.scrollHeight > compact.list.clientHeight, "Compact 75-team list should remain scrollable.");
  assert.ok(compact.lastVisibleAfterScroll, "The final compact-view team should be reachable by scrolling.");
  assert.equal(compact.horizontalOverflow, false, `Compact page should not overflow horizontally: ${JSON.stringify(compact)}`);

  await page.locator("[data-current-picklist] [data-builder-team]").evaluateAll((tiles) => tiles.filter((tile) => tile.dataset.builderTeam.startsWith("layout-")).forEach((tile) => tile.remove()));
  const beforeDrag = await page.locator("[data-current-picklist] [data-reorder-team]").evaluateAll((tiles) => tiles.map((tile) => tile.dataset.reorderTeam));
  assert.ok(beforeDrag.length >= 2, "The real event picklist should provide teams for a drag usability check.");
  await page.locator(`[data-reorder-team="${beforeDrag[1]}"]`).dragTo(page.locator(`[data-reorder-team="${beforeDrag[0]}"]`));
  const afterDrag = await page.locator("[data-current-picklist] [data-reorder-team]").evaluateAll((tiles) => tiles.map((tile) => tile.dataset.reorderTeam));
  assert.equal(afterDrag[0], beforeDrag[1], "Dragging a team should reorder the real picklist after the large-list layout check.");
  await page.locator("[data-current-picklist]").click({ button: "right" });
  await page.locator("[data-pairwise-start]").click();
  await page.locator("[data-current-picklist] [data-builder-team]").first().click();
  await page.keyboard.press("ArrowDown");
  const pairwiseState = await page.evaluate(() => ({ activeView: state.activeView, pairwise: state.pairwisePicklist?.session, activeTileCount: document.querySelectorAll("[data-current-picklist] .pairwise-active").length }));
  assert.equal(pairwiseState.pairwise?.cursorIndex, 1, `Pairwise arrow navigation should remain usable: ${JSON.stringify(pairwiseState)}`);
  assert.ok(await page.locator("[data-pairwise-save]").isVisible(), "Pairwise save controls should remain visible.");

  console.log(JSON.stringify({ pass: true, desktop, compact, drag: "usable", pairwiseKeyboard: "usable", pairwiseSaveVisible: true }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => simulatorServer.close(resolve));
  fs.rmSync(simulatorStatePath, { force: true });
}
