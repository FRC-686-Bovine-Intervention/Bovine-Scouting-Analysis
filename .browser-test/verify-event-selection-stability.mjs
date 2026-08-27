import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const appUrl = process.env.SCOUTING_APP_URL || "http://localhost:4173/index.html";
const targetEventKey = "2024mdsev";
const stabilityWindowMs = 120000;
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const candidate = [
  path.resolve(".browser-test/node_modules/playwright/index.mjs"),
  path.resolve("node_modules/playwright/index.mjs"),
  "C:/Users/rich/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
].find((entry) => fs.existsSync(entry));
if (!candidate) throw new Error("Playwright unavailable");
const { chromium } = await import(pathToFileURL(candidate).href);

const browser = await chromium.launch({
  headless: true,
  executablePath: fs.existsSync(executablePath) ? executablePath : undefined,
});
const context = await browser.newContext();
await context.addInitScript(() => localStorage.clear());
const page = await context.newPage();

async function snapshot() {
  return page.evaluate(() => ({
    activeEventKey: window.__scoutingActiveEventKey,
    requestedEventKey: window.__scoutingAppState?.requestedEventKey || "",
    workspaceEventKey: window.__scoutingAppState?.eventWorkspace?.eventKey || "",
    adminEventCode: document.querySelector("#adminEventCodeInput")?.value || "",
    pending: Boolean(window.__scoutingAppState?.eventLookupPending),
    lookup: window.__scoutingAppState?.eventLookupResult || null,
  }));
}

function assertStable(current, elapsedMs) {
  const stable = current.activeEventKey === targetEventKey
    && current.requestedEventKey === targetEventKey
    && current.workspaceEventKey === targetEventKey
    && current.adminEventCode === targetEventKey
    && (!current.lookup || current.lookup.kind !== "error");
  if (!stable) {
    throw new Error(`Event selection changed after ${elapsedMs}ms: ${JSON.stringify(current)}`);
  }
}

try {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.fill("#firebaseEmailInput", "admin@example.test");
  await page.fill("#firebasePasswordInput", "local-admin-password");
  await page.click("#firebaseLoginButton");
  try {
    await page.waitForSelector(".app-shell", { state: "visible", timeout: 15000 });
  } catch (error) {
    const cachedEventSelect = page.locator("#sharedCachedEventSelect");
    if (!(await cachedEventSelect.isVisible().catch(() => false))) throw error;
    await cachedEventSelect.selectOption("2026cached");
    await page.waitForSelector(".app-shell", { state: "visible", timeout: 15000 });
  }
  await page.click('[data-view="adminEventControl"]');
  const input = page.locator("#adminEventCodeInput");
  await input.waitFor({ state: "visible", timeout: 10000 });
  const availableEvents = await page.evaluate(() => (window.__scoutingAppState?.sharedCachedEvents || []).map((event) => event.key));
  if (!availableEvents.includes(targetEventKey)) {
    throw new Error(`Real emulator fixture is missing ${targetEventKey}; available shared cached events: ${availableEvents.join(", ") || "<none>"}. Rerun the emulator seed or clone the real event fixture first.`);
  }
  await input.fill(targetEventKey);
  await input.press("Enter");

  const loadDeadline = Date.now() + 30000;
  while (Date.now() < loadDeadline) {
    const current = await snapshot();
    if (current.activeEventKey === targetEventKey && current.workspaceEventKey === targetEventKey && current.adminEventCode === targetEventKey && !current.pending) break;
    await page.waitForTimeout(100);
  }
  const loaded = await snapshot();
  assertStable(loaded, 0);

  const startedAt = Date.now();
  const checkpoints = [];
  while (Date.now() - startedAt < stabilityWindowMs) {
    const elapsedMs = Date.now() - startedAt;
    const current = await snapshot();
    assertStable(current, elapsedMs);
    if (elapsedMs >= checkpoints.length * 30000) {
      checkpoints.push({ elapsedMs, ...current });
    }
    await page.waitForTimeout(1000);
  }
  const finalState = await snapshot();
  assertStable(finalState, stabilityWindowMs);
  console.log(JSON.stringify({
    pass: true,
    targetEventKey,
    stabilityWindowMs,
    checkpoints,
    finalState,
  }, null, 2));
} finally {
  await browser.close();
}
