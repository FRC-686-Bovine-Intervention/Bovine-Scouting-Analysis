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
    seasonLabel: "2026",
    name: "Highlight Test Event",
    teams: [1, 2, 3].map((number) => ({ number, name: `Team ${number}`, flags: [], matches: [], sources: {}, derived: {} })),
    teamNumbers: [1, 2, 3],
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
  const result = await page.evaluate(() => {
    globalThis.firebaseCurrentUser = { uid: "test-user" };
    const state = globalThis.__scoutingAppState;
    state.user = "Jordan";
    state.activeEventKey = "2026chcmp";
    state.activeView = "alliance";
    state.picklists = [
      { id: "main", name: "Main", teams: [1, 2] },
      { id: "backup", name: "Backup", teams: [2, 3] },
    ];
    state.loadedSources = ["picklist:main", "picklist:backup"];
    state.picklistCompareTeams = [null, null, null, null];
    globalThis.render();
    const tiles = [...document.querySelectorAll("[data-alliance-team]")];
    if (tiles.length !== 4) throw new Error(`Expected four displayed source tiles, found ${tiles.length}.`);
    tiles.find((tile) => tile.dataset.allianceTeam === "2").click();
    const added = {
      highlighted: document.querySelectorAll("[data-alliance-team].compare-selected").length,
      stored: state.picklistCompareTeams.slice(),
    };
    document.querySelector('[data-alliance-team="2"]').click();
    return {
      added,
      removed: {
        highlighted: document.querySelectorAll("[data-alliance-team].compare-selected").length,
        stored: state.picklistCompareTeams.slice(),
      },
    };
  });
  assert.equal(result.added.highlighted, 2, "A highlighted team should be styled in every displayed source column.");
  assert.deepEqual(result.added.stored, [2, null, null, null]);
  assert.equal(result.removed.highlighted, 0, "Clicking a highlighted team should remove its highlight.");
  assert.deepEqual(result.removed.stored, [null, null, null, null]);
} finally {
  await browser.close();
}

console.log("PASS Alliance Selection team highlights toggle across displayed source columns.");
