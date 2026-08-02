import { chromium } from "playwright";

const appUrl = "file:///D:/FIRST/Scouting/Bovine-Scouting-Analysis/index.html";

function text(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
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
    await page.locator("#loginButton").click();
    await page.waitForSelector('[data-view="teams"]');
    return;
  }
  await page.waitForSelector('[data-view="teams"]');
}

async function openAdmin(page) {
  await page.locator('[data-view="admin"]').click();
  await page.waitForSelector("#adminEventSelect");
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));

await page.addInitScript(() => {
  const routes = {
    "https://www.thebluealliance.com/api/v3/event/2026unit": { key: "2026unit", year: 2026, name: "Unit Test Event" },
    "https://www.thebluealliance.com/api/v3/event/2026unit/teams": [
      { team_number: 111, nickname: "Alpha" },
      { team_number: 222, nickname: "Beta" },
      { team_number: 333, nickname: "Gamma" },
      { team_number: 444, nickname: "Delta" },
      { team_number: 555, nickname: "Epsilon" },
      { team_number: 666, nickname: "Zeta" },
    ],
    "https://www.thebluealliance.com/api/v3/event/2026unit/matches": [
      {
        comp_level: "qm",
        match_number: 1,
        set_number: 1,
        winning_alliance: "red",
        alliances: {
          red: { team_keys: ["frc111", "frc222", "frc333"], score: 180 },
          blue: { team_keys: ["frc444", "frc555", "frc666"], score: 150 },
        },
      },
    ],
    "https://api.statbotics.io/v3/event/2026unit": { year: 2026, status: "In Progress" },
    "https://api.statbotics.io/v3/team_events/event/2026unit": [
      {
        team: 111,
        epa: {
          total_points: 42.5,
          breakdown: { auto_points: 10, teleop_points: 20, endgame_points: 12.5 },
          stats: { mean: 41, start: 39, pre_elim: 43, max: 48 },
        },
        record: { qual: { count: 12, rank: 4, rps_per_match: 2.8 } },
      },
      {
        team: 222,
        epa: {
          total_points: 38.2,
          breakdown: { auto_points: 9, teleop_points: 18, endgame_points: 11.2 },
          stats: { mean: 37, start: 35, pre_elim: 39, max: 43 },
        },
        record: { qual: { count: 12, rank: 10, rps_per_match: 2.1 } },
      },
      {
        team: 333,
        epa: {
          total_points: 36.8,
          breakdown: { auto_points: 8, teleop_points: 17, endgame_points: 11.8 },
          stats: { mean: 36, start: 34, pre_elim: 37, max: 40 },
        },
        record: { qual: { count: 12, rank: 12, rps_per_match: 2.0 } },
      },
      {
        team: 444,
        epa: {
          total_points: 31.5,
          breakdown: { auto_points: 7, teleop_points: 15, endgame_points: 9.5 },
          stats: { mean: 31, start: 30, pre_elim: 32, max: 34 },
        },
        record: { qual: { count: 12, rank: 18, rps_per_match: 1.8 } },
      },
      {
        team: 555,
        epa: {
          total_points: 28.1,
          breakdown: { auto_points: 6, teleop_points: 13, endgame_points: 9.1 },
          stats: { mean: 28, start: 27, pre_elim: 29, max: 31 },
        },
        record: { qual: { count: 12, rank: 22, rps_per_match: 1.6 } },
      },
      {
        team: 666,
        epa: {
          total_points: 26.9,
          breakdown: { auto_points: 5, teleop_points: 13, endgame_points: 8.9 },
          stats: { mean: 27, start: 26, pre_elim: 27.5, max: 29 },
        },
        record: { qual: { count: 12, rank: 24, rps_per_match: 1.5 } },
      },
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

  await page.locator("#adminEventCodeInput").fill("2026unit");
  await page.locator("#lookupEventCodeButton").click();
  await page.waitForFunction(() => globalThis.__scoutingAppState?.activeEventKey === "2026unit");
  await page.waitForTimeout(750);

  result.workspaceState = await page.evaluate(() => {
    const appState = globalThis.__scoutingAppState;
    return {
      activeEventKey: appState?.activeEventKey,
      eventLookupResult: appState?.eventLookupResult,
      pridgeSource: appState?.eventWorkspace?.sources?.pridge || null,
    };
  });

  result.dataSources = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".data-source-row")).map((row) => ({
      name: row.querySelector("strong")?.textContent?.trim() || "",
      notes: row.querySelector("div > .muted")?.textContent || "",
      status: row.querySelector(".source-status")?.textContent || "",
      freshness: row.querySelector(".source-status-stack .muted")?.textContent || "",
    }));
  });
  result.dataSources = result.dataSources.map((entry) => ({
    ...entry,
    notes: text(entry.notes),
    status: text(entry.status),
    freshness: text(entry.freshness),
  }));

  const pridgeRow = result.dataSources.find((entry) => entry.name === "pRidge");
  assert(result.workspaceState.activeEventKey === "2026unit", `Expected active event to switch to 2026unit. Got: ${JSON.stringify(result.workspaceState)}`);
  assert(result.workspaceState.pridgeSource?.status === "ready", `Expected pRidge source status ready. Got: ${JSON.stringify(result.workspaceState.pridgeSource)}`);
  assert(result.workspaceState.pridgeSource?.provenance?.mode === "native-compute", `Expected native-compute provenance. Got: ${JSON.stringify(result.workspaceState.pridgeSource)}`);
  assert(result.workspaceState.pridgeSource?.provenance?.eventKey === "2026unit", `Expected pRidge provenance event key. Got: ${JSON.stringify(result.workspaceState.pridgeSource)}`);
  assert(String(result.workspaceState.pridgeSource?.provenance?.inputFingerprints?.tba || "").startsWith("fnv1a:"), `Expected TBA input fingerprint. Got: ${JSON.stringify(result.workspaceState.pridgeSource)}`);
  assert(String(result.workspaceState.pridgeSource?.provenance?.inputFingerprints?.statbotics || "").startsWith("fnv1a:"), `Expected Statbotics input fingerprint. Got: ${JSON.stringify(result.workspaceState.pridgeSource)}`);
  assert(String(result.workspaceState.pridgeSource?.sourceFingerprint || "").startsWith("fnv1a:"), `Expected pRidge workspace fingerprint. Got: ${JSON.stringify(result.workspaceState.pridgeSource)}`);
  assert(pridgeRow?.status === "ready", `Expected pRidge data source row to show ready. Got: ${JSON.stringify(result.dataSources)}`);
  assert(/computed locally/i.test(pridgeRow?.notes || ""), `Expected pRidge row to mention native compute. Got: ${JSON.stringify(pridgeRow)}`);
} finally {
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
