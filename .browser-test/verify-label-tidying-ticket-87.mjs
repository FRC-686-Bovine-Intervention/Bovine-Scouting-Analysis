import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const candidates = [path.resolve("node_modules/playwright/index.mjs"), "C:/Users/rich/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs"];
const playwrightPath = candidates.find((candidate) => fs.existsSync(candidate));
if (!playwrightPath) throw new Error("Playwright is unavailable.");
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || "C:/Users/rich/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe";
const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage();
await page.addInitScript(() => {
  globalThis.eventCatalog = [{
    key: "2026chcmp",
    season: 2026,
    seasonLabel: "2026 Rebuilt™ Presented By Haas",
    name: "FIRST Chesapeake District Championship sponsored by Qualcomm",
    teams: [{ number: 1, name: "Example Team", flags: [], matches: [], sources: {}, derived: {} }],
    teamNumbers: [1],
    matches: [],
    matchesComplete: 0,
    scoringComponents: [],
    metrics: [],
    seedPicklists: [],
    seedSortEquations: [],
    formulaFieldDefinitions: [],
    dataSources: [],
  }];
});

try {
  await page.goto("http://localhost:4175", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    globalThis.__scoutingAppState.user = "Jordan";
    globalThis.__scoutingAppState.activeEventKey = "2026chcmp";
    globalThis.render();
  });
  await page.waitForSelector(".event-chip");
  const eventChipText = ((await page.locator(".event-chip").textContent()) || "").replace(/\s+/g, " ");
  assert.match(eventChipText, /2026 Rebuilt FIRST Chesapeake District Championship/);
  assert.doesNotMatch(eventChipText, /™|Presented By|sponsored by/i);
  assert.equal(await page.locator(".page-title .eyebrow").textContent(), "2026 Rebuilt");
  assert.equal(await page.locator(".page-title h1").textContent(), "FIRST Chesapeake District Championship");
  assert.equal(await page.locator("#sharedCachedEventSelect").inputValue(), "2026chcmp");
} finally {
  await browser.close();
}

console.log("PASS season and event labels are tidied in the UI while the event key remains intact.");
