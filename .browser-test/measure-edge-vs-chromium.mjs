import { chromium } from "playwright";

const appUrl = "file:///D:/FIRST/Scouting/Bovine-Scouting-Analysis/index.html";
const edgeExecutablePath = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

async function waitForApp(page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(2000);
}

async function login(page) {
  const existingUser = page.locator("#existingUser");
  if (await existingUser.count()) {
    await existingUser.selectOption("Avery");
    await page.locator("#loginButton").click();
    await page.waitForSelector('[data-view="teams"]');
  }
}

async function collectMetrics(browserType, launchOptions = {}) {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  try {
    const start = Date.now();
    await page.goto(appUrl);
    await waitForApp(page);
    await login(page);
    await page.waitForTimeout(1000);
    const startupElapsedMs = Date.now() - start;
    const afterStartup = await page.evaluate(() => JSON.parse(JSON.stringify(globalThis.__scoutingPerf || { events: [] })));

    const switchStart = Date.now();
    await page.evaluate(async () => {
      await switchActiveEvent("2024txfor", { activeView: "admin" });
    });
    await page.waitForTimeout(1500);
    const switchElapsedMs = Date.now() - switchStart;
    const afterSwitch = await page.evaluate(() => JSON.parse(JSON.stringify(globalThis.__scoutingPerf || { events: [] })));

    return {
      browserType,
      startupElapsedMs,
      switchElapsedMs,
      pageErrors,
      perfEvents: afterSwitch.events.length ? afterSwitch.events : afterStartup.events,
    };
  } finally {
    await page.close();
    await browser.close();
  }
}

const chromiumResult = await collectMetrics("chromium");
const edgeResult = await collectMetrics("edge", { executablePath: edgeExecutablePath, channel: undefined });

console.log(JSON.stringify({ chromium: chromiumResult, edge: edgeResult }, null, 2));
