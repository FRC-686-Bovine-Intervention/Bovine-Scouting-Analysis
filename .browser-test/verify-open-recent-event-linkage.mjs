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

async function openAdmin(page) {
  await page.locator('[data-view="admin"]').click();
  await page.waitForSelector("#adminEventCodeInput");
}

async function switchRecentEvent(page, eventKey) {
  await page.locator("#openRecentAdminEventsButton").click();
  await page.locator("#recentAdminEventSelect").selectOption(eventKey);
  await page.waitForFunction((expectedEventKey) => globalThis.__scoutingAppState?.activeEventKey === expectedEventKey, eventKey);
  await page.waitForSelector("#importSourceUrl");
}

async function eventInputs(page) {
  return page.evaluate(() => ({
    eventKey: globalThis.__scoutingAppState?.activeEventKey,
    source: document.querySelector("#importSourceUrl")?.value || "",
    profile: document.querySelector("#importSchemaSourceUrl")?.value || "",
  }));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));

try {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#app");
  await login(page);
  await openAdmin(page);

  await page.fill("#adminEventCodeInput", "2024mdsev");
  await page.locator("#adminEventCodeInput").press("Enter");
  await page.waitForFunction(() => globalThis.__scoutingAppState?.activeEventKey === "2024mdsev");
  await page.fill("#importSourceUrl", "https://example.test/2026chcmp.csv");
  await page.fill("#importSchemaSourceUrl", "https://example.test/2026chcmp_profile.json");

  await switchRecentEvent(page, "2026chcmp");
  await page.fill("#importSourceUrl", "https://example.test/2024mdsev.csv");
  await page.fill("#importSchemaSourceUrl", "https://example.test/2024mdsev_profile.json");

  await switchRecentEvent(page, "2024mdsev");
  assert(JSON.stringify(await eventInputs(page)) === JSON.stringify({
    eventKey: "2024mdsev",
    source: "https://example.test/2026chcmp.csv",
    profile: "https://example.test/2026chcmp_profile.json",
  }), "The first event did not retain its deliberate data/profile mismatch.");

  await page.fill("#importSourceUrl", "https://example.test/2024mdsev.csv");
  await page.fill("#importSchemaSourceUrl", "https://example.test/2024mdsev_profile.json");
  await switchRecentEvent(page, "2026chcmp");
  assert(JSON.stringify(await eventInputs(page)) === JSON.stringify({
    eventKey: "2026chcmp",
    source: "https://example.test/2024mdsev.csv",
    profile: "https://example.test/2024mdsev_profile.json",
  }), "The second event did not retain its deliberate data/profile mismatch.");

  await page.fill("#importSourceUrl", "https://example.test/2026chcmp.csv");
  await page.fill("#importSchemaSourceUrl", "https://example.test/2026chcmp_profile.json");
  await switchRecentEvent(page, "2024mdsev");
  assert((await eventInputs(page)).source === "https://example.test/2024mdsev.csv", "The restored matching data source was not retained.");
  assert((await eventInputs(page)).profile === "https://example.test/2024mdsev_profile.json", "The restored matching profile was not retained.");
  await switchRecentEvent(page, "2026chcmp");
  assert((await eventInputs(page)).source === "https://example.test/2026chcmp.csv", "The second restored matching data source was not retained.");
  assert((await eventInputs(page)).profile === "https://example.test/2026chcmp_profile.json", "The second restored matching profile was not retained.");

  assert(pageErrors.length === 0, `Page errors: ${pageErrors.join("; ")}`);
} finally {
  await browser.close();
}

console.log("PASS Open Recent preserves event-scoped scouting data and profile links.");
