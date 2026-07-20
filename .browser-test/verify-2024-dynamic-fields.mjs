import { chromium } from "playwright";

const appUrl = "file:///D:/FIRST/Scouting/Scouting-Analysis/index.html";

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
    await page.locator("#loginButton").click();
    await page.waitForSelector('[data-view="teams"]');
  }
}

async function openAdmin(page) {
  await page.locator('[data-view="admin"]').click();
  await page.waitForSelector("#adminEventCodeInput");
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));

await page.addInitScript(() => {
  const routes = {
    "https://www.thebluealliance.com/api/v3/event/2024unit": { key: "2024unit", year: 2024, name: "2024 Unit Event" },
    "https://www.thebluealliance.com/api/v3/event/2024unit/teams": [
      { team_number: 111, nickname: "Alpha" },
      { team_number: 222, nickname: "Beta" },
      { team_number: 333, nickname: "Gamma" },
      { team_number: 444, nickname: "Delta" },
      { team_number: 555, nickname: "Epsilon" },
      { team_number: 666, nickname: "Zeta" },
    ],
    "https://www.thebluealliance.com/api/v3/event/2024unit/matches": [
      {
        comp_level: "qm",
        match_number: 1,
        set_number: 1,
        winning_alliance: "red",
        alliances: {
          red: { team_keys: ["frc111", "frc222", "frc333"], score: 120 },
          blue: { team_keys: ["frc444", "frc555", "frc666"], score: 105 },
        },
        score_breakdown: {
          red: { autoPoints: 25, endGameRobot1: "CenterStage", endGameRobot2: "None", endGameRobot3: "Parked", endGameHarmonyPoints: 2 },
          blue: { autoPoints: 12, endGameRobot1: "None", endGameRobot2: "Parked", endGameRobot3: "Parked", endGameHarmonyPoints: 0 },
        },
      },
      {
        comp_level: "qm",
        match_number: 2,
        set_number: 1,
        winning_alliance: "blue",
        alliances: {
          red: { team_keys: ["frc111", "frc444", "frc555"], score: 90 },
          blue: { team_keys: ["frc222", "frc333", "frc666"], score: 118 },
        },
        score_breakdown: {
          red: { autoPoints: 8, endGameRobot1: "Parked", endGameRobot2: "None", endGameRobot3: "None", endGameHarmonyPoints: 0 },
          blue: { autoPoints: 20, endGameRobot1: "CenterStage", endGameRobot2: "Parked", endGameRobot3: "None", endGameHarmonyPoints: 2 },
        },
      },
    ],
    "https://www.thebluealliance.com/api/v3/event/2024unit/rankings": {
      rankings: [
        { team_key: "frc222", rank: 1, sort_orders: [3], record: { wins: 2, losses: 0, ties: 0 }, dq: 0, matches_played: 2, extra_stats: [], qual_average: null },
        { team_key: "frc111", rank: 2, sort_orders: [2], record: { wins: 1, losses: 1, ties: 0 }, dq: 0, matches_played: 2, extra_stats: [], qual_average: null },
      ],
      sort_order_info: [],
      extra_stats_info: [],
    },
    "https://www.thebluealliance.com/api/v3/event/2024unit/oprs": {
      oprs: { frc111: 44.4, frc222: 55.5, frc333: 50.1, frc444: 39.9, frc555: 38.2, frc666: 47.7 },
      dprs: {},
      ccwms: {},
    },
    "https://api.statbotics.io/v3/event/2024unit": { year: 2024, status: "In Progress" },
    "https://api.statbotics.io/v3/team_events/event/2024unit": [
      { team: 111, epa: { total_points: 40, breakdown: { auto_points: 8, speaker_points: 20, amplified_notes: 8, endgame_trap_points: 4 }, stats: { mean: 40, start: 39, pre_elim: 41, max: 44 } }, record: { qual: { count: 2, rank: 2, rps_per_match: 2 } } },
      { team: 222, epa: { total_points: 48, breakdown: { auto_points: 10, speaker_points: 24, amplified_notes: 10, endgame_trap_points: 4 }, stats: { mean: 48, start: 47, pre_elim: 49, max: 52 } }, record: { qual: { count: 2, rank: 1, rps_per_match: 3 } } },
      { team: 333, epa: { total_points: 43, breakdown: { auto_points: 9, speaker_points: 22, amplified_notes: 8, endgame_trap_points: 4 }, stats: { mean: 43, start: 42, pre_elim: 44, max: 46 } }, record: { qual: { count: 2, rank: 3, rps_per_match: 2 } } },
      { team: 444, epa: { total_points: 36, breakdown: { auto_points: 7, speaker_points: 18, amplified_notes: 7, endgame_trap_points: 4 }, stats: { mean: 36, start: 35, pre_elim: 36, max: 38 } }, record: { qual: { count: 2, rank: 4, rps_per_match: 1 } } },
      { team: 555, epa: { total_points: 34, breakdown: { auto_points: 6, speaker_points: 17, amplified_notes: 7, endgame_trap_points: 4 }, stats: { mean: 34, start: 33, pre_elim: 34, max: 36 } }, record: { qual: { count: 2, rank: 5, rps_per_match: 1 } } },
      { team: 666, epa: { total_points: 41, breakdown: { auto_points: 8, speaker_points: 21, amplified_notes: 8, endgame_trap_points: 4 }, stats: { mean: 41, start: 40, pre_elim: 42, max: 45 } }, record: { qual: { count: 2, rank: 6, rps_per_match: 2 } } },
    ],
  };
  globalThis.__TBA_AUTH_KEY = "browser-test-key";
  globalThis.fetch = async (input) => {
    const url = typeof input === "string" ? input : String(input?.url || "");
    if (!(url in routes)) {
      return new Response(JSON.stringify({ error: "Not found", url }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(routes[url]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
});

const result = { pageErrors };

try {
  await page.goto(appUrl);
  await waitForApp(page);
  await login(page);
  await openAdmin(page);

  await page.locator("#adminEventCodeInput").fill("2024unit");
  await page.locator("#adminEventCodeInput").press("Enter");
  await page.waitForFunction(() => globalThis.__scoutingAppState?.activeEventKey === "2024unit");
  await page.waitForTimeout(750);

  result.verification = await page.evaluate(() => {
    const eventModel = currentEvent();
    const team111 = currentTeams().find((team) => team.number === 111);
    const team222 = currentTeams().find((team) => team.number === 222);
    const oprMetric = metricById("source:opr:total");
    const epaMetric = metricById("source:epa:epa.total_points");
    const availableIdentifiers = currentAvailableTbaFormulaIdentifiers(eventModel);
    const availableStatboticsIdentifiers = currentAvailableStatboticsFormulaIdentifiers(eventModel);
    const availableMetrics = currentDerivedAvailableMetrics(eventModel).map((entry) => entry.id);
    const team111TbaRows = tbaMatchMetricsByTeam(111, eventModel);
    return {
      season: eventModel.season,
      availableIdentifiers,
      availableStatboticsIdentifiers,
      availableMetrics,
      team111Opr: teamMetricValue(team111, oprMetric),
      team111EpaTrend: metricTrendValues(team111, epaMetric),
      team111OprTrend: metricTrendValues(team111, oprMetric),
      team111TbaFieldNames: Object.keys(team111TbaRows[0] || {}),
      team111AutoPoints: team111TbaRows.map((entry) => entry.autoPoints),
      team111Harmony: team111TbaRows.map((entry) => entry.endGameHarmonyPoints),
      rank222: team222.eventRank,
    };
  });

  assert(result.verification.season === 2024, `Expected 2024 event model. Got ${JSON.stringify(result.verification)}`);
  assert(result.verification.team111Opr === 44.4, `Expected real OPR total for team 111. Got ${JSON.stringify(result.verification)}`);
  assert(Array.isArray(result.verification.team111EpaTrend) && result.verification.team111EpaTrend.length === 0, `Expected no synthetic EPA trend. Got ${JSON.stringify(result.verification)}`);
  assert(Array.isArray(result.verification.team111OprTrend) && result.verification.team111OprTrend.length === 0, `Expected no synthetic OPR trend. Got ${JSON.stringify(result.verification)}`);
  assert(result.verification.rank222 === 1, `Expected ranking import to reach app state. Got ${JSON.stringify(result.verification)}`);
  assert(result.verification.availableIdentifiers.includes("tba.autoPoints"), `Expected raw tba.autoPoints for 2024. Got ${JSON.stringify(result.verification.availableIdentifiers)}`);
  assert(result.verification.availableIdentifiers.includes("tba.endGameHarmonyPoints"), `Expected raw tba.endGameHarmonyPoints for 2024. Got ${JSON.stringify(result.verification.availableIdentifiers)}`);
  assert(result.verification.availableIdentifiers.includes("tba.sort_orders.0"), `Expected raw tba.sort_orders.0 for 2024 rankings data. Got ${JSON.stringify(result.verification.availableIdentifiers)}`);
  assert(!result.verification.availableIdentifiers.includes("tba.wonAuto"), `Did not expect synthetic tba.wonAuto for 2024. Got ${JSON.stringify(result.verification.availableIdentifiers)}`);
  assert(!result.verification.availableIdentifiers.includes("tba.climbScore"), `Did not expect synthetic tba.climbScore for 2024. Got ${JSON.stringify(result.verification.availableIdentifiers)}`);
  assert(!result.verification.availableIdentifiers.includes("tba.shift1AllianceFuel"), `Did not expect synthetic 2026 alias field in 2024. Got ${JSON.stringify(result.verification.availableIdentifiers)}`);
  assert(result.verification.availableStatboticsIdentifiers.includes("statbotics.epa.total_points"), `Expected raw Statbotics total_points identifier. Got ${JSON.stringify(result.verification.availableStatboticsIdentifiers)}`);
  assert(result.verification.availableStatboticsIdentifiers.includes("statbotics.epa.breakdown.auto_points"), `Expected raw Statbotics auto_points identifier. Got ${JSON.stringify(result.verification.availableStatboticsIdentifiers)}`);
  assert(result.verification.availableStatboticsIdentifiers.includes("statbotics.record.qual.rps_per_match"), `Expected raw Statbotics rps_per_match identifier. Got ${JSON.stringify(result.verification.availableStatboticsIdentifiers)}`);
  assert(!result.verification.availableStatboticsIdentifiers.includes("statbotics.auto"), `Did not expect season-shaped Statbotics alias field in 2024. Got ${JSON.stringify(result.verification.availableStatboticsIdentifiers)}`);
  assert(result.verification.availableMetrics.includes("tba.opr.total"), `Expected tba.opr.total in derived metrics. Got ${JSON.stringify(result.verification.availableMetrics)}`);
  assert(result.verification.availableMetrics.includes("statbotics.epa.total_points"), `Expected raw Statbotics total_points in derived metrics. Got ${JSON.stringify(result.verification.availableMetrics)}`);
  assert(result.verification.team111TbaFieldNames.includes("autoPoints"), `Expected raw autoPoints field on TBA rows. Got ${JSON.stringify(result.verification.team111TbaFieldNames)}`);
  assert(result.verification.team111TbaFieldNames.includes("endGameHarmonyPoints"), `Expected camelCased harmony field on TBA rows. Got ${JSON.stringify(result.verification.team111TbaFieldNames)}`);
  assert(!result.verification.team111TbaFieldNames.includes("wonAuto"), `Did not expect synthetic wonAuto field on TBA rows. Got ${JSON.stringify(result.verification.team111TbaFieldNames)}`);
  assert(!result.verification.team111TbaFieldNames.includes("climbScore"), `Did not expect synthetic climbScore field on TBA rows. Got ${JSON.stringify(result.verification.team111TbaFieldNames)}`);
  assert(result.verification.team111AutoPoints.includes(25) && result.verification.team111AutoPoints.includes(8), `Expected raw autoPoints values. Got ${JSON.stringify(result.verification.team111AutoPoints)}`);
  assert(result.verification.team111Harmony.includes(2) && result.verification.team111Harmony.includes(0), `Expected raw harmony values. Got ${JSON.stringify(result.verification.team111Harmony)}`);
} finally {
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
