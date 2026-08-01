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
const expectedFunctions = ["min", "max", "matchMin", "matchMax", "allianceMin", "allianceMax", "eventMin", "eventMax"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto("http://localhost:4173/index.html");
  await page.waitForLoadState("load");
  await page.waitForTimeout(800);

  const existingUser = page.locator("#existingUser");
  if (await existingUser.count()) {
    await existingUser.selectOption("Avery");
    await page.locator("#loginButton").click();
    await page.waitForSelector('[data-view="teams"]');
  }

  await page.locator('[data-view="derivedBuilder"]').click();
  await page.waitForSelector("#derivedEquationFormulaInput");
  await page.locator("#derivedEquationFormulaInput").fill("m");
  await page.waitForSelector("#derivedFormulaAutocomplete:not([hidden])");

  const autocompleteFunctions = await page.locator("#derivedFormulaAutocomplete [data-formula-suggestion]").allTextContents();
  const helpPage = page.waitForEvent("popup");
  await page.locator("#formulaFunctionHelpButton").click();
  const help = await helpPage;
  await help.waitForLoadState("load");
  const helpText = await help.locator("body").textContent();

  const result = {
    autocompleteFunctions,
    missingAutocomplete: ["min", "max", "matchMin", "matchMax"].filter((name) => !autocompleteFunctions.includes(name)),
    missingHelp: expectedFunctions.filter((name) => !String(helpText || "").includes(`${name}(`)),
  };
  assert(result.missingAutocomplete.length === 0, `Autocomplete is missing: ${result.missingAutocomplete.join(", ")}`);
  assert(result.missingHelp.length === 0, `Function help is missing: ${result.missingHelp.join(", ")}`);
  console.log(JSON.stringify(result));
  await help.close();
} finally {
  await browser.close();
}
