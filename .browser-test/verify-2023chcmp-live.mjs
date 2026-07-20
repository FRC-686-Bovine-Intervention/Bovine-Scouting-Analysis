import { chromium } from "playwright";

const appUrl = "file:///D:/FIRST/Scouting/Scouting-Analysis/index.html";
const eventKey = "2023chcmp";
const tbaAuthKey = String(process.env.TBA_AUTH_KEY || "").trim();
const defaultStatboticsBaseUrl = "https://api.statbotics.io/v3";
const statboticsBaseUrl = String(process.env.STATBOTICS_BASE_URL || "").trim() || defaultStatboticsBaseUrl;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function scalarProviderValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number" || typeof value === "string") return value;
  return null;
}

function flattenProviderScalarEntries(value, prefix = "") {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => flattenProviderScalarEntries(entry, prefix ? `${prefix}.${index}` : String(index)));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, entryValue]) => {
      const segment = String(key || "").trim();
      if (!segment) return [];
      return flattenProviderScalarEntries(entryValue, prefix ? `${prefix}.${segment}` : segment);
    });
  }
  const scalar = scalarProviderValue(value);
  return prefix && scalar !== null ? [[prefix, scalar]] : [];
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = new Error(`Request failed for ${url}: ${response.status}`);
    error.status = response.status;
    error.url = url;
    throw error;
  }
  return response.json();
}

async function settle(promise) {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error };
  }
}

async function fetchStatboticsTeamEvents(baseUrl, eventCode) {
  const legacyUrl = `${baseUrl}/team_events/event/${eventCode}`;
  try {
    return {
      payload: await fetchJson(legacyUrl),
      endpoint: legacyUrl,
      fallbackUsed: false,
    };
  } catch (error) {
    if (Number(error?.status || 0) !== 404) throw error;
    const queryUrl = `${baseUrl}/team_events?event=${encodeURIComponent(eventCode)}`;
    return {
      payload: await fetchJson(queryUrl),
      endpoint: queryUrl,
      fallbackUsed: true,
    };
  }
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

const result = { eventKey, pageErrors };

try {
  assert(tbaAuthKey, "Missing TBA_AUTH_KEY environment variable.");
  const tbaHeaders = {
    Accept: "application/json",
    "X-TBA-Auth-Key": tbaAuthKey,
  };
  const [tbaRankingsResult, tbaOprsResult, tbaMatchesResult, statboticsTeamEventsResult] = await Promise.all([
    settle(fetchJson(`https://www.thebluealliance.com/api/v3/event/${eventKey}/rankings`, { headers: tbaHeaders })),
    settle(fetchJson(`https://www.thebluealliance.com/api/v3/event/${eventKey}/oprs`, { headers: tbaHeaders })),
    settle(fetchJson(`https://www.thebluealliance.com/api/v3/event/${eventKey}/matches`, { headers: tbaHeaders })),
    settle(fetchStatboticsTeamEvents(statboticsBaseUrl, eventKey)),
  ]);
  if (!tbaRankingsResult.ok) throw tbaRankingsResult.error;
  if (!tbaOprsResult.ok) throw tbaOprsResult.error;
  if (!tbaMatchesResult.ok) throw tbaMatchesResult.error;
  const tbaRankings = tbaRankingsResult.value;
  const tbaOprs = tbaOprsResult.value;
  const tbaMatches = tbaMatchesResult.value;
  const statboticsProviderStatus = statboticsTeamEventsResult.ok
    ? {
        ok: true,
        endpoint: statboticsTeamEventsResult.value.endpoint,
        fallbackUsed: Boolean(statboticsTeamEventsResult.value.fallbackUsed),
      }
    : {
        ok: false,
        endpoint: `${statboticsBaseUrl}/team_events/event/${eventKey}`,
        status: Number(statboticsTeamEventsResult.error?.status || 0) || null,
        message: String(statboticsTeamEventsResult.error?.message || "Unknown Statbotics error."),
      };
  const statboticsTeamEvents = statboticsTeamEventsResult.ok ? statboticsTeamEventsResult.value.payload : [];

  await page.addInitScript(({ injectedKey, injectedStatboticsBaseUrl }) => {
    globalThis.__TBA_AUTH_KEY = injectedKey;
    globalThis.__STATBOTICS_BASE_URL = injectedStatboticsBaseUrl;
  }, {
    injectedKey: tbaAuthKey,
    injectedStatboticsBaseUrl: statboticsBaseUrl,
  });

  await page.goto(appUrl);
  await waitForApp(page);
  await login(page);
  await page.evaluate(({ injectedKey, injectedStatboticsBaseUrl }) => {
    localStorage.setItem("frc-scouting-tba-auth-key", injectedKey);
    globalThis.__TBA_AUTH_KEY = injectedKey;
    localStorage.setItem("frc-scouting-statbotics-base-url", injectedStatboticsBaseUrl);
    globalThis.__STATBOTICS_BASE_URL = injectedStatboticsBaseUrl;
  }, {
    injectedKey: tbaAuthKey,
    injectedStatboticsBaseUrl: statboticsBaseUrl,
  });
  await openAdmin(page);

  await page.locator("#adminEventCodeInput").fill(eventKey);
  await page.locator("#adminEventCodeInput").press("Enter");
  await page.waitForFunction((expectedEventKey) => globalThis.__scoutingAppState?.activeEventKey === expectedEventKey, eventKey, { timeout: 120000 });
  await page.waitForTimeout(2000);

  result.verification = await page.evaluate(({ providerData }) => {
    function scalarProviderValue(value) {
      if (value === null || value === undefined) return null;
      if (typeof value === "boolean") return value ? 1 : 0;
      if (typeof value === "number" || typeof value === "string") return value;
      return null;
    }

    function flattenProviderScalarEntries(value, prefix = "") {
      if (Array.isArray(value)) {
        return value.flatMap((entry, index) => flattenProviderScalarEntries(entry, prefix ? `${prefix}.${index}` : String(index)));
      }
      if (value && typeof value === "object") {
        return Object.entries(value).flatMap(([key, entryValue]) => {
          const segment = String(key || "").trim();
          if (!segment) return [];
          return flattenProviderScalarEntries(entryValue, prefix ? `${prefix}.${segment}` : segment);
        });
      }
      const scalar = scalarProviderValue(value);
      return prefix && scalar !== null ? [[prefix, scalar]] : [];
    }

    function sortedUnique(values) {
      return [...new Set(values)].sort((left, right) => left.localeCompare(right));
    }
    const { tbaRankings, tbaOprs, tbaMatches, statboticsTeamEvents } = providerData;

    const expectedTbaIdentifiers = sortedUnique([
      ...(Array.isArray(tbaRankings?.rankings) ? tbaRankings.rankings : []).flatMap((rankingEntry) =>
        flattenProviderScalarEntries(rankingEntry || {})
          .map(([fieldId]) => fieldId)
          .filter((fieldId) => fieldId !== "team_key"),
      ),
      ...Object.keys(tbaOprs?.oprs || {}).map(() => "opr.total"),
      ...Object.keys(tbaOprs?.dprs || {}).map(() => "dpr.total"),
      ...Object.keys(tbaOprs?.ccwms || {}).map(() => "ccwm.total"),
      ...(Array.isArray(tbaMatches) ? tbaMatches : [])
        .filter((match) => match?.comp_level === "qm")
        .flatMap((match) => ["red", "blue"].flatMap((allianceKey) => flattenProviderScalarEntries(match?.score_breakdown?.[allianceKey] || {}).map(([fieldId]) => fieldId))),
    ])
      .map((fieldId) => `tba.${fieldId}`);

    const expectedStatboticsIdentifiers = sortedUnique(
      (Array.isArray(statboticsTeamEvents) ? statboticsTeamEvents : [])
        .flatMap((teamEvent) => flattenProviderScalarEntries(teamEvent || {}).map(([fieldId]) => fieldId))
        .filter((fieldId) => fieldId !== "team_name" && fieldId !== "event_name")
        .map((fieldId) => `statbotics.${fieldId}`),
    );

    const appTbaIdentifiers = currentAvailableTbaFormulaIdentifiers(currentEvent());
    const appStatboticsIdentifiers = currentAvailableStatboticsFormulaIdentifiers(currentEvent());
    const appDerivedIdentifiers = currentDerivedAvailableMetrics(currentEvent()).map((entry) => entry.id);
    const appDerivedTbaIdentifiers = appDerivedIdentifiers.filter((identifier) => identifier.startsWith("tba."));
    const appDerivedStatboticsIdentifiers = appDerivedIdentifiers.filter((identifier) => identifier.startsWith("statbotics."));

    const missingFromApp = (expected, actual) => expected.filter((identifier) => !actual.includes(identifier));
    const extrasInApp = (expected, actual) => actual.filter((identifier) => !expected.includes(identifier));

    return {
      eventSeason: currentEvent().season,
      expectedTbaIdentifiers,
      expectedStatboticsIdentifiers,
      appTbaIdentifiers,
      appStatboticsIdentifiers,
      appDerivedTbaIdentifiers,
      appDerivedStatboticsIdentifiers,
      tbaDiff: {
        missingFromFormulaCatalog: missingFromApp(expectedTbaIdentifiers, appTbaIdentifiers),
        extrasInFormulaCatalog: extrasInApp(expectedTbaIdentifiers, appTbaIdentifiers),
        missingFromDerivedCatalog: missingFromApp(expectedTbaIdentifiers, appDerivedTbaIdentifiers),
        extrasInDerivedCatalog: extrasInApp(expectedTbaIdentifiers, appDerivedTbaIdentifiers),
      },
      statboticsDiff: {
        missingFromFormulaCatalog: missingFromApp(expectedStatboticsIdentifiers, appStatboticsIdentifiers),
        extrasInFormulaCatalog: extrasInApp(expectedStatboticsIdentifiers, appStatboticsIdentifiers),
        missingFromDerivedCatalog: missingFromApp(expectedStatboticsIdentifiers, appDerivedStatboticsIdentifiers),
        extrasInDerivedCatalog: extrasInApp(expectedStatboticsIdentifiers, appDerivedStatboticsIdentifiers),
      },
    };
  }, {
    providerData: {
      tbaRankings,
      tbaOprs,
      tbaMatches,
      statboticsTeamEvents,
    },
  });

  assert(result.verification.eventSeason === 2023, `Expected 2023 event model. Got ${JSON.stringify(result.verification)}`);
  assert(result.verification.tbaDiff.missingFromFormulaCatalog.length === 0, `TBA formula catalog is missing identifiers: ${JSON.stringify(result.verification.tbaDiff)}`);
  assert(result.verification.tbaDiff.extrasInFormulaCatalog.length === 0, `TBA formula catalog has extra identifiers: ${JSON.stringify(result.verification.tbaDiff)}`);
  assert(result.verification.tbaDiff.missingFromDerivedCatalog.length === 0, `TBA derived catalog is missing identifiers: ${JSON.stringify(result.verification.tbaDiff)}`);
  assert(result.verification.tbaDiff.extrasInDerivedCatalog.length === 0, `TBA derived catalog has extra identifiers: ${JSON.stringify(result.verification.tbaDiff)}`);
  if (statboticsProviderStatus.ok) {
    assert(result.verification.statboticsDiff.missingFromFormulaCatalog.length === 0, `Statbotics formula catalog is missing identifiers: ${JSON.stringify(result.verification.statboticsDiff)}`);
    assert(result.verification.statboticsDiff.extrasInFormulaCatalog.length === 0, `Statbotics formula catalog has extra identifiers: ${JSON.stringify(result.verification.statboticsDiff)}`);
    assert(result.verification.statboticsDiff.missingFromDerivedCatalog.length === 0, `Statbotics derived catalog is missing identifiers: ${JSON.stringify(result.verification.statboticsDiff)}`);
    assert(result.verification.statboticsDiff.extrasInDerivedCatalog.length === 0, `Statbotics derived catalog has extra identifiers: ${JSON.stringify(result.verification.statboticsDiff)}`);
  }
  result.statboticsBaseUrl = statboticsBaseUrl;
  result.statboticsProviderStatus = statboticsProviderStatus;
} finally {
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
