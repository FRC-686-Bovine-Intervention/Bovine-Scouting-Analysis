import { chromium } from "./node_modules/playwright/index.mjs";

const views = ["teams", "rankings", "schedule", "matchup", "quality", "analysis", "derivedBuilder", "picklistBuilder", "alliance", "admin"];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const results = [];

for (const view of views) {
  const pageErrors = [];
  page.removeAllListeners("pageerror");
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto("file:///D:/FIRST/Scouting/Scouting-Analysis/index.html");
  await page.waitForLoadState("load");
  await page.evaluate((activeView) => {
    localStorage.setItem("frc-scouting-user", "Avery");
    localStorage.setItem("frc-scouting-active-view", activeView);
  }, view);
  await page.reload();
  await page.waitForLoadState("load");
  await page.waitForTimeout(1200);
  const snapshot = await page.evaluate(() => ({
    text: document.body?.innerText?.slice(0, 200) || "",
    hasContent: Boolean(document.querySelector("#app")?.innerHTML?.trim()),
    title: document.title,
  }));
  results.push({ view, pageErrors, snapshot });
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
