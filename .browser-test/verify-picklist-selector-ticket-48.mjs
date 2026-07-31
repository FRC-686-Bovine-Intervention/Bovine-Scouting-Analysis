import { chromium } from "playwright";

const appUrl = "file:///D:/FIRST/Scouting/Scouting-Analysis/index.html";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(appUrl);
  await page.waitForTimeout(1000);
  if (await page.locator("#existingUser").count()) {
    await page.locator("#existingUser").selectOption("Avery");
    await page.locator("#loginButton").click();
    await page.waitForSelector('[data-view="alliance"]');
  }
  await page.locator('[data-view="alliance"]').click();
  await page.waitForTimeout(400);

  const groupNames = await page.locator(".picklist-loader-group h3").allTextContents();
  if (groupNames.join(",") !== "Picklists,Metrics") throw new Error(`Unexpected source order: ${groupNames.join(",")}`);

  const metricCheckbox = page
    .locator(".picklist-loader-group")
    .filter({ has: page.getByRole("heading", { name: "Metrics", exact: true }) })
    .locator("input.picklist-check")
    .first();
  const sourceValue = await metricCheckbox.getAttribute("value");
  if (!sourceValue) throw new Error("No metric source was available to validate.");
  const metricId = sourceValue.slice("metric:".length);
  const metricLabel = (await metricCheckbox.locator("xpath=following-sibling::span").textContent()).trim();
  if (metricLabel !== metricId) throw new Error(`Metric selector label ${metricLabel} did not match raw ID ${metricId}.`);
  if ((await page.locator(".picklist-loader").textContent()).includes("Metric source")) throw new Error("Metric source wording remains.");

  await metricCheckbox.check();
  await page.waitForTimeout(150);
  const header = (await page.locator(`[data-loaded-source="${sourceValue}"] h3`).textContent()).trim();
  if (!header.startsWith(metricId)) throw new Error(`Displayed header ${header} did not start with ${metricId}.`);

  await page.locator("#clearPicklistSourcesButton").click();
  await page.waitForTimeout(150);
  if (await page.locator(".picklist-check:checked").count()) throw new Error("Clear Sources left a source selected.");
  if (await page.locator("[data-loaded-source]").count()) throw new Error("Clear Sources left a source displayed.");

  console.log(`Verified Picklist Selector with ${metricId}.`);
} finally {
  await browser.close();
}
