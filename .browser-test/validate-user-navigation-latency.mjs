import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const appUrl = process.env.SCOUTING_APP_URL || "http://localhost:4173/index.html";
const email = process.env.FIREBASE_LOCAL_ADMIN_EMAIL || "admin@example.test";
const password = process.env.FIREBASE_LOCAL_ADMIN_PASSWORD || "local-admin-password";
const fromEvent = process.env.VALIDATION_FROM_EVENT || "2022chcmp";
const toEvent = process.env.VALIDATION_TO_EVENT || "2026chcmp";
const eventSwitchBudgetMs = Number(process.env.VALIDATION_EVENT_SWITCH_BUDGET_MS || 5000);
const eventSwitchTimeoutMs = Number(process.env.VALIDATION_EVENT_SWITCH_TIMEOUT_MS || 60000);
const recentOpenBudgetMs = Number(process.env.VALIDATION_RECENT_OPEN_BUDGET_MS || 1000);
const derivedPageBudgetMs = Number(process.env.VALIDATION_DERIVED_PAGE_BUDGET_MS || 1500);
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function loadPlaywright() {
  const candidates = [
    path.resolve(".browser-test/node_modules/playwright/index.mjs"),
    path.resolve("node_modules/playwright/index.mjs"),
    "C:/Users/rich/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
  ];
  const candidate = candidates.find((entry) => fs.existsSync(entry));
  assertCondition(candidate, `Playwright was not found. Tried: ${candidates.join(", ")}`);
  return import(pathToFileURL(candidate).href);
}

async function snapshot(page) {
  return page.evaluate(() => ({
    activeEventKey: globalThis.__scoutingActiveEventKey || globalThis.__scoutingAppState?.activeEventKey || "",
    workspaceEventKey: globalThis.__scoutingAppState?.eventWorkspace?.eventKey || "",
    adminEventCode: document.querySelector("#adminEventCodeInput")?.value || "",
    activeView: globalThis.__scoutingAppState?.activeView || "",
    recentEventKeys: globalThis.__scoutingAppState?.recentEventKeys || [],
    sharedCachedEventKeys: (globalThis.__scoutingAppState?.sharedCachedEvents || []).map((event) => event.key),
  }));
}

async function login(page) {
  await page.fill("#firebaseEmailInput", email);
  await page.fill("#firebasePasswordInput", password);
  await page.click("#firebaseLoginButton");
  await page.waitForSelector("#sharedCachedEventSelect, [data-view=adminEventControl]", { state: "visible", timeout: 15000 });
  if (await page.locator("#sharedCachedEventSelect").count()) {
    await page.locator("#sharedCachedEventSelect").selectOption("2026cached");
  }
  await page.waitForSelector('[data-view="adminEventControl"]', { state: "visible", timeout: 15000 });
  await page.click('[data-view="adminEventControl"]');
  await page.locator("#adminEventCodeInput").waitFor({ state: "visible", timeout: 10000 });
  await page.waitForFunction(() => Array.isArray(globalThis.__scoutingAppState?.sharedCachedEvents)
    && globalThis.__scoutingAppState.sharedCachedEvents.length > 0, null, { timeout: 15000 });
}

async function openRecentEvents(page) {
  const startedAt = performance.now();
  const recentButton = page.locator("#openRecentAdminEventsButton");
  await recentButton.click({ force: true });
  await page.waitForTimeout(100);
  if (await page.evaluate(() => globalThis.__scoutingAppState?.adminRecentEventsOpen !== true)) {
    await recentButton.click({ force: true });
  }
  await page.waitForFunction(() => globalThis.__scoutingAppState?.adminRecentEventsOpen === true, null, { timeout: recentOpenBudgetMs * 2 }).catch(async (error) => {
    const diagnostic = await page.evaluate(() => ({
      activeView: globalThis.__scoutingAppState?.activeView,
      recentOpen: globalThis.__scoutingAppState?.adminRecentEventsOpen,
      button: document.querySelector("#openRecentAdminEventsButton")?.outerHTML,
      body: document.body.innerText.slice(0, 500),
    }));
    diagnostic.pageErrors = pageErrors;
    throw new Error(`Recent Events did not open: ${JSON.stringify(diagnostic)}`, { cause: error });
  });
  await page.locator("#recentAdminEventSelect").waitFor({ state: "visible", timeout: recentOpenBudgetMs * 2 });
  const elapsedMs = Number((performance.now() - startedAt).toFixed(2));
  assertCondition(elapsedMs < recentOpenBudgetMs, `Opening Recent Events took ${elapsedMs}ms; expected <${recentOpenBudgetMs}ms.`);
  return { elapsedMs, optionCount: await page.locator("#recentAdminEventSelect option").count() };
}

async function prepareRecentEventHistory(page, eventKeys) {
  await page.waitForFunction((keys) => {
    const available = new Set((globalThis.__scoutingAppState?.sharedCachedEvents || []).map((event) => event.key));
    return keys.every((key) => available.has(key));
  }, eventKeys, { timeout: 15000 });
  await page.evaluate((keys) => {
    const state = globalThis.__scoutingAppState;
    state.recentEventKeys = [...new Set([...keys, ...(state.recentEventKeys || [])])];
    state.adminRecentEventsOpen = false;
    globalThis.render?.();
  }, eventKeys);
}

async function switchRecentEvent(page, target) {
  const options = await page.locator("#recentAdminEventSelect option").evaluateAll((items) => items.map((item) => item.value));
  assertCondition(options.includes(target), `Recent Events does not contain ${target}. Available events: ${options.join(", ")}`);
  const beforeEventCount = await page.evaluate(() => (globalThis.__scoutingPerf?.events || [])
    .filter((event) => event.label === "switchActiveEvent.total").length);
  const startedAt = performance.now();
  await page.locator("#recentAdminEventSelect").selectOption(target);
  await page.waitForFunction((eventKey) => {
    const state = globalThis.__scoutingAppState;
    return state?.activeEventKey === eventKey
      && state?.eventWorkspace?.eventKey === eventKey
      && document.querySelector("#adminEventCodeInput")?.value === eventKey;
  }, target, { timeout: eventSwitchTimeoutMs }).catch(async (error) => {
    throw new Error(`Event switch did not settle: ${JSON.stringify({ target, current: await snapshot(page), diagnostics: await page.evaluate(() => globalThis.scoutingPerfDiagnostics?.snapshot?.() || {}), pageErrors })}`, { cause: error });
  });
  const elapsedMs = Number((performance.now() - startedAt).toFixed(2));
  assertCondition(elapsedMs < eventSwitchBudgetMs, `${target} switch took ${elapsedMs}ms; expected <${eventSwitchBudgetMs}ms.`);
  const switchEvents = await page.evaluate((count) => (globalThis.__scoutingPerf?.events || [])
    .filter((event) => event.label === "switchActiveEvent.total").slice(count), beforeEventCount);
  const appDurationMs = switchEvents.length ? Math.max(...switchEvents.map((event) => Number(event.durationMs) || 0)) : null;
  if (appDurationMs !== null) {
    assertCondition(appDurationMs < eventSwitchBudgetMs, `App switchActiveEvent.total took ${appDurationMs}ms; expected <${eventSwitchBudgetMs}ms.`);
  }
  return { target, elapsedMs, appDurationMs, current: await snapshot(page) };
}

async function openDerivedEquationBuilder(page) {
  const startedAt = performance.now();
  await page.click('[data-view="derivedBuilder"]');
  await page.locator("#derivedEquationFormulaInput").waitFor({ state: "visible", timeout: derivedPageBudgetMs * 2 });
  const elapsedMs = Number((performance.now() - startedAt).toFixed(2));
  assertCondition(elapsedMs < derivedPageBudgetMs, `Derived Equation Builder took ${elapsedMs}ms; expected <${derivedPageBudgetMs}ms.`);
  return { elapsedMs, current: await snapshot(page) };
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(executablePath) ? executablePath : undefined });
const context = await browser.newContext();
await context.addInitScript(() => localStorage.clear());
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));

try {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await login(page);
  await prepareRecentEventHistory(page, [fromEvent, toEvent]);
  const initial = await snapshot(page);
  const recentOpen = await openRecentEvents(page);
  const fromSwitch = await switchRecentEvent(page, fromEvent);
  await openRecentEvents(page);
  const toSwitch = await switchRecentEvent(page, toEvent);
  const derivedBuilder = await openDerivedEquationBuilder(page);
  assert.deepEqual(pageErrors, [], `The app emitted page errors: ${pageErrors.join(" | ")}`);
  console.log(JSON.stringify({
    pass: true,
    appUrl,
    events: { from: fromEvent, to: toEvent },
    budgetsMs: { recentOpen: recentOpenBudgetMs, eventSwitch: eventSwitchBudgetMs, derivedBuilder: derivedPageBudgetMs },
    initial,
    recentOpen,
    transitions: [fromSwitch, toSwitch],
    derivedBuilder,
    pageErrors,
  }, null, 2));
} finally {
  await browser.close();
}
