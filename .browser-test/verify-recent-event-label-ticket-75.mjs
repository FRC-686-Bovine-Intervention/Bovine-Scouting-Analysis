import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadPlaywright() {
  const candidates = [
    path.resolve("node_modules/playwright/index.mjs"),
    "C:/Users/rich/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return import(pathToFileURL(candidate).href);
  }
  throw new Error(`Could not resolve Playwright from: ${candidates.join(", ")}`);
}

const { chromium } = await loadPlaywright();
const appUrl = "http://localhost:4173";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function login(page) {
  const existingUser = page.locator("#existingUser");
  if (!await existingUser.count()) return;
  await existingUser.selectOption("Avery");
  await page.locator("#loginButton").click();
  await page.waitForSelector('[data-view="teams"]');
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

try {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#app");
  await login(page);
  await page.locator('[data-view="admin"]').click();
  await page.waitForSelector("#adminEventCodeInput");

  await page.fill("#adminEventCodeInput", "2026chcmp");
  await page.locator("#adminEventCodeInput").press("Enter");
  await page.waitForFunction(() => globalThis.__scoutingAppState?.activeEventKey === "2026chcmp");
  await page.locator("#openRecentAdminEventsButton").click();
  await page.waitForSelector("#recentAdminEventSelect");

  const recentEvents = await page.evaluate(() => {
    const detailsFor = (key) => {
      const option = document.querySelector(`#recentAdminEventSelect option[value="${key}"]`);
      const event = globalThis.eventCatalog.find((candidate) => candidate.key === key);
      return { value: option?.value, text: option?.textContent?.trim(), name: event?.name, season: event?.season };
    };
    return { current: detailsFor("2026chcmp"), legacy: detailsFor("2024mdsev") };
  });

  assert(recentEvents.current.value === "2026chcmp", "The 2026 event option changed its identity value.");
  assert(recentEvents.current.text === `${recentEvents.current.value} | ${recentEvents.current.name}`, "The recent-event label should contain the event key and its source name exactly once.");
  assert(recentEvents.legacy.text === `${recentEvents.legacy.value} | ${recentEvents.legacy.season} ${recentEvents.legacy.name}`, "Non-2026 recent-event labels should keep their existing format.");
} finally {
  await browser.close();
}

console.log("PASS Recent-event labels do not duplicate a 2026 source name.");
