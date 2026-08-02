import { chromium } from "playwright";

const appUrl = "file:///D:/FIRST/Scouting/Bovine-Scouting-Analysis/index.html";

function text(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  await page.waitForSelector('[data-view="teams"]');
}

async function openAdminForEvent(page, eventKey) {
  await page.click('[data-view="admin"]');
  await page.waitForSelector("#adminEventSelect");
  await page.selectOption("#adminEventSelect", eventKey);
  await page.waitForTimeout(800);
}

async function readSourceRows(page) {
  const rows = await page.locator(".data-source-row").evaluateAll((elements) =>
    elements.map((element) => ({
      text: element.textContent || "",
      refreshLabel: element.querySelector("[data-refresh-source]")?.textContent || "",
      pollingLabel: element.querySelector("[data-toggle-source-polling]")?.textContent || "",
      pollingSourceId: element.querySelector("[data-toggle-source-polling]")?.getAttribute("data-toggle-source-polling") || "",
      status: element.querySelector(".source-status")?.textContent || "",
      statusClassName: element.querySelector(".source-status")?.className || "",
    })),
  );
  return rows.map((row) => ({
    ...row,
    text: text(row.text),
    refreshLabel: text(row.refreshLabel),
    pollingLabel: text(row.pollingLabel),
    status: text(row.status),
    statusClassName: text(row.statusClassName),
  }));
}

function rowBySourceId(rows, sourceId) {
  return rows.find((row) => row.pollingSourceId === sourceId) || null;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));

const result = { appUrl, pageErrors };

try {
  await page.goto(appUrl);
  await waitForBody(page);
  await login(page);
  await openAdminForEvent(page, "2026chcmp");

  result.initialRows = await readSourceRows(page);
  result.hasRefreshAll = await page.locator("#refreshAllSourcesButton").count();

  const tbaPollingButton = page.locator('[data-toggle-source-polling="tba"]').first();
  result.tbaPollingBefore = text(await tbaPollingButton.textContent());
  await tbaPollingButton.click();
  await page.waitForTimeout(300);
  result.tbaPollingAfterPause = text(await page.locator('[data-toggle-source-polling="tba"]').first().textContent());
  await page.locator('[data-toggle-source-polling="tba"]').first().click();
  await page.waitForTimeout(300);
  result.tbaPollingAfterResume = text(await page.locator('[data-toggle-source-polling="tba"]').first().textContent());

  const activityBefore = await page.locator(".activity-row").count();
  await page.locator('[data-refresh-source="tba"]').first().click();
  await page.waitForTimeout(800);
  result.rowsAfterTbaRefresh = await readSourceRows(page);
  result.activityAfterTbaRefresh = await page.locator(".activity-row").count();
  result.tbaRefreshAddedActivity = result.activityAfterTbaRefresh > activityBefore;

  await page.locator("#refreshAllSourcesButton").click();
  await page.waitForTimeout(1500);
  result.rowsAfterRefreshAll = await readSourceRows(page);
  result.activityAfterRefreshAll = await page.locator(".activity-row").count();

  assert(result.pageErrors.length === 0, `Unexpected page errors: ${result.pageErrors.join(" | ")}`);
  assert(result.hasRefreshAll === 1, "Refresh All Sources button was not found.");
  assert(result.initialRows.length === 4, `Expected 4 source rows, found ${result.initialRows.length}.`);
  assert(result.tbaPollingBefore === "Pause Polling", `Expected initial TBA polling label to be 'Pause Polling', got '${result.tbaPollingBefore}'.`);
  assert(result.tbaPollingAfterPause === "Resume Polling", `Expected paused TBA polling label to be 'Resume Polling', got '${result.tbaPollingAfterPause}'.`);
  assert(result.tbaPollingAfterResume === "Pause Polling", `Expected resumed TBA polling label to be 'Pause Polling', got '${result.tbaPollingAfterResume}'.`);
  assert(result.tbaRefreshAddedActivity === true, "Expected manual TBA refresh to add an activity entry.");

  const supportedStatuses = new Set(["Ready", "Stale", "Error"]);
  result.initialRows.forEach((row) => {
    assert(supportedStatuses.has(row.status), `Expected supported status badge vocabulary. Got '${row.status}' in row '${row.text}'.`);
    assert(
      /status-(ready|stale|error)\b/.test(row.statusClassName),
      `Expected source row to include a normalized status class. Got '${row.statusClassName}'.`,
    );
  });

  const tbaAfterManual = rowBySourceId(result.rowsAfterTbaRefresh, "tba");
  assert(tbaAfterManual, "Could not find TBA row after manual refresh.");
  assert(
    tbaAfterManual.text.includes("found no content changes"),
    `Expected manual TBA refresh to report no content changes, got '${tbaAfterManual.text}'.`,
  );

  const tbaAfterAll = rowBySourceId(result.rowsAfterRefreshAll, "tba");
  const statboticsAfterAll = rowBySourceId(result.rowsAfterRefreshAll, "statbotics");
  const pridgeAfterAll = rowBySourceId(result.rowsAfterRefreshAll, "pridge");
  assert(tbaAfterAll && statboticsAfterAll && pridgeAfterAll, "Missing one or more external source rows after Refresh All.");
  assert(
    tbaAfterAll.text.includes("found no content changes"),
    `Expected Refresh All to keep TBA unchanged, got '${tbaAfterAll.text}'.`,
  );
  assert(
    statboticsAfterAll.text.includes("found no content changes"),
    `Expected Refresh All to keep Statbotics unchanged, got '${statboticsAfterAll.text}'.`,
  );
  assert(
    pridgeAfterAll.text.includes("found no content changes"),
    `Expected Refresh All to keep pRidge unchanged, got '${pridgeAfterAll.text}'.`,
  );
} finally {
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
