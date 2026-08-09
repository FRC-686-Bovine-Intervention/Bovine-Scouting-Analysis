import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const appUrl = process.env.SCOUTING_APP_URL || "http://localhost:4173/index.html";
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || "C:/Users/rich/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe";
const candidate = [
  path.resolve(".browser-test/node_modules/playwright/index.mjs"),
  path.resolve("node_modules/playwright/index.mjs"),
  "C:/Users/rich/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
].find((entry) => fs.existsSync(entry));
if (!candidate) throw new Error("Playwright unavailable");
const { chromium } = await import(pathToFileURL(candidate).href);
const uncachedEventKey = `2026network${Date.now().toString(36)}`;

const tbaEvent = { key: uncachedEventKey, year: 2026, name: "Mock Uncached Event", short_name: "Mock Uncached Event" };
const cachedTbaEvent = { key: "2026cached", year: 2026, name: "Mock Cached Event", short_name: "Mock Cached Event" };
const tbaTeams = [{ key: "frc9999", team_number: 9999, nickname: "Mock Team" }];
const statboticsEvent = { event: uncachedEventKey, year: 2026, name: "Mock Uncached Event" };
const cachedStatboticsEvent = { event: "2026cached", year: 2026, name: "Mock Cached Event" };
const statboticsTeamEvents = [];
const requestCounts = { tbaEvent: 0, statboticsEvent: 0, cachedTbaEvent: 0, cachedStatboticsEvent: 0 };

const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(executablePath) ? executablePath : undefined });
const context = await browser.newContext();
await context.addInitScript(() => localStorage.clear());
const page = await context.newPage();

await page.route("**/*", async (route) => {
  const url = new URL(route.request().url());
  let body;
  if (url.hostname === "www.thebluealliance.com") {
    if (url.pathname.endsWith("/status")) body = { current_datetime: "2026-08-08T00:00:00Z" };
    else if (url.pathname.endsWith(`/event/${uncachedEventKey}`)) { requestCounts.tbaEvent += 1; body = tbaEvent; }
    else if (url.pathname.endsWith("/event/2026cached")) { requestCounts.cachedTbaEvent += 1; body = cachedTbaEvent; }
    else if (url.pathname.endsWith("/teams")) body = tbaTeams;
    else if (url.pathname.endsWith("/matches")) body = [];
    else if (url.pathname.endsWith("/rankings")) body = {};
    else if (url.pathname.endsWith("/oprs")) body = {};
  } else if (url.hostname === "api.statbotics.io" || url.hostname === "api-statbotics.iterativerefinement.com") {
    if (url.pathname.includes("/team_events/")) body = statboticsTeamEvents;
    else if (url.pathname.endsWith(`/event/${uncachedEventKey}`)) { requestCounts.statboticsEvent += 1; body = statboticsEvent; }
    else if (url.pathname.endsWith("/event/2026cached")) { requestCounts.cachedStatboticsEvent += 1; body = cachedStatboticsEvent; }
  }
  if (body === undefined) return route.continue();
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
});

async function snapshot() {
  return page.evaluate(() => {
    const state = window.__scoutingAppState;
    const sources = state?.eventWorkspace?.sources || {};
    return {
      activeEventKey: window.__scoutingActiveEventKey,
      pending: state?.eventLookupPending,
      lookup: state?.eventLookupResult,
      tba: sources.tba?.lastAttemptedAt || sources.tba?.lastSuccessfulAt || "",
      statbotics: sources.statbotics?.lastAttemptedAt || sources.statbotics?.lastSuccessfulAt || "",
    };
  });
}

async function waitForSwitch(target, baseline, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const current = await snapshot();
    if (current.activeEventKey === target && current.tba && current.statbotics && (!baseline || current.tba !== baseline.tba || current.statbotics !== baseline.statbotics)) {
      return { target, elapsedMs: Date.now() - startedAt, current };
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Event switch exceeded ${timeoutMs}ms: ${JSON.stringify({ target, baseline, current: await snapshot() })}`);
}

async function switchByCode(target) {
  const before = await snapshot();
  const input = page.locator("#adminEventCodeInput");
  await input.fill(target);
  await page.waitForFunction((eventKey) => window.__scoutingAppState?.adminEventCodeDraft === eventKey, target, { timeout: 2000 });
  await input.press("Enter");
  return waitForSwitch(target, before);
}

async function switchByRecent(target) {
  const switchCountBefore = await page.evaluate(() => (globalThis.__scoutingPerf?.events || []).filter((event) => event.label === "switchActiveEvent.total").length);
  const before = await snapshot();
  await page.click("#openRecentAdminEventsButton");
  const select = page.locator("#recentAdminEventSelect");
  await select.waitFor({ state: "visible", timeout: 2000 });
  await select.selectOption(target);
  const result = await waitForSwitch(target, before);
  await page.waitForTimeout(50);
  const switchEvents = await page.evaluate((beforeCount) => (globalThis.__scoutingPerf?.events || [])
    .filter((event) => event.label === "switchActiveEvent.total")
    .slice(beforeCount), switchCountBefore);
  if (switchEvents.length !== 1) {
    throw new Error(`Recent event selection triggered ${switchEvents.length} event switches instead of one.`);
  }
  const switchDurationMs = Number(switchEvents[0].durationMs);
  if (!(switchDurationMs < 500)) {
    throw new Error(`Recent event switch took ${switchDurationMs}ms; expected <500ms.`);
  }
  return { ...result, switchDurationMs };
}

try {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.fill("#firebaseEmailInput", "admin@example.test");
  await page.fill("#firebasePasswordInput", "local-admin-password");
  await page.click("#firebaseLoginButton");
  await page.waitForSelector(".app-shell", { state: "visible", timeout: 15000 });
  await page.click('[data-view="adminEventControl"]');
  await page.waitForSelector("#adminEventCodeInput", { state: "visible", timeout: 10000 });
  await page.waitForFunction(() => window.__scoutingAppState?.sharedCachedEvents?.some((event) => event.key === "2026cached"), { timeout: 10000 });

  if ((await snapshot()).activeEventKey === "2026cached") await switchByCode("2026local");
  const cachedToLocal = await switchByCode("2026cached");
  const localToCached = await switchByCode("2026local");
  await page.fill("#adminTbaAuthKeyInput", "mock-tba-key");
  await page.click("#saveTbaAuthKeyButton");
  await page.waitForFunction(() => window.__scoutingAppState?.tbaAuthKey === "mock-tba-key", { timeout: 5000 });
  await page.waitForFunction(() => window.__scoutingAppState?.tbaAuthKeySavePending === false, { timeout: 10000 });
  const localToUncached = await switchByCode(uncachedEventKey);
  const uncachedToCached = await switchByRecent("2026cached");
  if (requestCounts.tbaEvent !== 1 || requestCounts.statboticsEvent !== 1 || requestCounts.cachedTbaEvent < 1 || requestCounts.cachedStatboticsEvent < 1) {
    throw new Error(`Duplicate provider loads detected: ${JSON.stringify(requestCounts)}`);
  }
  if (/shared Firestore cache/i.test(uncachedToCached.current.lookup?.message || "")) {
    throw new Error(`Stale cached event was not refreshed: ${JSON.stringify(uncachedToCached.current.lookup)}`);
  }

  console.log(JSON.stringify({
    pass: true,
    cutoffMs: 500,
    requestCounts,
    transitions: [cachedToLocal, localToCached, localToUncached, uncachedToCached],
  }, null, 2));
} finally {
  await browser.close();
}
