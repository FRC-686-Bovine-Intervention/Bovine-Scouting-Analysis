(function () {
const eventModelBuilder = globalThis.EventModelBuilder || {};
const externalSourceSnapshots = globalThis.ExternalSourceSnapshots || {};

const buildEventModelFromProviderBundle =
  eventModelBuilder.buildEventModelFromProviderBundle ||
  ((bundle) => ({
    key: bundle.key,
    season: bundle.year,
    name: bundle.tbaEvent?.name || bundle.key,
    seasonLabel: "",
    matches: [],
    matchesComplete: 0,
    teams: [],
    teamNumbers: [],
    scoringComponents: [],
    metrics: [],
    seedPicklists: [],
    seedSortEquations: [],
    defaultMetricId: "",
    defaultTeamDetailMetricId: "",
    dataSources: [],
    sheet: null,
    catalogSource: "dynamic-external",
  }));
const buildExternalSourceSnapshot = externalSourceSnapshots.buildExternalSourceSnapshot || ((sourceId, eventModel) => ({ sourceId, eventKey: eventModel?.key }));
const buildSnapshotFingerprint = externalSourceSnapshots.buildSnapshotFingerprint || ((value) => JSON.stringify(value || null));

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeEventCode(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveFetchImpl(options = {}) {
  if (typeof options.fetchImpl === "function") return options.fetchImpl;
  if (typeof globalThis.fetch === "function") return globalThis.fetch.bind(globalThis);
  return null;
}

function resolveTbaAuthKey(options = {}) {
  return normalizeText(options.tbaAuthKey) || normalizeText(globalThis.__TBA_AUTH_KEY) || normalizeText(globalThis.TBA_AUTH_KEY);
}

function resolveStatboticsBaseUrl(options = {}) {
  return normalizeText(options.statboticsBaseUrl)
    || normalizeText(globalThis.__STATBOTICS_BASE_URL)
    || normalizeText(globalThis.STATBOTICS_BASE_URL)
    || "https://api.statbotics.io/v3";
}

function resolveStatboticsFallbackBaseUrl(options = {}) {
  return normalizeText(options.statboticsFallbackBaseUrl)
    || normalizeText(globalThis.__STATBOTICS_FALLBACK_BASE_URL)
    || "https://api-statbotics.iterativerefinement.com/v3";
}

function formatProviderError(provider, error) {
  const message = normalizeText(error?.message) || `Unable to load ${provider}.`;
  return `${provider}: ${message}`;
}

function isNotFoundError(error) {
  return Number(error?.status || 0) === 404;
}

async function fetchJson(url, options = {}) {
  const fetchImpl = resolveFetchImpl(options);
  if (typeof fetchImpl !== "function") throw new Error("Fetch is not available in this runtime.");
  const response = await fetchImpl(url, {
    headers: options.headers || {},
  });
  if (!response?.ok) {
    const error = new Error(`HTTP ${response?.status || "unknown"}`);
    error.status = response?.status || 0;
    error.url = url;
    throw error;
  }
  const rawBytes = typeof response.arrayBuffer === "function" ? new Uint8Array(await response.arrayBuffer()) : null;
  const rawText = rawBytes ? new TextDecoder().decode(rawBytes) : JSON.stringify(await response.json());
  try {
    return {
      payload: JSON.parse(rawText),
      rawText,
      rawBytes,
      requestUrl: url,
      contentType: response.headers?.get?.("content-type") || "application/json",
      status: Number(response.status) || 200,
    };
  } catch {
    const error = new Error("Response was not valid JSON.");
    error.url = url;
    throw error;
  }
}

async function settle(promise) {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error };
  }
}

async function fetchStatboticsTeamEvents(statboticsBaseUrl, normalizedEventCode, options = {}) {
  const legacyUrl = `${statboticsBaseUrl}/team_events/event/${normalizedEventCode}`;
  try {
    return {
      ...await fetchJson(legacyUrl, options),
      requestUrl: legacyUrl,
      fallbackUsed: false,
    };
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    const queryUrl = `${statboticsBaseUrl}/team_events?event=${encodeURIComponent(normalizedEventCode)}`;
    return {
      ...await fetchJson(queryUrl, options),
      requestUrl: queryUrl,
      fallbackUsed: true,
    };
  }
}

async function fetchStatboticsBundle(statboticsBaseUrl, normalizedEventCode, options = {}) {
  const [event, teamEvents] = await Promise.all([
    fetchJson(`${statboticsBaseUrl}/event/${normalizedEventCode}`, options),
    fetchStatboticsTeamEvents(statboticsBaseUrl, normalizedEventCode, options),
  ]);
  return { event, teamEvents, baseUrl: statboticsBaseUrl };
}

async function loadStatboticsBundle(primaryBaseUrl, fallbackBaseUrl, normalizedEventCode, options = {}) {
  try {
    return { ok: true, value: await fetchStatboticsBundle(primaryBaseUrl, normalizedEventCode, options), fallbackUsed: false };
  } catch (primaryError) {
    if (fallbackBaseUrl === primaryBaseUrl) return { ok: false, error: primaryError, baseUrl: primaryBaseUrl };
    try {
      return {
        ok: true,
        value: await fetchStatboticsBundle(fallbackBaseUrl, normalizedEventCode, options),
        fallbackUsed: true,
        primaryError,
      };
    } catch (fallbackError) {
      return { ok: false, error: fallbackError, baseUrl: fallbackBaseUrl, primaryError };
    }
  }
}

async function fetchStatboticsTeamMatchRows(statboticsBaseUrl, eventCode, matches, options = {}) {
  if (options.loadStatboticsMatchData === false) return { rows: [], responses: [] };
  const collectionUrl = `${statboticsBaseUrl}/matches?event=${encodeURIComponent(eventCode)}`;
  try {
    const response = await fetchJson(collectionUrl, options);
    const rows = (Array.isArray(response.payload) ? response.payload : [])
      .filter((match) => match?.comp_level === "qm")
      .flatMap((match) => Object.entries(match?.epas || {}).map(([team, epa]) => ({
        team: Number(team),
        match: match.key,
        epa: { total_points: epa?.epa, breakdown: epa },
      })));
    return { rows, responses: [response] };
  } catch {
    // Older/fallback Statbotics hosts may not expose the collection route.
  }
  const requests = (Array.isArray(matches) ? matches : [])
    .filter((match) => match?.comp_level === "qm" && (match?.key || Number.isFinite(Number(match?.match_number))))
    .flatMap((match) => [
      ...(match.alliances?.red?.team_keys || []),
      ...(match.alliances?.blue?.team_keys || []),
    ].map((teamKey) => ({
      teamKey: String(teamKey).replace(/^frc/i, ""),
      matchKey: match.key || `${eventCode}_qm${Number(match.match_number)}`,
    })));
  const settled = await Promise.all(requests.map(async ({ teamKey, matchKey }) => {
    try {
      const response = await fetchJson(`${statboticsBaseUrl}/team_match/${teamKey}/${matchKey}`, options);
      return { ok: true, response, payload: response.payload };
    } catch {
      return { ok: false };
    }
  }));
  return {
    rows: settled.filter((result) => result.ok).map((result) => result.payload),
    responses: settled.filter((result) => result.ok).map((result) => result.response),
  };
}

function buildReadySourceState(sourceId, eventModel, timestamp, options = {}) {
  return {
    sourceId,
    kind: "external",
    status: options.status || "ready",
    freshness: options.freshness || "fresh",
    lastAttemptedAt: timestamp,
    lastSuccessfulAt: timestamp,
    nextPollAt: "",
    consecutiveFailures: 0,
    pollingEnabled: options.pollingEnabled !== undefined ? Boolean(options.pollingEnabled) : true,
    error: "",
    sourceFingerprint: buildSnapshotFingerprint(buildExternalSourceSnapshot(sourceId, eventModel)),
    provenance: {
      mode: options.mode || "live-api",
      eventKey: normalizeText(options.eventKey) || normalizeText(eventModel?.key),
      generatedAt: normalizeText(options.generatedAt) || timestamp,
      inputFingerprints: options.inputFingerprints && typeof options.inputFingerprints === "object" ? { ...options.inputFingerprints } : {},
      notes: options.notes || "",
    },
  };
}

function buildFailedSourceState(sourceId, timestamp, options = {}) {
  return {
    sourceId,
    kind: "external",
    status: "error",
    freshness: "stale",
    lastAttemptedAt: timestamp,
    lastSuccessfulAt: normalizeText(options.lastSuccessfulAt),
    nextPollAt: "",
    consecutiveFailures: Math.max(1, Number(options.consecutiveFailures) || 1),
    pollingEnabled: options.pollingEnabled !== undefined ? Boolean(options.pollingEnabled) : true,
    error: normalizeText(options.error),
    sourceFingerprint: normalizeText(options.sourceFingerprint),
    provenance: {
      mode: options.mode || "live-api",
      eventKey: normalizeText(options.eventKey),
      generatedAt: normalizeText(options.generatedAt) || timestamp,
      inputFingerprints: options.inputFingerprints && typeof options.inputFingerprints === "object" ? { ...options.inputFingerprints } : {},
      notes: normalizeText(options.notes),
    },
  };
}

function buildPendingSourceState(sourceId, options = {}) {
  return {
    sourceId,
    kind: "external",
    status: normalizeText(options.status) || "stale",
    freshness: normalizeText(options.freshness) || "unknown",
    lastAttemptedAt: normalizeText(options.lastAttemptedAt),
    lastSuccessfulAt: normalizeText(options.lastSuccessfulAt),
    nextPollAt: "",
    consecutiveFailures: Math.max(0, Number(options.consecutiveFailures) || 0),
    pollingEnabled: options.pollingEnabled !== undefined ? Boolean(options.pollingEnabled) : true,
    error: normalizeText(options.error),
    sourceFingerprint: normalizeText(options.sourceFingerprint),
    provenance: {
      mode: options.mode || "requires-sync",
      eventKey: normalizeText(options.eventKey),
      generatedAt: normalizeText(options.generatedAt) || normalizeText(options.lastAttemptedAt),
      inputFingerprints: options.inputFingerprints && typeof options.inputFingerprints === "object" ? { ...options.inputFingerprints } : {},
      notes: normalizeText(options.notes),
    },
  };
}

function buildPridgeInputFingerprints(eventModel) {
  return {
    tba: buildSnapshotFingerprint(buildExternalSourceSnapshot("tba", eventModel)),
    statbotics: buildSnapshotFingerprint(buildExternalSourceSnapshot("statbotics", eventModel)),
  };
}

function buildPridgeUnavailableState(eventModel, timestamp, options = {}) {
  const eventKey = normalizeText(options.eventKey) || normalizeText(eventModel?.key);
  const inputFingerprints = options.inputFingerprints && typeof options.inputFingerprints === "object"
    ? { ...options.inputFingerprints }
    : {};
  return buildFailedSourceState("pridge", timestamp, {
    eventKey,
    generatedAt: timestamp,
    inputFingerprints,
    error: normalizeText(options.error),
    mode: "native-compute",
    notes: normalizeText(options.notes),
  });
}

function eventHasComputedPridge(eventModel) {
  return Boolean((eventModel?.teams || []).some((team) => {
    const total = team?.sources?.pridge?.total;
    return total !== null && total !== undefined && Number.isFinite(Number(total));
  }));
}

async function loadEventByCode(eventCode, options = {}) {
  const normalizedEventCode = normalizeEventCode(eventCode);
  if (!normalizedEventCode) throw new Error("Enter a valid event code.");

  const tbaAuthKey = resolveTbaAuthKey(options);
  if (!tbaAuthKey) {
    throw new Error("Missing TBA auth key. Configure a key before loading arbitrary events.");
  }

  const timestamp = normalizeText(options.timestamp) || new Date().toISOString();
  const tbaBaseUrl = normalizeText(options.tbaBaseUrl) || "https://www.thebluealliance.com/api/v3";
  const statboticsBaseUrl = resolveStatboticsBaseUrl(options);
  const statboticsFallbackBaseUrl = resolveStatboticsFallbackBaseUrl(options);
  const tbaHeaders = {
    Accept: "application/json",
    "X-TBA-Auth-Key": tbaAuthKey,
  };

  const [tbaEventResult, tbaTeamsResult, tbaMatchesResult, tbaRankingsResult, tbaTeamStatsResult, statboticsResult] = await Promise.all([
    settle(fetchJson(`${tbaBaseUrl}/event/${normalizedEventCode}`, { ...options, headers: tbaHeaders })),
    settle(fetchJson(`${tbaBaseUrl}/event/${normalizedEventCode}/teams`, { ...options, headers: tbaHeaders })),
    settle(fetchJson(`${tbaBaseUrl}/event/${normalizedEventCode}/matches`, { ...options, headers: tbaHeaders })),
    settle(fetchJson(`${tbaBaseUrl}/event/${normalizedEventCode}/rankings`, { ...options, headers: tbaHeaders })),
    settle(fetchJson(`${tbaBaseUrl}/event/${normalizedEventCode}/oprs`, { ...options, headers: tbaHeaders })),
    loadStatboticsBundle(statboticsBaseUrl, statboticsFallbackBaseUrl, normalizedEventCode, options),
  ]);

  const statboticsEventResult = statboticsResult.ok
    ? { ok: true, value: statboticsResult.value.event }
    : { ok: false, error: statboticsResult.error };
  const statboticsTeamEventsResult = statboticsResult.ok
    ? { ok: true, value: statboticsResult.value.teamEvents }
    : { ok: false, error: statboticsResult.error };
  const statboticsTeamMatchesResult = statboticsResult.ok && tbaMatchesResult.ok
    ? await fetchStatboticsTeamMatchRows(statboticsResult.value.baseUrl, normalizedEventCode, tbaMatchesResult.value.payload, options)
    : { rows: [], responses: [] };

  if (!tbaEventResult.ok) throw new Error(formatProviderError("The Blue Alliance event lookup failed", tbaEventResult.error));
  if (!tbaTeamsResult.ok) throw new Error(formatProviderError("The Blue Alliance team lookup failed", tbaTeamsResult.error));
  if (!tbaMatchesResult.ok) throw new Error(formatProviderError("The Blue Alliance match lookup failed", tbaMatchesResult.error));

  const eventYear = Number(tbaEventResult.value?.payload?.year || statboticsEventResult.value?.payload?.year || 0);
  const eventModel = buildEventModelFromProviderBundle({
    key: normalizedEventCode,
    year: eventYear,
    importProfileId: "",
    sheet: null,
    tbaEvent: tbaEventResult.value?.payload || {},
    tbaTeams: Array.isArray(tbaTeamsResult.value?.payload) ? tbaTeamsResult.value.payload : [],
    tbaMatches: Array.isArray(tbaMatchesResult.value?.payload) ? tbaMatchesResult.value.payload : [],
    tbaRankings: tbaRankingsResult.ok ? (tbaRankingsResult.value?.payload || {}) : {},
    tbaTeamStats: tbaTeamStatsResult.ok ? (tbaTeamStatsResult.value?.payload || {}) : {},
    statboticsEvent: statboticsEventResult.ok ? (statboticsEventResult.value?.payload || {}) : {},
    statboticsTeamEvents: statboticsTeamEventsResult.ok ? (statboticsTeamEventsResult.value?.payload || []) : [],
    statboticsTeamMatches: statboticsTeamMatchesResult.rows,
    deferPridgeTrends: options.deferPridgeTrends === true,
    pridgeResponseDefinitions: options.pridgeResponseDefinitions || [],
    catalogSource: "dynamic-external",
  });

  const warnings = [];
  if (!tbaRankingsResult.ok) {
    warnings.push(formatProviderError("The Blue Alliance rankings", tbaRankingsResult.error));
  }
  if (!tbaTeamStatsResult.ok) {
    warnings.push(formatProviderError("The Blue Alliance team stats", tbaTeamStatsResult.error));
  }
  const sourceStates = {
    tba: buildReadySourceState("tba", eventModel, timestamp, {
      notes: [
        "Loaded from The Blue Alliance live API.",
        !tbaRankingsResult.ok ? "Rankings were unavailable, so ranking views may be degraded." : "",
        !tbaTeamStatsResult.ok ? "Team-stat values such as OPR, DPR, and CCWM were unavailable, so TBA-backed stat views may be degraded." : "",
      ].filter(Boolean).join(" "),
    }),
  };

  if (statboticsEventResult.ok && statboticsTeamEventsResult.ok) {
    const statboticsTeamEventsNote = statboticsTeamEventsResult.value?.fallbackUsed
      ? " Loaded team-event rows through the query-form team_events endpoint because the legacy event route returned 404."
      : "";
    const statboticsHostNote = statboticsResult.fallbackUsed
      ? ` Primary Statbotics site failed; loaded from the secondary fallback ${statboticsResult.value.baseUrl}.`
      : ` Loaded from the primary Statbotics site ${statboticsResult.value.baseUrl}.`;
    sourceStates.statbotics = buildReadySourceState("statbotics", eventModel, timestamp, {
      notes: `${statboticsHostNote}${statboticsTeamEventsNote}`,
    });
  } else {
    const statboticsError = statboticsResult.error || (!statboticsEventResult.ok ? statboticsEventResult.error : statboticsTeamEventsResult.error);
    const message = formatProviderError("Statbotics", statboticsError);
    warnings.push(message);
    sourceStates.statbotics = buildFailedSourceState("statbotics", timestamp, {
      error: message,
      notes: "Event loaded without Statbotics. EPA-backed views will show degraded values until this source succeeds.",
    });
  }

  if (eventHasComputedPridge(eventModel)) {
    const inputFingerprints = buildPridgeInputFingerprints(eventModel);
    sourceStates.pridge = buildReadySourceState("pridge", eventModel, timestamp, {
      mode: "native-compute",
      inputFingerprints,
      notes: "Event-total pRidge was computed locally from TBA qualification matches and Statbotics start EPA priors.",
    });
  } else {
    const inputFingerprints = {
      tba: buildSnapshotFingerprint(buildExternalSourceSnapshot("tba", eventModel)),
      ...(statboticsEventResult.ok && statboticsTeamEventsResult.ok
        ? { statbotics: buildSnapshotFingerprint(buildExternalSourceSnapshot("statbotics", eventModel)) }
        : {}),
    };
    if (!statboticsEventResult.ok || !statboticsTeamEventsResult.ok) {
      sourceStates.pridge = buildPridgeUnavailableState(eventModel, timestamp, {
        eventKey: normalizedEventCode,
        inputFingerprints,
        error: "pRidge could not be computed because Statbotics start EPA priors are unavailable.",
        notes: "pRidge depends on Statbotics start EPA priors for every event team.",
      });
    } else if (!(eventModel.matches || []).length) {
      sourceStates.pridge = buildPridgeUnavailableState(eventModel, timestamp, {
        eventKey: normalizedEventCode,
        inputFingerprints,
        error: "pRidge could not be computed because no usable qualification match rows were available from The Blue Alliance.",
        notes: "pRidge requires valid qualification matches with complete alliance rosters and scores.",
      });
    } else {
      sourceStates.pridge = buildPridgeUnavailableState(eventModel, timestamp, {
        eventKey: normalizedEventCode,
        inputFingerprints,
        error: "pRidge could not be computed from the available TBA and Statbotics event inputs.",
        notes: "pRidge native compute failed even though TBA and Statbotics inputs were present.",
      });
    }
  }

  return {
    eventKey: normalizedEventCode,
    eventModel,
    sourceStates,
    warnings,
    rawSourceArtifacts: [
      ["tba-event", tbaEventResult], ["tba-teams", tbaTeamsResult], ["tba-matches", tbaMatchesResult], ["tba-rankings", tbaRankingsResult], ["tba-oprs", tbaTeamStatsResult], ["statbotics-event", statboticsEventResult], ["statbotics-team-events", statboticsTeamEventsResult],
      ["statbotics-matches", statboticsTeamMatchesResult.responses[0] ? { ok: true, value: statboticsTeamMatchesResult.responses[0] } : { ok: false }],
    ].filter(([, result]) => result.ok).map(([sourceId, result]) => ({
      sourceId,
      rawText: result.value.rawText,
      rawBytes: result.value.rawBytes,
      sourceUrl: result.value.requestUrl,
      contentType: result.value.contentType,
      status: result.value.status,
      fetchedAt: timestamp,
    })),
  };
}

globalThis.ExternalEventLoader = {
  loadEventByCode,
  normalizeEventCode,
};
})();
