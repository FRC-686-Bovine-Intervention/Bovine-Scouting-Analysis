import { chromium } from "playwright";

const appUrl = "file:///D:/FIRST/Scouting/Scouting-Analysis/index.html";

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
  const previewFlags = await page.locator(".preview-shell .flag").allTextContents();
  const commitEnabled = await page.locator("#commitImportButton").isEnabled();
  const issues = await page.locator(".issue-list .issue-row").allTextContents();
  const csvHead = (await page.locator("#importCsvInput").inputValue()).split(/\r?\n/).slice(0, 5);
  return { previewFlags, commitEnabled, issues: issues.map(text), csvHead };
}

async function commitImport(page) {
  const commitButton = page.locator("#commitImportButton");
  if (await commitButton.isEnabled()) {
    await commitButton.click();
    await page.waitForTimeout(1200);
  }
}

async function storageSnapshot(page) {
  return page.evaluate(() => {
    const eventKey = localStorage.getItem("frc-scouting-active-event");
    const submissionsKey = `frc-scouting-submissions:${eventKey}`;
    const raw = localStorage.getItem(submissionsKey);
    const submissions = raw ? JSON.parse(raw) : [];
    return {
      eventKey,
      submissionsKey,
      rowCount: submissions.length,
      eventKeys: [...new Set(submissions.map((row) => row.eventKey).filter(Boolean))],
      sample: submissions.slice(0, 3).map((row) => ({
        teamNumber: row.teamNumber,
        matchNumber: row.matchNumber,
        eventKey: row.eventKey,
        rawMetricKeys: Object.keys(row.rawMetrics || {}),
        rawMetrics: row.rawMetrics,
      })),
    };
  });
}

async function simulateLegacyOnlyStorage(page) {
  return page.evaluate(() => {
    const eventKey = localStorage.getItem("frc-scouting-active-event");
    const scopedKey = `frc-scouting-submissions:${eventKey}`;
    const scopedValue = localStorage.getItem(scopedKey);
    localStorage.setItem("frc-scouting-submissions", scopedValue || "[]");
    localStorage.removeItem(scopedKey);
    return { eventKey, scopedKey, copied: Boolean(scopedValue) };
  });
}

async function captureTeamDetail(page, teamNumber) {
  await page.click('[data-view="teams"]');
  await page.waitForSelector(".team-card");
  await page.locator(`[data-team="${teamNumber}"]`).first().click();
  await page.waitForSelector("#teamSelect");
  const title = text(await page.locator(".card h2").first().textContent());
  const stats = await page.locator(".stat-grid .stat").allTextContents();
  const backLabel = text(await page.locator('[data-history-back]').first().textContent());
  return { title, stats: stats.map(text), backLabel };
}

async function captureFirstTeamDetail(page) {
  await page.click('[data-view="teams"]');
  await page.waitForSelector(".team-card");
  const firstTeamNumber = await page.locator(".team-card").first().getAttribute("data-team");
  await page.locator(".team-card").first().click();
  await page.waitForSelector("#teamSelect");
  const title = text(await page.locator(".card h2").first().textContent());
  const stats = await page.locator(".stat-grid .stat").allTextContents();
  return { teamNumber: Number(firstTeamNumber), title, stats: stats.map(text) };
}

async function captureSpecificTeamTrend(page, teamNumber) {
  await page.click('[data-view="teams"]');
  await page.waitForSelector(".team-card");
  await page.locator(`[data-team="${teamNumber}"]`).first().click();
  await page.waitForSelector("#teamSelect");
  const selectedMetric = await page.locator("#teamDetailMetricSelect").inputValue();
  const selectedMetricLabel = text(await page.locator("#teamDetailMetricSelect").locator("option:checked").textContent());
  const pointTitles = await page.locator(".trend-chart circle title").allTextContents();
  return {
    teamNumber,
    selectedMetric,
    selectedMetricLabel,
    firstPoints: pointTitles.slice(0, 6).map(text),
  };
}

async function verifyBack(page) {
  await page.click('[data-history-back]');
  await page.waitForTimeout(500);
  return text(await page.locator(".team-title-row h2").textContent());
}

async function captureAnalysis(page) {
  await page.click('[data-view="analysis"]');
  await page.waitForTimeout(700);
  return {
    heading: text(await page.locator(".toolbar label").first().textContent()),
    rows: await page.locator(".chart-row").count(),
    firstRow: text(await page.locator(".chart-row").first().textContent()),
  };
}

async function createDerivedMetric(page) {
  await page.click('[data-view="derivedBuilder"]');
  await page.waitForSelector("#derivedMetricIdInput");
  await page.selectOption("#derivedMetricPresetSelect", "average_per_match");
  await page.click("#applyDerivedMetricPresetButton");
  await page.waitForTimeout(300);
  await page.fill("#derivedMetricLabelInput", "Codex Cycle + Endgame Average");
  await page.selectOption("#derivedMetricNumeratorFieldsSelect", ["cycle", "endgame"]);
  await page.click("#saveDerivedMetricButton");
  await page.waitForTimeout(700);
  return {
    presetValue: await page.locator("#derivedMetricPresetSelect").inputValue(),
    idValue: await page.locator("#derivedMetricIdInput").inputValue(),
    previewAll: text(await page.locator(".stat-grid .stat").nth(4).textContent()),
    previewRecent: text(await page.locator(".stat-grid .stat").nth(5).textContent()),
    configText: await page.locator(".admin-textarea").inputValue(),
  };
}

async function createWeightedMatrixMetric(page) {
  await page.click('[data-view="scoringMatrixBuilder"]');
  await page.waitForSelector("#scoringTableProfileSelect");
  await page.selectOption("#scoringTableProfileSelect", "match-current-v2");
  await page.fill('[data-scoring-field="autoTroughMade"]', "3");
  await page.fill('[data-scoring-field="autoL2Made"]', "4");
  await page.fill('[data-scoring-field="autoL3Made"]', "6");
  await page.fill('[data-scoring-field="autoL4Made"]', "7");
  await page.fill('[data-scoring-field="autoProcessorMade"]', "6");
  await page.fill('[data-scoring-field="autoBargeMade"]', "4");
  await page.fill('[data-scoring-field="teleTroughMade"]', "2");
  await page.fill('[data-scoring-field="teleL2Made"]', "3");
  await page.fill('[data-scoring-field="teleL3Made"]', "4");
  await page.fill('[data-scoring-field="teleL4Made"]', "5");
  await page.fill('[data-scoring-field="teleProcessorMade"]', "6");
  await page.fill('[data-scoring-field="teleBargeMade"]', "4");
  await page.waitForTimeout(700);
  const configText = await page.evaluate(() => localStorage.getItem("frc-scouting-custom-derived-metric-config") || "");
  return {
    pageTitle: text(await page.locator(".page-title h1").textContent()),
    profileValue: await page.locator("#scoringTableProfileSelect").inputValue(),
    weightedFieldCount: (configText.match(/"field":/g) || []).length,
    firstWeight: await page.locator('[data-scoring-field="autoTroughMade"]').inputValue(),
    hasTemplateSelector: await page.locator("#derivedMetricTemplateSelect").count(),
    configText,
  };
}

async function captureAccuracyPresetSuggestions(page) {
  await page.click('[data-view="derivedBuilder"]');
  await page.waitForSelector("#derivedMetricPresetSelect");
  await page.selectOption("#derivedMetricPresetSelect", "accuracy");
  await page.click("#applyDerivedMetricPresetButton");
  await page.waitForTimeout(300);
  return {
    madeCount: await page.locator("#derivedMetricMadeFieldsSelect option:checked").count(),
    missedCount: await page.locator("#derivedMetricMissedFieldsSelect option:checked").count(),
    idValue: await page.locator("#derivedMetricIdInput").inputValue(),
    labelValue: await page.locator("#derivedMetricLabelInput").inputValue(),
    status: text(await page.locator(".card .muted").last().textContent()),
  };
}

async function applyDerivedMetricConfig(page) {
  await page.click('[data-view="derivedBuilder"]');
  await page.waitForSelector("#derivedMetricConfigTextarea");
  const original = await page.locator("#derivedMetricConfigTextarea").inputValue();
  const updated = original.replaceAll("Codex Cycle + Endgame Average", "Codex Reloaded Metric");
  await page.fill("#derivedMetricConfigTextarea", updated);
  await page.click("#applyDerivedMetricConfigButton");
  await page.waitForTimeout(700);
  return {
    status: text(await page.locator(".card .muted").last().textContent()),
    configText: await page.locator("#derivedMetricConfigTextarea").inputValue(),
  };
}

async function rejectInvalidDerivedMetricConfig(page) {
  await page.click('[data-view="derivedBuilder"]');
  await page.waitForSelector("#derivedMetricConfigTextarea");
  const validText = await page.locator("#derivedMetricConfigTextarea").inputValue();
  const invalidText = validText.replaceAll('"cycle"', '"totallyFakeField"');
  await page.fill("#derivedMetricConfigTextarea", invalidText);
  await page.click("#applyDerivedMetricConfigButton");
  await page.waitForTimeout(700);
  return {
    status: text(await page.locator(".card .muted").last().textContent()),
    configText: await page.locator("#derivedMetricConfigTextarea").inputValue(),
  };
}

async function verifyDerivedMetricInTeamDetail(page, teamNumber, label) {
  await page.click('[data-view="teams"]');
  await page.waitForSelector(".team-card");
  await page.locator(`[data-team="${teamNumber}"]`).first().click();
  await page.waitForSelector("#teamSelect");
  const labels = await page.locator("#teamDetailMetricSelect option").allTextContents();
  return labels.map(text).includes(label);
}

async function verifyBoardClear(page, teamNumber) {
  await page.click('[data-view="alliance"]');
  await page.waitForTimeout(700);
  const firstInput = page.locator('[data-board-input="0"]');
  await firstInput.fill(String(teamNumber));
  await firstInput.press("Enter");
  await page.waitForTimeout(500);
  const before = text(await page.locator('[data-board-cell="0"]').textContent());
  await page.click("#clearAllianceBoardButton");
  await page.waitForTimeout(500);
  const after = text(await page.locator('[data-board-cell="0"]').textContent());
  return { before, after };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));

const result = { appUrl, pageErrors };

try {
  await page.goto(appUrl);
  await waitForBody(page);
  result.loginBefore = text(await page.locator("body").textContent()).slice(0, 180);

  await login(page);
  result.loginAfter = text(await page.locator(".page-title h1").textContent());

  await openAdmin(page);
  await switchEvent(page, "2026chcmp");
  result.import2026 = await importCurrentSheet(page);
  await commitImport(page);
  result.storage2026 = await storageSnapshot(page);
  result.derivedBuilderAccuracyPreset2026 = await captureAccuracyPresetSuggestions(page);
  result.derivedBuilder2026 = await createDerivedMetric(page);
  result.teamDetailHasCustomMetric2026 = await verifyDerivedMetricInTeamDetail(page, 346, "Codex Cycle + Endgame Average");
  result.derivedBuilderConfigApply2026 = await applyDerivedMetricConfig(page);
  result.teamDetailHasAppliedCustomMetric2026 = await verifyDerivedMetricInTeamDetail(page, 346, "Codex Reloaded Metric");
  result.derivedBuilderInvalidConfig2026 = await rejectInvalidDerivedMetricConfig(page);
  result.teamDetailStillHasAppliedCustomMetric2026 = await verifyDerivedMetricInTeamDetail(page, 346, "Codex Reloaded Metric");

  result.teamDetail2026 = await captureTeamDetail(page, 346);
  result.backDestination = await verifyBack(page);
  result.analysis2026 = await captureAnalysis(page);
  result.board2026 = await verifyBoardClear(page, 346);

  await page.reload();
  await waitForBody(page);
  result.storage2026AfterReload = await storageSnapshot(page);
  result.teamDetail2026AfterReload = await captureTeamDetail(page, 346);
  result.analysis2026AfterReload = await captureAnalysis(page);

  await openAdmin(page);
  await switchEvent(page, "2024mdsev");
  result.import2024 = await importCurrentSheet(page);
  await commitImport(page);
  result.storage2024 = await storageSnapshot(page);
  result.teamDetail2024 = await captureFirstTeamDetail(page);
  result.analysis2024 = await captureAnalysis(page);

  await openAdmin(page);
  await switchEvent(page, "2025chcmp");
  result.import2025 = await importCurrentSheet(page);
  await commitImport(page);
  result.storage2025 = await storageSnapshot(page);
  result.derivedBuilderAccuracyPreset2025 = await captureAccuracyPresetSuggestions(page);
  result.derivedBuilderWeightedPreset2025 = await createWeightedMatrixMetric(page);
  result.teamDetail2025 = await captureFirstTeamDetail(page);
  result.team422Trend2025 = await captureSpecificTeamTrend(page, 422);
  result.analysis2025 = await captureAnalysis(page);
  result.legacy2025Setup = await simulateLegacyOnlyStorage(page);
  await page.reload();
  await waitForBody(page);
  result.storage2025LegacyReload = await storageSnapshot(page);
  result.teamDetail2025LegacyReload = await captureFirstTeamDetail(page);
  result.analysis2025LegacyReload = await captureAnalysis(page);
} finally {
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
