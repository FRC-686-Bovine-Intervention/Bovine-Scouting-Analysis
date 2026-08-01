import { chromium } from "playwright";

const appUrl = "file:///D:/FIRST/Scouting/Scouting-Analysis/index.html";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function verifyTbaPerMatchScores(page) {
  const sourceValue = await page.evaluate(() => [...document.querySelectorAll('input.picklist-check[value^="metric:source:tba:"]')]
    .map((input) => input.value)
    .find((entry) => {
      const metric = metricById(entry.slice(7));
      return metric?.granularity === "match" && currentTeams().some((team) => tbaMatchMetricsByTeam(team.number)
        .some((row) => {
          const value = Number(row?.[metric.componentId]);
          return Number.isFinite(value) && value !== 0;
        }));
    }));
  if (!sourceValue) throw new Error("No nonzero per-match TBA metric source was available to validate.");
  const checkbox = page.locator(`input.picklist-check[value="${sourceValue}"]`);

  await checkbox.check();
  await page.waitForTimeout(150);
  return page.evaluate((entry) => {
    const metric = metricById(entry.slice(7));
    const expectedScores = [...currentTeams()]
      .map((team) => {
        const values = tbaMatchMetricsByTeam(team.number)
          .map((row) => Number(row?.[metric.componentId]))
          .filter((value) => Number.isFinite(value));
        return { number: team.number, value: values.length ? average(values) : Number.NaN };
      })
      .sort((left, right) => {
        if (!Number.isFinite(left.value)) return Number.isFinite(right.value) ? 1 : left.number - right.number;
        if (!Number.isFinite(right.value)) return -1;
        return right.value - left.value || left.number - right.number;
      })
      .map((item) => Number.isFinite(item.value) ? item.value.toFixed(1) : "-");
    const displayedScores = [...document.querySelectorAll(`[data-loaded-source="${entry}"] .tile-score`)]
      .map((element) => String(element.textContent || "").trim());
    return { expectedScores, displayedScores };
  }, sourceValue);
}

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
  const metricLabel = (await metricCheckbox.locator("xpath=following-sibling::span").textContent()).trim();
  if ((await page.locator(".picklist-loader").textContent()).includes("Metric source")) throw new Error("Metric source wording remains.");

  await metricCheckbox.check();
  await page.waitForTimeout(150);
  const header = (await page.locator(`[data-loaded-source="${sourceValue}"] h3`).textContent()).trim();
  if (!header.startsWith(metricLabel)) throw new Error(`Displayed header ${header} did not start with ${metricLabel}.`);

  const tbaPerMatchScores = await verifyTbaPerMatchScores(page);
  if (tbaPerMatchScores.displayedScores.join(",") !== tbaPerMatchScores.expectedScores.join(",")) {
    throw new Error(`Displayed TBA scores did not match raw per-match averages: ${JSON.stringify(tbaPerMatchScores)}`);
  }

  await page.locator("#clearPicklistSourcesButton").click();
  await page.waitForTimeout(150);
  if (await page.locator(".picklist-check:checked").count()) throw new Error("Clear Sources left a source selected.");
  if (await page.locator("[data-loaded-source]").count()) throw new Error("Clear Sources left a source displayed.");
  await page.reload();
  if (await page.locator(".picklist-check:checked").count()) throw new Error("Clear Sources did not persist after reload.");

  console.log(`Verified Picklist Selector with ${metricLabel}.`);
} finally {
  await browser.close();
}
