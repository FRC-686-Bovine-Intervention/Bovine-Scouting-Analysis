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
  const appUrl = process.env.SCOUTING_APP_URL || "http://localhost:4173/index.html";
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#firebaseLoginButton");
  await page.evaluate(() => {
    globalThis.firebaseAuthApi = {
      signIn: async () => globalThis.dispatchEvent(new CustomEvent("firebase-auth-state-changed", {
        detail: { user: { email: "admin@example.test" }, role: "admin" },
      })),
    };
  });
  await page.locator("#firebaseLoginButton").click();
  await page.waitForSelector("#logoutButton", { state: "visible", timeout: 15000 });
  await page.evaluate(() => {
    globalThis.firebaseUserRole = "admin";
    globalThis.firebaseCurrentUser = { email: "admin@example.test" };
    globalThis.__scoutingAppState.selectedTeam = 686;
    globalThis.__scoutingAppState.selectedMatch = 1;
    registerEventModel({ key: "2026viewer", season: 2026, name: "Viewer Test", seasonLabel: "REBUILT", teams: [{ number: 686, name: "Bovine", flags: [], matches: [], sources: {}, derived: {} }], teamNumbers: [686], matches: [{ number: 1, red: [686], blue: [], redScore: 0, blueScore: 0, winningAlliance: "", scoreBreakdown: null }], matchesComplete: 0, scoringComponents: [], metrics: [], seedPicklists: [], seedSortEquations: [], formulaFieldDefinitions: [], dataSources: [] });
    switchActiveEvent("2026viewer", { activeView: "adminEventControl" });
    render();
  });
  await page.waitForTimeout(250);
  if (!await page.locator("#adminEventCodeInput").count()) throw new Error(`Admin screen did not render: ${(await page.locator("#app").innerText()).slice(0, 500)}`);
  await page.evaluate(() => {
    globalThis.__scoutingAppState.sharedCachedEvents = [{ key: "2026cache", season: 2026, name: "Cache Test", seasonLabel: "REBUILT" }];
    globalThis.firebaseEventSourceCacheApi = {
      listEventSourceCacheSources: async () => ({ fromCache: false, sources: [{ sourceId: "tba-event" }, { sourceId: "scouting-csv" }, { sourceId: "scouting-data" }, { sourceId: "scouting-schema" }, { sourceId: "attachment-2026:schema" }] }),
      loadEventSourceCache: async ({ sourceId }) => {
        if (sourceId === "scouting-data") throw new Error("Raw source cache is incomplete.");
        if (sourceId === "scouting-schema") return {
          manifest: { sourceId, sourceUrl: "https://example.test/scouting.schema.json", fetchedAt: "2026-08-08T12:02:00.000Z", contentType: "application/json", status: 200, fingerprint: "fnv1a:schema:22", byteLength: 22, chunkCount: 1 },
          rawText: '{"expectedScoutingFields":["score"]}',
        };
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
    globalThis.__scoutingAppState.activeView = "adminEventControl";
    render();
  });
  if (!await page.locator("#rawSourceCacheEventSelect").count()) throw new Error(`Raw Source Cache viewer did not render: ${(await page.locator("#app").innerText()).slice(0, 1000)}`);
  await page.waitForSelector("#rawSourceCacheEventSelect");
  const cacheFormLayout = await page.locator(".raw-source-cache-viewer .admin-form-grid").evaluate((element) => {
    const style = getComputedStyle(element);
    return { alignContent: style.alignContent, alignItems: style.alignItems, flexGrow: style.flexGrow };
  });
  if (cacheFormLayout.alignContent !== "start" || cacheFormLayout.alignItems !== "start" || cacheFormLayout.flexGrow !== "0") throw new Error(`Raw cache controls are not compact top-aligned: ${JSON.stringify(cacheFormLayout)}`);
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
  if (!(await page.locator('#rawSourceCacheSchemaSelect option[value="scouting-schema"]').count())) throw new Error("The viewer did not list the cached schema artifact.");
  if (!(await page.locator('#rawSourceCacheSchemaSelect option[value="attachment-2026:schema"]').count())) throw new Error("The viewer did not list an attachment-scoped cached schema artifact.");
  await page.selectOption("#rawSourceCacheSchemaSelect", "scouting-schema");
  await page.waitForFunction(() => document.querySelector("#rawSourceCachePreview")?.value === '{\n  "expectedScoutingFields": [\n    "score"\n  ]\n}');
  const schemaText = await page.locator(".raw-source-cache-viewer").textContent();
  for (const expected of ["Scouting schema", "https://example.test/scouting.schema.json", "fnv1a:schema:22"]) {
    if (!schemaText.includes(expected)) throw new Error(`Missing schema artifact detail: ${expected}`);
  }
  await page.selectOption("#rawSourceCacheSourceSelect", "scouting-data");
  await page.waitForFunction(() => /unavailable, incomplete, or corrupt/i.test(document.querySelector(".raw-source-cache-viewer")?.textContent || ""));
  if (await page.locator("#rawSourceCachePreview").count()) throw new Error("A failed cache reconstruction displayed replacement content.");
} finally {
  await browser.close();
}

console.log("PASS administrators can inspect reconstructed raw cache artifacts and see corruption failures without replacement content.");
