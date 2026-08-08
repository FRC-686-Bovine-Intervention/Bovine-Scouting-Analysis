import assert from "node:assert/strict";
import { chromium } from "./node_modules/playwright/index.mjs";

const appUrl = "http://127.0.0.1:4174";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(appUrl);
  await page.waitForLoadState("load");
  await page.locator("#existingUser").selectOption("Avery");
  await page.locator("#loginButton").click();
  await page.locator('[data-view="picklistBuilder"]').click();

  const comparisonGridText = await page.locator("article.card", { hasText: "Comparison Grid" }).locator(".muted").textContent();
  assert.equal(comparisonGridText?.trim(), "Select up to four metrics for side-by-side comparison");

  const standardHelp = await page.locator(".current-picklist-card .muted").textContent();
  assert.equal(standardHelp?.trim(), [
    "Drag: reorder teams",
    "↑↓: change team selection",
    "Shift + ↑↓: Move team",
    "Right-click: Access Pairwise Mode",
  ].join("\n"));

  await page.locator("[data-current-picklist]").click({ button: "right" });
  await page.locator("[data-pairwise-start]").click();

  const pairwiseHelp = await page.locator(".current-picklist-card .muted").textContent();
  assert.equal(pairwiseHelp?.trim(), [
    "Pairwise mode",
    "↑↓: change team selection",
    "Shift + ↑↓: Compare to team above, move team",
    "Ctrl + ↑↓: Compare to team below, move team",
    "Gray highlights: suggested teams to revisit",
  ].join("\n"));
} finally {
  await browser.close();
}
