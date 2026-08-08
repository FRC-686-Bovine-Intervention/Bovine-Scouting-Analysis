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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await page.addInitScript(() => {
    globalThis.eventCatalog = [{
      key: "2026test",
      season: 2026,
      seasonLabel: "Rebuilt",
      name: "Test Event",
      teams: [],
      teamNumbers: [],
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
  await page.goto("http://localhost:4173", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => globalThis.__scoutingAppState);
  await page.evaluate(() => {
    globalThis.firebaseCurrentUser = { email: "title-bar-test@example.test" };
    globalThis.dispatchEvent(new CustomEvent("firebase-auth-state-changed", {
      detail: { user: globalThis.firebaseCurrentUser, role: "member" },
    }));
  });
  await page.waitForSelector(".topbar");

  await page.evaluate(() => {
    globalThis.__scoutingAppState.sharedCacheStatus = "Shared event catalog is current. Shared event data remains in this browser for offline reopening. Use only a trusted device; signing out does not clear this browser cache.";
  });
  await page.locator("#themeToggle").click();

  const activeEvent = await page.evaluate(() => globalThis.eventCatalog.find((event) => event.key === globalThis.__scoutingAppState.activeEventKey));
  const seasonTitle = (await page.locator(".page-title .eyebrow").textContent()).trim();
  const eventTitle = (await page.locator(".page-title h1").textContent()).trim();
  assert(seasonTitle === `${activeEvent.season} ${activeEvent.seasonLabel}`, `The title bar does not show the active season label. Got ${seasonTitle}.`);
  assert(eventTitle === activeEvent.name, `The title bar does not show the selected event name. Got ${eventTitle}.`);
  assert(await page.locator(".topbar #sharedCachedEventSelect").count() === 0, "The active-event selector still appears in the title bar.");
  assert(!/trusted device|offline reopening|shared event catalog/i.test(await page.locator(".topbar").innerText()), "The verbose cache warning remains in the title bar.");

  await page.evaluate(() => {
    globalThis.__scoutingAppState.activeEventKey = "missing-event";
  });
  await page.locator("#themeToggle").click();
  await page.waitForSelector(".login-panel");
  assert(await page.getByRole("heading", { name: "No event loaded" }).count() === 1, "The no-event screen did not render after the active event became unavailable.");
  assert(await page.locator("#sharedCachedEventSelect").count() === 1, "The no-event screen no longer offers event selection.");
} finally {
  await browser.close();
}

console.log("PASS title bar shows season and event name, without cache copy, and the no-event screen keeps event selection.");
