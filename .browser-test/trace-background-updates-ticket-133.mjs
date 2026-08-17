import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const appUrl = process.env.SCOUTING_APP_URL || "http://localhost:4173/index.html";
const email = process.env.FIREBASE_LOCAL_ADMIN_EMAIL || "admin@example.test";
const password = process.env.FIREBASE_LOCAL_ADMIN_PASSWORD || "local-admin-password";
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

async function login(page) {
  await page.fill("#firebaseEmailInput", email);
  await page.fill("#firebasePasswordInput", password);
  await page.click("#firebaseLoginButton");
  await page.waitForSelector("#sharedCachedEventSelect, [data-view=picklistBuilder]", { state: "visible", timeout: 15000 });
  if (await page.locator("#sharedCachedEventSelect").count()) {
    await page.locator("#sharedCachedEventSelect").selectOption("2026cached");
  }
  await page.waitForSelector('[data-view="picklistBuilder"]', { state: "visible" });
}

async function runScenario(page, name, action, waitMs = 250) {
  return page.evaluate(async ({ name: scenarioName, action: scenarioAction, wait }) => {
    const appState = globalThis.__scoutingPerf || { events: [] };
    const startIndex = appState.events.length;
    const startedAt = performance.now();
    if (scenarioAction === "idle") {
      await new Promise((resolve) => setTimeout(resolve, wait));
    } else if (scenarioAction === "tba" || scenarioAction === "statbotics" || scenarioAction === "pridge") {
      await refreshDataSource(scenarioAction, { trigger: "ticket-133" });
    } else if (scenarioAction === "scouting") {
      await refreshDataSource("scouting", { trigger: "ticket-133" });
    } else if (scenarioAction === "profiles") {
      await syncSharedProfilesForEvent(globalThis.__scoutingAppState.activeEventKey);
    } else if (scenarioAction === "submissions") {
      await syncSharedSubmissionsForEvent(globalThis.__scoutingAppState.activeEventKey);
    } else {
      throw new Error(`Unknown ticket-133 scenario: ${scenarioName}`);
    }
    await new Promise((resolve) => setTimeout(resolve, wait));
    return {
      name: scenarioName,
      action: scenarioAction,
      elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
      events: appState.events.slice(startIndex),
    };
  }, { name, action, wait: waitMs });
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await login(page);
  const scenarios = [
    ["idle-control", "idle"],
    ["tba-poll", "tba"],
    ["statbotics-poll", "statbotics"],
    ["pridge-poll", "pridge"],
    ["scouting-import-refresh", "scouting"],
    ["firebase-profile-sync", "profiles"],
    ["firebase-submission-sync", "submissions"],
  ];
  const traces = [];
  for (const [name, action] of scenarios) traces.push(await runScenario(page, name, action));

  assertCondition(pageErrors.length === 0, `Page errors detected: ${pageErrors.join("; ")}`);
  assertCondition(
    !traces[0].events.some((event) => event.label === "background.refresh.render"),
    "Idle control unexpectedly rendered a background refresh.",
  );
  for (const trace of traces.filter((entry) => ["tba-poll", "statbotics-poll", "pridge-poll", "scouting-import-refresh"].includes(entry.name))) {
    assertCondition(trace.events.length > 0, `${trace.name} produced no trace events.`);
  }
  for (const trace of traces.filter((entry) => ["tba-poll", "statbotics-poll"].includes(entry.name))) {
    assertCondition(trace.events.some((event) => event.label === "background.refresh.render"), `${trace.name} did not render its changed source.`);
  }
  const unchangedPridge = traces.find((entry) => entry.name === "pridge-poll");
  assertCondition(
    !unchangedPridge.events.some((event) => event.label === "background.refresh.render"),
    "An unchanged pRidge poll rendered the active view.",
  );
  console.log(JSON.stringify({ appUrl, traces, pageErrors }, null, 2));
} finally {
  await browser.close();
}
