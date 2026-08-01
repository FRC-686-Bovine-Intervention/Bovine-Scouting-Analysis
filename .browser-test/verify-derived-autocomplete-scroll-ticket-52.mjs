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

const appUrl = "http://localhost:4173/index.html";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(appUrl);
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

  const input = page.locator("#derivedEquationFormulaInput");
  await input.fill("scouting.");
  await page.waitForSelector("#derivedFormulaAutocomplete:not([hidden])");
  for (let index = 0; index < 20; index += 1) await input.press("ArrowDown");
  for (let index = 0; index < 10; index += 1) await input.press("ArrowUp");

  const result = await page.locator("#derivedFormulaAutocomplete").evaluate((popup) => {
    const active = popup.querySelector(".formula-autocomplete-item.active");
    const popupRect = popup.getBoundingClientRect();
    const activeRect = active?.getBoundingClientRect();
    return {
      candidateCount: popup.querySelectorAll(".formula-autocomplete-item").length,
      selectedIndex: Number(popup.dataset.selectedIndex),
      scrollTop: popup.scrollTop,
      activeIsVisible: Boolean(activeRect && activeRect.top >= popupRect.top && activeRect.bottom <= popupRect.bottom),
    };
  });

  assert(result.candidateCount > 20, `Expected more than 20 suggestions, got ${result.candidateCount}.`);
  assert(result.selectedIndex === 10, `Expected ArrowUp navigation to select suggestion 10, got ${result.selectedIndex}.`);
  assert(result.scrollTop > 0, "Keyboard navigation did not scroll the autocomplete dropdown.");
  assert(result.activeIsVisible, "Keyboard-selected suggestion is not visible in the autocomplete dropdown.");
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
