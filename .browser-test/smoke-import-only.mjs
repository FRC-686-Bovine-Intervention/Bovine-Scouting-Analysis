import { chromium } from "playwright";

const appUrl = "file:///D:/FIRST/Scouting/Bovine-Scouting-Analysis/index.html";

function text(node) {
  return node ? node.trim().replace(/\s+/g, " ") : "";
}

async function waitForBody(page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(1000);
}

async function login(page) {
  const existingUser = page.locator("#existingUser");
  if (await existingUser.count()) {
    await existingUser.selectOption("Avery");
    await page.click("#loginButton");
    await page.waitForSelector('[data-view="teams"]');
    return;
  }
  if (await page.locator('[data-view="teams"]').count()) return;
  throw new Error(`Login controls were not rendered. Body snapshot: ${text(await page.textContent("body"))}`);
}

async function openAdmin(page) {
  await page.click('[data-view="admin"]');
  await page.waitForSelector("#adminEventSelect");
}

async function switchEvent(page, eventKey) {
  await page.selectOption("#adminEventSelect", eventKey);
  await page.waitForTimeout(750);
}

async function importCurrentSheet(page) {
  const loadButton = page.locator("#loadScoutingDataButton");
  await loadButton.waitFor({ state: "visible" });
  await loadButton.click();
  await page.waitForTimeout(1200);
  const commitButton = page.locator("#commitImportButton");
  if (await commitButton.isEnabled()) {
    await commitButton.click();
    await page.waitForTimeout(1200);
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));

try {
  await page.goto(appUrl);
  await waitForBody(page);
  await login(page);
  await openAdmin(page);
  await switchEvent(page, "2026chcmp");
  await importCurrentSheet(page);
  const importedRows = await page.locator(".stat").nth(0).textContent();
  console.log(JSON.stringify({ importedRows: text(importedRows), pageErrors }, null, 2));
} finally {
  await browser.close();
}
