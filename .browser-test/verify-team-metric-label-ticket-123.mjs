import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const candidates = [
  path.resolve("node_modules/playwright/index.mjs"),
  "C:/Users/rich/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
];
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
    seasonLabel: "2026",
    name: "Example Event",
    teams: [{
      number: 1,
      name: "Example Team",
      flags: [],
      matches: [2],
      sources: { scouter: { trend: [2], total: 2, components: { autoL4Made: 2 } } },
      derived: {},
    }],
    teamNumbers: [1],
    matches: [],
    matchesComplete: 0,
    scoringComponents: [],
    scouterMetricDefinitions: [{ id: "autoL4Made", label: "Auto L4 Made", unit: "count" }],
    formulaFieldDefinitions: [],
    dataSources: [],
  }];
});

try {
  await page.goto(process.env.SCOUTING_APP_URL || "http://localhost:4173", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => globalThis.__scoutingAppState);
  const labels = await page.evaluate(() => {
    globalThis.firebaseCurrentUser = { uid: "test-user" };
    globalThis.__scoutingAppState.user = "Jordan";
    globalThis.__scoutingAppState.activeEventKey = "2026chcmp";
    globalThis.__scoutingAppState.activeView = "teams";
    globalThis.render();
    document.querySelector('[data-team="1"]').click();
    return [...document.querySelectorAll("#teamDetailMetricSelect option")].map((option) => option.textContent.trim());
  });
  assert.ok(labels.includes("scouting.autoL4Made"));
  assert.equal(labels.includes("Auto L4 Made"), false);
} finally {
  await browser.close();
}

console.log("PASS Team detail metric dropdown uses raw metric tokens for source metrics.");
