import { chromium } from "./node_modules/playwright/index.mjs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
const consoleErrors = [];

page.on("pageerror", (error) => pageErrors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

await page.goto("file:///D:/FIRST/Scouting/Scouting-Analysis/index.html");
await page.waitForLoadState("load");
await page.waitForTimeout(1500);

const snapshot = await page.evaluate(() => ({
  bodyText: document.body?.innerText || "",
  bodyHtml: document.body?.innerHTML?.slice(0, 1000) || "",
  title: document.title,
}));

console.log(JSON.stringify({ pageErrors, consoleErrors, snapshot }, null, 2));

await browser.close();
