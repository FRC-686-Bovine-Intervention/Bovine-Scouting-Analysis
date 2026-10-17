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
const simulatorStatePath = path.join(os.tmpdir(), `comparison-plots-198-${process.pid}.json`);
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
  const availableTeams = await page.locator("[data-builder-team]").evaluateAll((tiles) => tiles.map((tile) => tile.dataset.builderTeam));
  assert.ok(availableTeams.length >= 2, "The recorded event should provide teams to compare.");
  const selectedTeams = availableTeams.slice(0, 2);
  for (const team of selectedTeams) await page.locator(`[data-builder-team="${team}"]`).click();
  assert.deepEqual(await page.evaluate(() => state.picklistCompareTeams.filter(Boolean).map(String)), selectedTeams);
  assert.equal(await page.locator("[data-comparison-plots]").count(), 0, "Comparison plots must not be present on Picklist Builder.");

  await page.locator('[data-view="comparisonPlots"]').click();
  await page.locator("[data-comparison-plots]").waitFor();
  assert.equal(await page.locator("#picklistCompareMetricSelect").count(), 1, "The comparison metric control should live on Comparison Plots.");
  const backedMetricId = await page.evaluate((teamIds) => {
    const teams = teamIds.map((id) => teamByNumber(id));
    return orderedMetrics().find((metric) => teams.every((team) => analysisSeriesEntriesForMetric(team, metric, { window: currentScoutingWindow() }).length >= 2))?.id || "";
  }, selectedTeams);
  assert.ok(backedMetricId, "The recorded event should expose at least one metric with source-backed match trend points for both teams.");
  await page.locator("#picklistCompareMetricSelect").selectOption(backedMetricId);
  await page.locator(".compare-trend-chart polyline").first().waitFor({ state: "attached" });
  const chart = await page.locator(".compare-trend-chart").evaluate((svg) => ({
    series: svg.querySelectorAll("polyline").length,
    points: [...svg.querySelectorAll("circle title")].map((title) => title.textContent),
    labels: [...document.querySelectorAll(".picklist-compare-legend .compare-team-chip")].map((chip) => chip.textContent.trim()),
  }));
  assert.equal(chart.series, 2, "Both selected teams should render chart series.");
  assert.ok(chart.points.length >= 4 && chart.points.every((point) => /Match \d+: -?\d/.test(point)), "Chart points should be backed by recorded match values.");
  assert.equal(chart.labels.length, 2, "Both selected teams should appear in the comparison legend.");
  assert.deepEqual(await page.evaluate(() => state.picklistCompareTeams.filter(Boolean).map(String)), selectedTeams, "Navigation and metric selection must preserve selected teams.");

  await page.locator('[data-view="picklistBuilder"]').click();
  assert.equal(await page.locator("[data-comparison-plots]").count(), 0, "Returning to Picklist Builder must leave the plots on the dedicated page.");
  assert.deepEqual(await page.evaluate(() => state.picklistCompareTeams.filter(Boolean).map(String)), selectedTeams, "Returning to Picklist Builder must preserve selected teams.");
  console.log(JSON.stringify({ pass: true, recording: "2026azscor", selectedTeams, metric: backedMetricId, chartSeries: chart.series, recordedMatchPoints: chart.points.length, picklistHasPlots: false }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => simulatorServer.close(resolve));
  fs.rmSync(simulatorStatePath, { force: true });
}
