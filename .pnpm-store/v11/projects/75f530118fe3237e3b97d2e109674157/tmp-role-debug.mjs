import { chromium } from "./node_modules/playwright/index.mjs";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("file:///D:/FIRST/Scouting/Scouting-Analysis/index.html");
await page.waitForLoadState("load");
await page.waitForTimeout(1000);
const existingUser = page.locator("#existingUser");
if (await existingUser.count()) { await existingUser.selectOption("Avery"); await page.locator("#loginButton").click(); await page.waitForSelector('[data-view="teams"]'); }
await page.locator('[data-view="admin"]').click();
await page.waitForSelector('#adminEventSelect');
await page.selectOption('#adminEventSelect', '2026chcmp');
await page.waitForTimeout(750);
const fs = await import('node:fs');
const rawSheetCsv = fs.readFileSync('src/real-source-cache/2026chcmp-sheet.csv', 'utf8');
await page.evaluate((csvText) => { const eventModel = currentEvent(); const adaptedCsv = sharedAdaptEventSheetCsv(eventModel, csvText); loadPreparedScoutingCsv(adaptedCsv, ""); }, rawSheetCsv);
await page.waitForTimeout(750);
if (await page.locator('#commitImportButton').isEnabled()) { await page.locator('#commitImportButton').click(); await page.waitForTimeout(1200); }
const result = await page.evaluate(() => {
  const team = 346;
  const matchNumber = 3;
  const context = buildTeamFormulaContext(team, currentEvent());
  const row = context.matchRows.find((entry) => entry.matchNumber === matchNumber);
  const identifiers = ['scouting.autoPrimaryRole','scouting.autoSecondaryRole','scouting.shift1PrimaryRole','scouting.shift1SecondaryRole','scouting.autoFuelPct'];
  const values = Object.fromEntries(identifiers.map((id) => [id, (() => {
    const r = resolveFormulaIdentifier(id, context, new Map(), [], new Map(), []);
    if (r?.kind === 'series') return r.entries.find((entry) => entry.key === matchNumber)?.value;
    return r?.value;
  })()]));
  const equations = ['autoPctShooting','shift1PctShooting'];
  const equationValues = Object.fromEntries(equations.map((id) => [id, (() => {
    const r = evaluateEquationForTeam(team, id, { formulaContext: context, eventModel: currentEvent(), evaluationCache: new Map(), filterEvaluationCache: new Map() }).result;
    if (r?.kind === 'series') return r.entries.find((entry) => entry.key === matchNumber)?.value;
    return r?.value;
  })()]));
  return {
    selectedSubmission: row.scouting?.selectedSubmission?.rawMetrics || null,
    firstSubmission: row.scouting?.submissions?.[0]?.rawMetrics || null,
    values,
    equationValues,
  };
});
console.log(JSON.stringify(result, null, 2));
await browser.close();
