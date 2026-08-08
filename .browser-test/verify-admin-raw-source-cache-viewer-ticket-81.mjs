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

try {
  await page.goto("http://localhost:4173", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.locator("#existingUser").selectOption("Avery");
  await page.locator("#loginButton").click();
  await page.evaluate(() => {
    globalThis.__scoutingAppState.selectedTeam = 686;
    globalThis.__scoutingAppState.selectedMatch = 1;
    registerEventModel({ key: "2026viewer", season: 2026, name: "Viewer Test", seasonLabel: "REBUILT", teams: [{ number: 686, name: "Bovine", flags: [], matches: [], sources: {}, derived: {} }], teamNumbers: [686], matches: [{ number: 1, red: [686], blue: [], redScore: 0, blueScore: 0, winningAlliance: "", scoreBreakdown: null }], matchesComplete: 0, scoringComponents: [], metrics: [], seedPicklists: [], seedSortEquations: [], formulaFieldDefinitions: [], dataSources: [] });
    switchActiveEvent("2026viewer", { activeView: "admin" });
  });
  await page.waitForTimeout(250);
  if (!await page.locator("#adminEventCodeInput").count()) throw new Error(`Admin screen did not render: ${(await page.locator("#app").innerText()).slice(0, 500)}`);
  await page.evaluate(() => {
    globalThis.__scoutingAppState.sharedCachedEvents = [{ key: "2026cache", season: 2026, name: "Cache Test", seasonLabel: "REBUILT" }];
    globalThis.firebaseEventSourceCacheApi = {
      listEventSourceCacheSources: async () => ({ fromCache: false, sources: [{ sourceId: "tba-event" }, { sourceId: "scouting-csv" }, { sourceId: "scouting-data" }] }),
      loadEventSourceCache: async ({ sourceId }) => {
        if (sourceId === "scouting-data") throw new Error("Raw source cache is incomplete.");
        if (sourceId === "scouting-csv") return {
          manifest: { sourceId, sourceUrl: "https://example.test/scouting.csv", fetchedAt: "2026-08-08T12:01:00.000Z", contentType: "text/csv", status: 0, fingerprint: "fnv1a:csv:14", byteLength: 14, chunkCount: 1 },
          rawText: "team,score\n686,5\n",
        };
        return {
          manifest: { sourceId: "tba-event", sourceUrl: "https://example.test/event", fetchedAt: "2026-08-08T12:00:00.000Z", contentType: "application/json", status: 200, fingerprint: "fnv1a:test:11", byteLength: 11, chunkCount: 1 },
          rawText: '{"team":686}',
        };
      },
    };
    globalThis.__scoutingAppState.activeView = "admin";
    render();
  });
  await page.waitForSelector("#rawSourceCacheEventSelect");
  await page.selectOption("#rawSourceCacheEventSelect", "2026cache");
  await page.waitForFunction(() => Boolean(document.querySelector('#rawSourceCacheSourceSelect option[value="tba-event"]')));
  await page.selectOption("#rawSourceCacheSourceSelect", "tba-event");
  await page.waitForSelector("#rawSourceCachePreview");
  const preview = await page.locator("#rawSourceCachePreview").inputValue();
  if (preview !== '{\n  "team": 686\n}') throw new Error("The viewer did not pretty-print reconstructed JSON.");
  const viewerText = await page.locator(".raw-source-cache-viewer").textContent();
  for (const expected of ["https://example.test/event", "2026-08-08T12:00:00.000Z", "application/json", "fnv1a:test:11", "11 bytes", "Chunks"]) {
    if (!viewerText.includes(expected)) throw new Error(`Missing manifest metadata: ${expected}`);
  }
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#downloadRawSourceCacheButton").click();
  const download = await downloadPromise;
  if (fs.readFileSync(await download.path(), "utf8") !== '{"team":686}') throw new Error("Download changed the reconstructed raw payload.");
  await page.selectOption("#rawSourceCacheSourceSelect", "scouting-csv");
  await page.waitForFunction(() => document.querySelector("#rawSourceCachePreview")?.value === "team,score\n686,5\n");
  if (!/HTTP status\s*0/i.test(await page.locator(".raw-source-cache-viewer").textContent() || "")) throw new Error("The viewer did not show a persisted HTTP status of zero.");
  await page.selectOption("#rawSourceCacheSourceSelect", "scouting-data");
  await page.waitForFunction(() => /unavailable, incomplete, or corrupt/i.test(document.querySelector(".raw-source-cache-viewer")?.textContent || ""));
  if (await page.locator("#rawSourceCachePreview").count()) throw new Error("A failed cache reconstruction displayed replacement content.");
} finally {
  await browser.close();
}

console.log("PASS administrators can inspect reconstructed raw cache artifacts and see corruption failures without replacement content.");
