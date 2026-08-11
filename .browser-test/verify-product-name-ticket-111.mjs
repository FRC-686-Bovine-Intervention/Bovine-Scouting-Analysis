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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await page.addInitScript(() => {
    globalThis.eventCatalog = [{
      key: "2026ticket111",
      season: 2026,
      seasonLabel: "Test Season",
      name: "Ticket 111 Event",
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
    globalThis.firebaseCurrentUser = { email: "ticket-111@example.test" };
    globalThis.dispatchEvent(new CustomEvent("firebase-auth-state-changed", {
      detail: { user: globalThis.firebaseCurrentUser, role: "member" },
    }));
  });
  await page.waitForSelector(".sidebar .brand-row");

  const branding = await page.locator(".sidebar .brand-row").textContent();
  assert(branding.replace(/\s+/g, " ").trim().startsWith("Bovine Scouting Analysis"), `The sidebar branding is incorrect: ${branding}`);
  assert(!branding.includes("FRC Scouting Analysis"), "The legacy product name remains in the sidebar.");
} finally {
  await browser.close();
}

console.log("PASS sidebar branding is Bovine Scouting Analysis.");
