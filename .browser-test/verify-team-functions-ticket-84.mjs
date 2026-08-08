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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage();

try {
  await page.addInitScript(() => {
    globalThis.eventCatalog = [{
      key: "2026test",
      season: 2026,
      seasonLabel: "Test",
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
  await page.goto("http://localhost:4173/index.html");
  await page.waitForLoadState("load");
  await page.waitForTimeout(800);

  if (await page.locator("#existingUser").count()) {
    await page.locator("#existingUser").selectOption("Avery");
    await page.locator("#loginButton").click();
    await page.waitForSelector('[data-view="teams"]');
  } else {
    await page.evaluate(() => {
      globalThis.firebaseCurrentUser = { email: "team-functions-test@example.test" };
      globalThis.firebaseUserRole = "admin";
      globalThis.dispatchEvent(new CustomEvent("firebase-auth-state-changed", {
        detail: { user: globalThis.firebaseCurrentUser, role: "admin" },
      }));
    });
    await page.waitForSelector('[data-view="teams"]');
  }

  await page.locator('[data-view="derivedBuilder"]').click();
  await page.waitForSelector("#derivedEquationFormulaInput");
  if (!(await page.locator('[data-entity-kind="derivedEquation"]').count())) {
    await page.locator("#addDerivedEquationButton").click();
    await page.waitForSelector('[data-entity-kind="derivedEquation"]');
  }
  await page.locator("#derivedEquationFormulaInput").fill("team");
  if (!(await page.locator("#derivedFormulaAutocomplete:not([hidden])").count())) {
    const inputState = await page.locator("#derivedEquationFormulaInput").evaluate((input) => ({ value: input.value, selectionStart: input.selectionStart, disabled: input.disabled }));
    throw new Error(`Team autocomplete did not open. Input: ${JSON.stringify(inputState)}. Body: ${(await page.locator("body").innerText()).slice(0, 1200)}`);
  }
  await page.waitForSelector("#derivedFormulaAutocomplete:not([hidden])");

  const autocomplete = (await page.locator("#derivedFormulaAutocomplete [data-formula-suggestion]").allTextContents()).map((text) => text.trim());
  const helpText = await page.evaluate(() => renderFormulaHelpStandaloneDocument());
  const dropdownText = await page.locator(".formula-function-popover").textContent();

  ["teamAverage", "teamSum", "teamCount", "teamMin", "teamMax"].forEach((name) => {
    assert(autocomplete.includes(name), `Autocomplete is missing ${name}. Got: ${autocomplete.join(", ")}`);
  });
  [
    "Alias for teamAverage",
    "Alias for teamSum",
    "Alias for teamCount",
    "Alias for teamMin",
    "Alias for teamMax",
  ].forEach((text) => assert(String(helpText || "").includes(text), `Function help is missing ${text}.`));
  [
    "Alias for teamAverage",
    "Alias for teamSum",
    "Alias for teamCount",
    "Alias for teamMin",
    "Alias for teamMax",
  ].forEach((text) => assert(String(dropdownText || "").includes(text), `Dropdown help is missing ${text}.`));

  console.log("PASS team* functions appear in derived autocomplete and both help surfaces identify common aliases.");
} finally {
  await browser.close();
}
