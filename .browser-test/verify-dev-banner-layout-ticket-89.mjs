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
const appUrl = process.env.SCOUTING_APP_URL || "http://localhost:4173";
const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function layoutSnapshot() {
  const banner = document.querySelector(".deployment-banner");
  const shell = document.querySelector(".login-shell, .app-shell");
  const sidebar = document.querySelector(".sidebar");
  if (!banner || !shell) return null;
  return {
    bannerCount: document.querySelectorAll(".deployment-banner").length,
    banner: {
      top: banner.getBoundingClientRect().top,
      bottom: banner.getBoundingClientRect().bottom,
      position: getComputedStyle(banner).position,
    },
    shell: {
      top: shell.getBoundingClientRect().top,
      bottom: shell.getBoundingClientRect().bottom,
    },
    sidebarHeight: sidebar?.getBoundingClientRect().height || 0,
    viewportHeight: innerHeight,
    documentScrollWidth: document.documentElement.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
  };
}

try {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".deployment-banner");
  const loginLayout = await page.evaluate(layoutSnapshot);
  assert(loginLayout.bannerCount === 1, "The login screen should render one development banner.");
  assert(loginLayout.banner.position === "static", "The development banner must stay in normal flow.");
  assert(Math.abs(loginLayout.shell.top - loginLayout.banner.bottom) < 1, "The login shell must start below the banner.");
  assert(loginLayout.documentScrollWidth === loginLayout.documentClientWidth, "The login screen must not overflow horizontally.");

  await page.addInitScript(() => {
    globalThis.eventCatalog = [{
      key: "2026test",
      season: 2026,
      seasonLabel: "Regression",
      name: "Banner Test Event",
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
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => globalThis.__scoutingAppState);
  await page.evaluate(() => {
    globalThis.firebaseCurrentUser = { email: "banner-layout-test@example.test" };
    globalThis.dispatchEvent(new CustomEvent("firebase-auth-state-changed", {
      detail: { user: globalThis.firebaseCurrentUser, role: "member" },
    }));
  });
  await page.waitForSelector(".app-shell");
  const appLayout = await page.evaluate(layoutSnapshot);
  assert(appLayout.bannerCount === 1, "The authenticated screen should render one development banner.");
  assert(appLayout.banner.position === "static", "The authenticated development banner must stay in normal flow.");
  assert(Math.abs(appLayout.shell.top - appLayout.banner.bottom) < 1, "The app shell must start below the banner.");
  assert(appLayout.sidebarHeight <= appLayout.viewportHeight, "The sidebar must not grow beyond the viewport because of the banner.");
  assert(appLayout.documentScrollWidth === appLayout.documentClientWidth, "The authenticated screen must not overflow horizontally.");
} finally {
  await browser.close();
}

console.log("PASS development banner is a single normal-flow panel above login and app shells.");
