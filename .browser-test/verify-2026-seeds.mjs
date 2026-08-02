import { chromium } from "./node_modules/playwright/index.mjs";

const appUrl = "file:///D:/FIRST/Scouting/Bovine-Scouting-Analysis/index.html";

function text(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

async function waitForApp(page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(1000);
}

async function login(page) {
  const existingUser = page.locator("#existingUser");
  if (await existingUser.count()) {
    await existingUser.selectOption("Avery");
    await page.locator("#loginButton").click();
    await page.waitForSelector('[data-view="teams"]');
  }
}

async function openAdmin(page) {
  await page.locator('[data-view="admin"]').click();
  await page.waitForSelector("#adminEventSelect");
}

async function switchEvent(page, eventKey) {
  await page.selectOption("#adminEventSelect", eventKey);
  await page.waitForTimeout(750);
}

async function injectStaleCatalogs(page) {
  await page.evaluate(() => {
    const eventKey = "2026chcmp";
    localStorage.setItem(
      `frc-scouting-season-derived-equations:${eventKey}`,
      JSON.stringify({
        seasons: {
          "2026": [
            {
              id: "staleOnly",
              name: "Stale Only",
              formula: "999",
              unit: "pts",
              description: "Should be replaced by the checked-in seed.",
            },
          ],
        },
      }),
    );
    localStorage.setItem(
      `frc-scouting-season-filters:${eventKey}`,
      JSON.stringify({
        seasons: {
          "2026": [
            {
              id: "staleFilterOnly",
              name: "Stale Filter Only",
              formula: "true",
              description: "Should be replaced by the checked-in seed.",
            },
          ],
        },
      }),
    );
  });
}

async function captureSeedState(page) {
  return page.evaluate(() => {
    const appState = globalThis.__scoutingAppState;
    const equations = appState?.seasonDerivedEquationCatalog?.seasons?.["2026"] || [];
    return {
      equationIds: equations.map((definition) => definition.id),
      activeEventKey: appState?.activeEventKey || "",
    };
  });
}

async function captureBuilderLists(page) {
  await page.locator('[data-view="derivedBuilder"]').click();
  await page.waitForTimeout(500);
  const equationNames = await page.locator(".builder-list").first().locator(".builder-list-item").allTextContents();

  return {
    equationNames: equationNames.map(text),
    filterNames: [],
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));

const result = { pageErrors };

try {
  await page.goto(appUrl);
  await waitForApp(page);
  await login(page);
  await openAdmin(page);
  await switchEvent(page, "2026chcmp");
  await injectStaleCatalogs(page);
  await page.reload();
  await waitForApp(page);
  await login(page);
  await openAdmin(page);
  await switchEvent(page, "2026chcmp");

  result.seedState = await captureSeedState(page);
  result.builderLists = await captureBuilderLists(page);
} finally {
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
