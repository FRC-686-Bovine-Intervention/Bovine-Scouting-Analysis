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
const simulatorStatePath = path.join(os.tmpdir(), `alliance-metric-scroll-200-${process.pid}.json`);
let simulator;
let simulatorServer;
let browser;

try {
  simulator = createRecordedEngine({ recordingPath: path.resolve("recordings/2026azscor"), statePath: simulatorStatePath });
  simulatorServer = createServer({ simulator });
  simulator.setState({ cursor: 500 });
  await new Promise((resolve, reject) => {
    simulatorServer.once("error", reject);
    simulatorServer.listen(0, "127.0.0.1", resolve);
  });
  const simulatorPort = simulatorServer.address().port;
  browser = await chromium.launch({ headless: true, ...(executablePath && fs.existsSync(executablePath) ? { executablePath } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

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
  await page.locator('[data-view="alliance"]').click();
  const metricList = page.locator(".picklist-metric-list");
  await page.waitForFunction(() => document.querySelectorAll(".picklist-metric-list .picklist-check").length > 10);

  const lowMetricCheckbox = metricList.locator(".picklist-check").last();
  const lowMetric = await lowMetricCheckbox.getAttribute("value");
  assert.ok(lowMetric?.startsWith("metric:"), `Expected a low-ranked metric in the selector, got ${lowMetric}.`);
  await lowMetricCheckbox.check();
  const start = await metricList.evaluate((list) => {
    list.scrollTop = list.scrollHeight;
    return { scrollTop: list.scrollTop, maxScrollTop: list.scrollHeight - list.clientHeight };
  });
  assert.ok(start.maxScrollTop > 0, `The metric selector must be scrollable: ${JSON.stringify(start)}.`);
  const selectedMetricId = lowMetric.slice("metric:".length);
  const observations = [];
  for (let update = 1; update <= 3; update += 1) {
    const expectedCursor = simulator.getState().cursor + 1;
    simulator.advance(1);
    await page.evaluate(() => refreshSimulatorSources({ trigger: "ticket-200-recorded-playback" }));
    await page.waitForFunction((metricId) => state.loadedSources.includes(`metric:${metricId}`), selectedMetricId);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await page.waitForTimeout(100);
    const observation = await metricList.evaluate((list) => ({ scrollTop: list.scrollTop, maxScrollTop: list.scrollHeight - list.clientHeight }));
    const selected = await metricList.locator(".picklist-check").last().isChecked();
    observations.push({ cursor: expectedCursor, ...observation, selected });
    assert.equal(observation.scrollTop, start.scrollTop, `Recorded update ${update} at cursor ${expectedCursor} must preserve the low metric selector scroll position.`);
    assert.equal(selected, true, `Recorded update ${update} must retain the selected metric.`);
  }

  console.log(JSON.stringify({ pass: true, recording: "2026azscor", selectedMetricId, updates: observations.length, initialScrollTop: start.scrollTop, observations }, null, 2));
} finally {
  if (browser) await browser.close();
  if (simulatorServer?.listening) await new Promise((resolve) => simulatorServer.close(resolve));
  fs.rmSync(simulatorStatePath, { force: true });
}
