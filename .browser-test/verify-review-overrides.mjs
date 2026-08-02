import { chromium } from "playwright";

const appUrl = "file:///D:/FIRST/Scouting/Bovine-Scouting-Analysis/index.html";

function text(node) {
  return node ? node.trim().replace(/\s+/g, " ") : "";
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForApp(page) {
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

async function loadDuplicatePreview(page) {
  const duplicateCsv = [
    "meta,season,eventKey,schemaVersion,templateProfileId",
    "value,2026,2026chcmp,match-v2,match-current-v2",
    "",
    "matchNumber,teamNumber,scoutUser,alliance,station,defensePlayed,robotStatus,notes,autoFuelPct,overallDriver",
    "12,686,Scout A,Blue,1,no,ok,First row,40,4",
    "12,686,Scout B,Blue,2,no,ok,Second row,42,5",
  ].join("\n");

  await page.evaluate((csvText) => {
    loadPreparedScoutingCsv(csvText, "match-current-v2");
  }, duplicateCsv);
  await page.waitForTimeout(750);
}

async function importDebugState(page) {
  return page.evaluate(() => ({
    importResult: state.importResult ? {
      ok: state.importResult.ok,
      errors: state.importResult.errors,
      warnings: state.importResult.warnings,
      summary: state.importResult.summary ? {
        duplicateGroups: state.importResult.summary.duplicateGroups,
        duplicateGroupKeys: state.importResult.summary.duplicateGroupKeys,
        flaggedRows: state.importResult.summary.flaggedRows,
        rowCount: state.importResult.summary.rowCount,
        submissions: state.importResult.summary.submissions.map((submission) => ({
          id: submission.id,
          teamNumber: submission.teamNumber,
          matchNumber: submission.matchNumber,
          validity: submission.validity,
          confidenceReasons: submission.confidenceReasons,
        })),
      } : null,
    } : null,
    storedSubmissions: state.scoutingSubmissions.map((submission) => ({
      id: submission.id,
      teamNumber: submission.teamNumber,
      matchNumber: submission.matchNumber,
      validity: submission.validity,
      confidenceReasons: submission.confidenceReasons,
    })),
  }));
}

async function clearEventScoutingState(page, eventKey) {
  await page.evaluate((targetEventKey) => {
    localStorage.setItem(`frc-scouting-submissions:${targetEventKey}`, "[]");
    localStorage.setItem(`frc-scouting-review-overrides:${targetEventKey}`, "[]");
    state.scoutingSubmissions = [];
    state.scoutingReviewOverrides = [];
    state.activityLog = [];
    state.importResult = null;
    state.importCsvText = "";
    const activeAttachment = state.eventWorkspace?.sources?.scouting?.find(
      (attachment) => attachment.attachmentId === state.eventWorkspace.activeScoutingAttachmentId,
    );
    if (activeAttachment) {
      activeAttachment.autoLoad = false;
      activeAttachment.locationKind = "manual";
      activeAttachment.location = { ...(activeAttachment.location || {}), url: "", path: "", sampleKey: "" };
      activeAttachment.status = "idle";
    }
    saveState();
  }, eventKey);
}

async function openQuality(page) {
  await page.click('[data-view="quality"]');
  await page.waitForTimeout(750);
}

async function snapshotReviewState(page) {
  return page.evaluate(() => {
    const eventKey = localStorage.getItem("frc-scouting-active-event");
    const submissions = JSON.parse(localStorage.getItem(`frc-scouting-submissions:${eventKey}`) || "[]");
    const overrides = JSON.parse(localStorage.getItem(`frc-scouting-review-overrides:${eventKey}`) || "[]");
    const effective = currentScoutingSubmissions();
    return {
      eventKey,
      rawSubmissions: submissions.map((submission) => ({
        id: submission.id,
        validity: submission.validity,
        confidenceReasons: submission.confidenceReasons,
      })),
      overrides: overrides.map((override) => ({
        submissionId: override.submissionId,
        action: override.action,
        clearedAt: override.clearedAt || "",
      })),
      effective: effective.map((submission) => ({
        id: submission.id,
        validity: submission.validity,
        confidenceReasons: submission.confidenceReasons,
      })),
    };
  });
}

async function qualityDebug(page) {
  return {
    reviewKeepCount: await page.locator('[data-review-keep]').count(),
    reviewExcludeCount: await page.locator('[data-review-exclude]').count(),
    reviewResetCount: await page.locator('[data-review-reset]').count(),
    clearGroupCount: await page.locator('[data-clear-duplicate-group]').count(),
    body: text(await page.textContent("body")),
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
  await clearEventScoutingState(page, "2026chcmp");
  await loadDuplicatePreview(page);
  result.previewDebug = await importDebugState(page);
  await page.locator("#commitImportButton").click();
  await page.waitForTimeout(1000);
  result.importDebug = await importDebugState(page);
  await openQuality(page);

  result.initial = await snapshotReviewState(page);
  result.initialUi = await qualityDebug(page);

  assert(result.previewDebug.importResult?.summary?.duplicateGroups === 1, `Expected one duplicate group in preview. Got: ${JSON.stringify(result.previewDebug)}`);
  assert(result.previewDebug.importResult?.summary?.flaggedRows === 2, `Expected two flagged preview rows. Got: ${JSON.stringify(result.previewDebug)}`);
  assert(result.importDebug.storedSubmissions.every((submission) => submission.validity === "flagged"), `Expected committed duplicate rows to stay flagged. Got: ${JSON.stringify(result.importDebug)}`);
  assert(result.initialUi.reviewKeepCount >= 2, `Expected review controls to render. Preview debug: ${JSON.stringify(result.previewDebug)}. Import debug: ${JSON.stringify(result.importDebug)}. State: ${JSON.stringify(result.initial)}. UI: ${JSON.stringify(result.initialUi)}`);

  await page.locator('[data-review-keep]').first().click();
  await page.waitForTimeout(500);
  result.afterKeep = await snapshotReviewState(page);
  assert(result.afterKeep.effective[0]?.validity === "valid", `Expected keep override to make the first submission valid. Got: ${JSON.stringify(result.afterKeep)}`);
  assert(result.afterKeep.overrides.some((override) => override.action === "keep" && !override.clearedAt), `Expected an active keep override after keep. Got: ${JSON.stringify(result.afterKeep)}`);

  await page.locator('[data-review-exclude]').nth(1).click();
  await page.waitForTimeout(500);
  result.afterExclude = await snapshotReviewState(page);
  assert(result.afterExclude.effective[1]?.validity === "excluded", `Expected exclude override to exclude the second submission. Got: ${JSON.stringify(result.afterExclude)}`);
  assert(result.afterExclude.overrides.some((override) => override.action === "exclude" && !override.clearedAt), `Expected an active exclude override after exclude. Got: ${JSON.stringify(result.afterExclude)}`);

  await page.locator('[data-review-reset]').first().click();
  await page.waitForTimeout(500);
  result.afterReset = await snapshotReviewState(page);
  assert(result.afterReset.effective[0]?.validity === "flagged", `Expected reset to restore the first submission flag. Got: ${JSON.stringify(result.afterReset)}`);
  assert(result.afterReset.overrides.some((override) => override.action === "keep" && override.clearedAt), `Expected the keep override to be cleared after reset. Got: ${JSON.stringify(result.afterReset)}`);

  await page.reload();
  await waitForApp(page);
  await login(page);
  await openQuality(page);
  result.afterReload = await snapshotReviewState(page);
  assert(result.afterReload.effective[0]?.validity === "flagged", `Expected the reset state to persist after reload. Got: ${JSON.stringify(result.afterReload)}`);
  assert(result.afterReload.effective[1]?.validity === "excluded", `Expected the exclude override to persist after reload. Got: ${JSON.stringify(result.afterReload)}`);
} finally {
  await browser.close();
}

console.log(JSON.stringify({
  duplicateGroups: result.previewDebug?.importResult?.summary?.duplicateGroups || 0,
  flaggedRows: result.previewDebug?.importResult?.summary?.flaggedRows || 0,
  initialReviewControls: {
    keep: result.initialUi?.reviewKeepCount || 0,
    exclude: result.initialUi?.reviewExcludeCount || 0,
    reset: result.initialUi?.reviewResetCount || 0,
  },
  afterKeep: result.afterKeep?.effective || [],
  afterExclude: result.afterExclude?.effective || [],
  afterReset: result.afterReset?.effective || [],
  afterReload: result.afterReload?.effective || [],
  pageErrors,
}, null, 2));
