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
    key: "2022chcmp",
    season: 2022,
    seasonLabel: "2022 Rapid React℠ Presented By The Boeing Company",
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
  await page.waitForFunction(() => globalThis.__scoutingAppState);
  const initialUi = await page.evaluate(() => {
    globalThis.firebaseCurrentUser = { uid: "test-user" };
    globalThis.__scoutingAppState.user = "Jordan";
    globalThis.__scoutingAppState.activeEventKey = "2022chcmp";
    globalThis.render();
    return {
      eventChip: document.querySelector(".event-chip")?.textContent || "",
      eyebrow: document.querySelector(".page-title .eyebrow")?.textContent || "",
      title: document.querySelector(".page-title h1")?.textContent || "",
      eventKey: globalThis.__scoutingAppState.activeEventKey,
    };
  });
  const eventChipText = initialUi.eventChip.replace(/\s+/g, " ");
  assert.match(eventChipText, /2022 Rapid React FIRST Chesapeake District Championship/);
  assert.doesNotMatch(eventChipText, /™|Presented By|sponsored by/i);
  assert.equal(initialUi.eyebrow, "2022 Rapid React");
  assert.equal(initialUi.title, "FIRST Chesapeake District Championship");
  assert.equal(initialUi.eventKey, "2022chcmp");
  const emptySeasonHeading = await page.evaluate(() => {
    globalThis.eventCatalog[0].seasonLabel = "";
    globalThis.render();
    return document.querySelector(".page-title .eyebrow")?.textContent || "";
  });
  assert.equal(emptySeasonHeading, "2022");
} finally {
  await browser.close();
}

console.log("PASS season and event labels are tidied in the UI while the event key remains intact.");
