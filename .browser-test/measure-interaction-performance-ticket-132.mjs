import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const appUrl = process.env.SCOUTING_APP_URL || "http://localhost:4173/index.html";
const email = process.env.FIREBASE_LOCAL_ADMIN_EMAIL || "admin@example.test";
const password = process.env.FIREBASE_LOCAL_ADMIN_PASSWORD || "local-admin-password";
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || "C:/Users/rich/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe";

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
  const firebaseLogin = page.locator("#firebaseLoginButton");
  if (await firebaseLogin.isVisible().catch(() => false)) {
    await page.fill("#firebaseEmailInput", email);
    await page.fill("#firebasePasswordInput", password);
    await firebaseLogin.click();
  } else if (await page.locator("#loginButton").count()) {
    await page.locator("#existingUser").selectOption("Avery");
    await page.locator("#loginButton").click();
  } else {
    throw new Error("No supported login surface was found.");
  }
  await page.waitForSelector('[data-view="picklistBuilder"]', { state: "visible" });
}

async function startBackgroundRefreshes(page) {
  await page.evaluate(() => {
    let running = true;
    const tick = async () => {
      if (!running) return;
      try {
        if (typeof globalThis.refreshDataSource === "function") {
          await globalThis.refreshDataSource("tba", { trigger: "poll" });
        }
      } finally {
        if (running) globalThis.__ticket132RefreshTimer = setTimeout(tick, 250);
      }
    };
    globalThis.__ticket132StopRefreshes = () => {
      running = false;
      clearTimeout(globalThis.__ticket132RefreshTimer);
    };
    globalThis.__ticket132RefreshTimer = setTimeout(tick, 250);
  });
}

async function stopBackgroundRefreshes(page) {
  await page.evaluate(() => globalThis.__ticket132StopRefreshes?.());
}

async function installObservers(page) {
  await page.evaluate(() => {
    const state = {
      longTasks: [],
      renderCount: 0,
      renderDurations: [],
      calculationDurations: [],
      activeElementChanges: 0,
    };
    globalThis.__ticket132Metrics = state;

    if (typeof PerformanceObserver === "function") {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.duration > 50) state.longTasks.push(Number(entry.duration.toFixed(2)));
          });
        });
        observer.observe({ type: "longtask", buffered: true });
        state.longTaskObserver = observer;
      } catch {
        // Long-task entries are not supported by every browser engine.
      }
    }

    const originalRender = globalThis.render;
    if (typeof originalRender === "function") {
      globalThis.render = (...args) => {
        const startedAt = performance.now();
        try {
          return originalRender(...args);
        } finally {
          state.renderCount += 1;
          state.renderDurations.push(Number((performance.now() - startedAt).toFixed(2)));
        }
      };
    }

    const originalEvaluateEquationForTeam = globalThis.evaluateEquationForTeam;
    if (typeof originalEvaluateEquationForTeam === "function") {
      globalThis.evaluateEquationForTeam = (...args) => {
        const startedAt = performance.now();
        try {
          return originalEvaluateEquationForTeam(...args);
        } finally {
          state.calculationDurations.push(Number((performance.now() - startedAt).toFixed(2)));
        }
      };
    }

    let lastActiveElement = document.activeElement;
    const checkActiveElement = () => {
      if (document.activeElement !== lastActiveElement) {
        state.activeElementChanges += 1;
        lastActiveElement = document.activeElement;
      }
      requestAnimationFrame(checkActiveElement);
    };
    requestAnimationFrame(checkActiveElement);
  });
}

async function installInteractionFixture(page) {
  await page.evaluate(() => {
    const state = globalThis.__scoutingAppState;
    const eventKey = state?.activeEventKey;
    if (!state || !eventKey) throw new Error("The app did not expose an active local event.");

    const profiles = Array.isArray(state.scoutingProfileCatalog?.[eventKey])
      ? state.scoutingProfileCatalog[eventKey]
      : [];
    const profile = profiles[0] || {
      id: "ticket132-local-profile",
      label: "Ticket 132 local profile",
      fields: [],
      derivedEquations: [],
    };
    profile.derivedEquations = Array.from({ length: 24 }, (_, index) => ({
      id: `ticket132Equation${String(index + 1).padStart(2, "0")}`,
      name: `ticket132Equation${String(index + 1).padStart(2, "0")}`,
      formula: "0",
    }));
    state.scoutingProfileCatalog = { ...state.scoutingProfileCatalog, [eventKey]: [profile] };
    state.activeDerivedEquationId = profile.derivedEquations[0].id;
    globalThis.render?.();
  });
}

async function measureListInteraction(page) {
  await installInteractionFixture(page);
  await page.click('[data-view="derivedBuilder"]');
  const list = page.locator('[data-builder-list-scroll="derived:equations"]');
  await list.waitFor({ state: "visible" });
  const items = list.locator(".builder-list-item");
  const count = await items.count();
  assertCondition(count > 10, `Expected a long derived-equation list, found ${count}.`);

  await items.first().click();
  await list.evaluate((element) => { element.scrollTop = 0; });
  const before = await list.evaluate((element) => ({ scrollTop: element.scrollTop, height: element.scrollHeight }));
  for (let index = 0; index < 20; index += 1) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(15);
  }
  const after = await list.evaluate((element) => ({
    scrollTop: element.scrollTop,
    active: element.querySelector(".builder-list-item.active")?.textContent?.trim() || "",
  }));
  assertCondition(after.scrollTop > before.scrollTop, "List interaction did not advance scroll position.");
  assertCondition(after.active, "List interaction lost its active item.");
  return { before, after };
}

async function measurePairwiseMoves(page) {
  await page.click('[data-view="picklistBuilder"]');
  const currentPicklist = page.locator("[data-current-picklist]");
  await currentPicklist.waitFor({ state: "visible" });
  await currentPicklist.click({ button: "right" });
  await page.locator("[data-pairwise-start]").click();
  await page.locator(".current-picklist-card").waitFor({ state: "visible" });

  const moveDurations = [];
  for (let index = 0; index < 20; index += 1) {
    const beforeOrder = await page.locator("[data-builder-team]").evaluateAll((buttons) => buttons.map((button) => button.dataset.builderTeam).join(","));
    const startedAt = performance.now();
    await page.keyboard.press(index % 2 ? "Shift+ArrowUp" : "Shift+ArrowDown");
    await page.waitForFunction((previousOrder) => (
      document.querySelectorAll("[data-builder-team]")?.length > 0
      && [...document.querySelectorAll("[data-builder-team]")].map((button) => button.dataset.builderTeam).join(",") !== previousOrder
    ), beforeOrder);
    moveDurations.push(Number((performance.now() - startedAt).toFixed(2)));
  }

  const overBudget = moveDurations.filter((duration) => duration > 100);
  assert.deepEqual(overBudget, [], `Pairwise moves exceeded 100 ms: ${JSON.stringify(overBudget)}`);
  return {
    count: moveDurations.length,
    durationsMs: moveDurations,
    maxMs: Math.max(...moveDurations),
    medianMs: moveDurations.slice().sort((left, right) => left - right)[Math.floor(moveDurations.length / 2)],
  };
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
  await installObservers(page);
  await startBackgroundRefreshes(page);
  const list = await measureListInteraction(page);
  const pairwise = await measurePairwiseMoves(page);
  await stopBackgroundRefreshes(page);
  const metrics = await page.evaluate(() => ({
    longTasksOver50Ms: globalThis.__ticket132Metrics.longTasks,
    renderCount: globalThis.__ticket132Metrics.renderCount,
    maxRenderMs: Math.max(0, ...globalThis.__ticket132Metrics.renderDurations),
    calculationCount: globalThis.__ticket132Metrics.calculationDurations.length,
    maxCalculationMs: Math.max(0, ...globalThis.__ticket132Metrics.calculationDurations),
    activeElementChanges: globalThis.__ticket132Metrics.activeElementChanges,
  }));
  const result = { appUrl, list, pairwise, metrics, pageErrors };
  console.log(JSON.stringify(result, null, 2));
  assert.deepEqual(pageErrors, [], `The app emitted page errors: ${pageErrors.join(" | ")}`);
} finally {
  await stopBackgroundRefreshes(page).catch(() => {});
  await browser.close();
}
