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
  await page.locator("#existingUser").selectOption("Jordan");
  await page.locator("#loginButton").click();
  await page.waitForSelector("#sharedCachedEventSelect");
  await page.evaluate(() => {
    globalThis.__scoutingAppState.sharedCachedEvents = [{ key: "2025chcmp", season: 2025, name: "Championship", seasonLabel: "Reefscape" }];
    globalThis.__scoutingAppState.sharedCacheStatus = "Showing cached shared events while offline. Shared event data remains in this browser for offline reopening. Use only a trusted device; signing out does not clear this browser cache.";
    globalThis.__ticket78LoadedSources = [];
    globalThis.firebaseEventSourceCacheApi = {
      loadEventSourceCache: async ({ sourceId }) => {
        globalThis.__ticket78LoadedSources.push(sourceId);
        if (sourceId === "scouting-data") throw new Error("No cached source is available for this event.");
        return { rawText: "{}", manifest: { sourceId } };
      },
    };
    globalThis.CachedEventLoader = {
      rebuildCachedEvent: async () => ({
        eventModel: { ...globalThis.eventCatalog.find((event) => event.key === "2025chcmp") },
        sourceStates: { tba: { status: "ready", freshness: "stale", notes: "Loaded from cache." } },
        warnings: [], cacheFreshness: "stale",
      }),
    };
  });
  await page.locator("#themeToggle").click();
  await page.waitForSelector('#sharedCachedEventSelect option[value="2025chcmp"]');
  const text = await page.locator(".event-select").textContent();
  if (!/trusted device/i.test(text || "")) throw new Error("The shared cache selector does not communicate the trusted-device implication.");
  if (await page.locator('[data-view="admin"]').count()) throw new Error("The cached-event selector test must use a non-admin user.");
  await page.locator("#sharedCachedEventSelect").selectOption("2025chcmp");
  await page.waitForFunction(() => globalThis.__scoutingAppState?.activeEventKey === "2025chcmp");
  const loadedSources = await page.evaluate(() => globalThis.__ticket78LoadedSources);
  if (!loadedSources.includes("tba-event")) throw new Error("Selecting a shared event did not read its cached provider data.");
  if (!/shared Firestore cache \(stale\)/i.test(await page.locator(".event-select").textContent() || "")) throw new Error("The cached event freshness was not shown after opening.");
} finally {
  await browser.close();
}

console.log("PASS members can see shared cached events and the trusted-device offline-cache notice.");
