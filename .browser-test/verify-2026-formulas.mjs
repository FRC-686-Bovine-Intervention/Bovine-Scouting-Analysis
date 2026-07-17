import fs from "node:fs";
import path from "node:path";
import { chromium } from "./node_modules/playwright/index.mjs";

const appUrl = "file:///D:/FIRST/Scouting/Scouting-Analysis/index.html";
const expectedCsvPath = path.resolve("tmp-matchcalculations.csv");
const rawSheetCsvPath = path.resolve("src/real-source-cache/2026chcmp-sheet.csv");

function text(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function parseCsv(textValue) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;
  const source = String(textValue || "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        value += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }
    value += char;
  }
  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows.map((cells) => cells.map((cell) => String(cell ?? "").trim()));
}

function toObjects(rows) {
  const headerIndex = rows.findIndex((row) => String(row[0] || "").trim() === "Match Number");
  if (headerIndex < 0) throw new Error("Could not find MatchCalculations header row.");
  const headers = rows[headerIndex];
  return rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? "").trim()])));
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
  await page.waitForSelector("#adminEventCodeInput");
}

async function switchEvent(page, eventKey) {
  await page.fill("#adminEventCodeInput", eventKey);
  await page.locator("#adminEventCodeInput").press("Enter");
  await page.waitForTimeout(750);
}

async function importRawSheet(page, rawSheetCsv) {
  await page.evaluate((csvText) => {
    const eventModel = currentEvent();
    const adaptedCsv = sharedAdaptEventSheetCsv(eventModel, csvText);
    loadPreparedScoutingCsv(adaptedCsv, "");
    commitImportPreview();
  }, rawSheetCsv);
  await page.waitForTimeout(750);
  await page.waitForTimeout(750);
}

const expectedRows = toObjects(parseCsv(fs.readFileSync(expectedCsvPath, "utf8")));
const rawSheetCsv = fs.readFileSync(rawSheetCsvPath, "utf8");

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
  await importRawSheet(page, rawSheetCsv);

  result.verification = await page.evaluate((rows) => {
    function parsePercent(textValue) {
      const normalized = String(textValue || "").trim();
      if (!normalized) return null;
      return Number(normalized.replace(/%$/, "")) / 100;
    }

    function parseNumber(textValue) {
      const normalized = String(textValue || "").trim();
      if (!normalized) return null;
      const numeric = Number(normalized);
      return Number.isFinite(numeric) ? numeric : null;
    }

    function parseBoolean(textValue) {
      const normalized = String(textValue || "").trim().toUpperCase();
      if (!normalized) return null;
      if (normalized === "TRUE") return 1;
      if (normalized === "FALSE") return 0;
      return null;
    }

    function expectedValue(row, mode, column) {
      if (mode === "string") return String(row[column] || "");
      if (mode === "number") return parseNumber(row[column]);
      if (mode === "percent") return parsePercent(row[column]);
      if (mode === "boolean") return parseBoolean(row[column]);
      return null;
    }

    function actualValueFromSeries(resultValue, matchNumber) {
      if (!resultValue) return null;
      if (resultValue.kind === "series") {
        const entry = (resultValue.entries || []).find((item) => item.key === matchNumber);
        return entry ? entry.value : null;
      }
      return resultValue.value;
    }

    function actualValueFromIdentifier(resultValue, matchNumber) {
      return actualValueFromSeries(resultValue, matchNumber);
    }

    function valuesMatch(actual, expected, mode) {
      if (mode === "string") return String(actual || "") === String(expected || "");
      if (expected === null) return actual === null || actual === undefined || Number.isNaN(Number(actual));
      const actualNumber = Number(actual);
      if (!Number.isFinite(actualNumber)) return false;
      const tolerance = mode === "percent" ? 0.005 : 0.02;
      return Math.abs(actualNumber - expected) <= tolerance;
    }

    const expectedMap = new Map(rows.map((row) => [`${row.Team}:${row["Match Number"]}`, row]));
    const checks = [
      { kind: "identifier", id: "scouting.hasEntry", column: "Has Entry", mode: "number" },
      { kind: "filter", id: "hasEntry", column: "Has Entry", mode: "number" },
      { kind: "identifier", id: "scouting.autoPrimaryRole", column: "Auto Primary Role", mode: "string" },
      { kind: "identifier", id: "scouting.autoSecondaryRole", column: "Auto Secondary Role", mode: "string" },
      { kind: "identifier", id: "scouting.autoFuelPct", column: "Auto Fuel %", mode: "number" },
      { kind: "equation", id: "autoFuelShare", column: "Auto Fuel %", mode: "percent" },
      { kind: "equation", id: "autoFuelShareAlliance", column: "Auto Fuel % Alliance", mode: "percent" },
      { kind: "equation", id: "autoFuelTeam", column: "Auto Fuel Team", mode: "number" },
      { kind: "equation", id: "autoPctShooting", column: "Auto % Shooting", mode: "percent" },
      { kind: "equation", id: "autoMaxFuelPossible", column: "Auto Max Fuel Possible", mode: "number" },
      { kind: "equation", id: "transitionFuelShare", column: "Transition Fuel %", mode: "percent" },
      { kind: "equation", id: "transitionFuelShareAlliance", column: "Transition Fuel % Alliance", mode: "percent" },
      { kind: "equation", id: "transitionFuelTeam", column: "Transition Fuel Team", mode: "number" },
      { kind: "equation", id: "transitionPctShooting", column: "Transition % Shooting", mode: "percent" },
      { kind: "equation", id: "transitionMaxFuelPossible", column: "Transition Max Fuel Possible", mode: "number" },
      { kind: "equation", id: "shift1FuelShare", column: "Shift 1 Fuel %", mode: "percent" },
      { kind: "equation", id: "shift1FuelShareAlliance", column: "Shift 1 Fuel % Alliance", mode: "percent" },
      { kind: "equation", id: "shift1FuelTeam", column: "Shift 1 Fuel Team", mode: "number" },
      { kind: "equation", id: "shift1PctShooting", column: "Shift 1 % Shooting", mode: "percent" },
      { kind: "equation", id: "shift1MaxFuelPossible", column: "Shift 1 Max Fuel Possible", mode: "number" },
      { kind: "equation", id: "shift2FuelShare", column: "Shift 2 Fuel %", mode: "percent" },
      { kind: "equation", id: "shift2FuelShareAlliance", column: "Shift 2 Fuel % Alliance", mode: "percent" },
      { kind: "equation", id: "shift2FuelTeam", column: "Shift 2 Fuel Team", mode: "number" },
      { kind: "equation", id: "shift2PctShooting", column: "Shift 2 % Shooting", mode: "percent" },
      { kind: "equation", id: "shift2MaxFuelPossible", column: "Shift 2 Max Fuel Possible", mode: "number" },
      { kind: "equation", id: "shift3FuelShare", column: "Shift 3 Fuel %", mode: "percent" },
      { kind: "equation", id: "shift3FuelShareAlliance", column: "Shift 3 Fuel % Alliance", mode: "percent" },
      { kind: "equation", id: "shift3FuelTeam", column: "Shift 3 Fuel Team", mode: "number" },
      { kind: "equation", id: "shift3PctShooting", column: "Shift 3 % Shooting", mode: "percent" },
      { kind: "equation", id: "shift3MaxFuelPossible", column: "Shift 3 Max Fuel Possible", mode: "number" },
      { kind: "equation", id: "shift4FuelShare", column: "Shift 4 Fuel %", mode: "percent" },
      { kind: "equation", id: "shift4FuelShareAlliance", column: "Shift 4 Fuel % Alliance", mode: "percent" },
      { kind: "equation", id: "shift4FuelTeam", column: "Shift 4 Fuel Team", mode: "number" },
      { kind: "equation", id: "shift4PctShooting", column: "Shift 4 % Shooting", mode: "percent" },
      { kind: "equation", id: "shift4MaxFuelPossible", column: "Shift 4 Max Fuel Possible", mode: "number" },
      { kind: "equation", id: "endgameFuelShare", column: "Endgame Fuel %", mode: "percent" },
      { kind: "equation", id: "endgameFuelShareAlliance", column: "Endgame Fuel % Alliance", mode: "percent" },
      { kind: "equation", id: "endgameFuelTeam", column: "Endgame Fuel Team", mode: "number" },
      { kind: "equation", id: "endgamePctShooting", column: "Endgame % Shooting", mode: "percent" },
      { kind: "equation", id: "endgameMaxFuelPossible", column: "Endgame Max Fuel Possible", mode: "number" },
      { kind: "equation", id: "teleopMaxFuelPossible", column: "Tele-Op Max Fuel Possible", mode: "number" },
      { kind: "equation", id: "totalFuelScored", column: "Total Fuel Scored", mode: "number" },
    ];

    const mismatches = [];
    const comparisons = [];
    const eventModel = currentEvent();

    (eventModel.teams || []).forEach((team) => {
      const context = buildTeamFormulaContext(team.number, eventModel);
      const equationEvaluationCache = new Map();
      const filterEvaluationCache = new Map();
      const identifierResultCache = new Map();
      const equationResultCache = new Map();
      const filterResultCache = new Map();
      (context.matchRows || []).forEach((matchRow) => {
        const expectedRow = expectedMap.get(`${team.number}:${matchRow.matchNumber}`);
        if (!expectedRow) return;
        checks.forEach((check) => {
          const expected = expectedValue(expectedRow, check.mode, check.column);
          let actual = null;
          if (check.kind === "identifier") {
            if (!identifierResultCache.has(check.id)) {
              identifierResultCache.set(check.id, resolveFormulaIdentifier(check.id, context, equationEvaluationCache, [], filterEvaluationCache, []));
            }
            actual = actualValueFromIdentifier(identifierResultCache.get(check.id), matchRow.matchNumber);
          }
          if (check.kind === "equation") {
            if (!equationResultCache.has(check.id)) {
              const evaluation = evaluateEquationForTeam(team.number, check.id, {
                formulaContext: context,
                eventModel,
                evaluationCache: equationEvaluationCache,
                filterEvaluationCache,
              });
              equationResultCache.set(check.id, evaluation.result);
            }
            actual = actualValueFromSeries(equationResultCache.get(check.id), matchRow.matchNumber);
          }
          if (check.kind === "filter") {
            if (!filterResultCache.has(check.id)) {
              const evaluation = evaluateSeasonFilterForTeam(team.number, check.id, {
                formulaContext: context,
                eventModel,
                evaluationCache: filterEvaluationCache,
                equationEvaluationCache,
              });
              filterResultCache.set(check.id, evaluation.result);
            }
            actual = actualValueFromSeries(filterResultCache.get(check.id), matchRow.matchNumber);
          }
          comparisons.push(check.id);
          if (!valuesMatch(actual, expected, check.mode)) {
            mismatches.push({
              kind: check.kind,
              id: check.id,
              column: check.column,
              teamNumber: team.number,
              matchNumber: matchRow.matchNumber,
              actual,
              expected,
            });
          }
        });
      });
    });

    const appState = globalThis.__scoutingAppState;
    const equationTimings = (appState?.seasonDerivedEquationCatalog?.seasons?.["2026"] || []).map((definition) => {
      const start = performance.now();
      appState.activeView = "derivedBuilder";
      appState.activeDerivedEquationId = definition.id;
      render();
      return { id: definition.id, name: definition.name, ms: Number((performance.now() - start).toFixed(1)) };
    });
    return {
      comparedChecks: [...new Set(comparisons)].length,
      mismatchCount: mismatches.length,
      mismatches: mismatches.slice(0, 100),
      equationTimings,
      filterTimings: [],
      globals: {
        buildTeamFormulaContext: typeof buildTeamFormulaContext,
        evaluateEquationForTeam: typeof evaluateEquationForTeam,
        evaluateSeasonFilterForTeam: typeof evaluateSeasonFilterForTeam,
        resolveFormulaIdentifier: typeof resolveFormulaIdentifier,
        render: typeof render,
      },
    };
  }, expectedRows);
} finally {
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
