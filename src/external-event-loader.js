(function () {
const eventModelBuilder = globalThis.EventModelBuilder || {};
const externalSourceSnapshots = globalThis.ExternalSourceSnapshots || {};

const buildEventModelFromProviderBundle =
  eventModelBuilder.buildEventModelFromProviderBundle ||
  ((bundle) => ({
    key: bundle.key,
    season: bundle.year,
    name: bundle.tbaEvent?.name || bundle.key,
    seasonLabel: String(bundle.year || ""),
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

function formatProviderError(provider, error) {
  const message = normalizeText(error?.message) || `Unable to load ${provider}.`;
  return `${provider}: ${message}`;
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
  return response.json();
}

async function settle(promise) {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error };
  }
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
    status: normalizeText(options.status) || "manual",
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
    throw new Error("Missing TBA auth key. Set globalThis.__TBA_AUTH_KEY before loading arbitrary events.");
  }

  const timestamp = normalizeText(options.timestamp) || new Date().toISOString();
  const tbaBaseUrl = normalizeText(options.tbaBaseUrl) || "https://www.thebluealliance.com/api/v3";
  const statboticsBaseUrl = normalizeText(options.statboticsBaseUrl) || "https://api.statbotics.io/v3";
  const tbaHeaders = {
    Accept: "application/json",
    "X-TBA-Auth-Key": tbaAuthKey,
  };

  const [tbaEventResult, tbaTeamsResult, tbaMatchesResult, statboticsEventResult, statboticsTeamEventsResult] = await Promise.all([
    settle(fetchJson(`${tbaBaseUrl}/event/${normalizedEventCode}`, { ...options, headers: tbaHeaders })),
    settle(fetchJson(`${tbaBaseUrl}/event/${normalizedEventCode}/teams`, { ...options, headers: tbaHeaders })),
    settle(fetchJson(`${tbaBaseUrl}/event/${normalizedEventCode}/matches`, { ...options, headers: tbaHeaders })),
    settle(fetchJson(`${statboticsBaseUrl}/event/${normalizedEventCode}`, options)),
    settle(fetchJson(`${statboticsBaseUrl}/team_events/event/${normalizedEventCode}`, options)),
  ]);

  if (!tbaEventResult.ok) throw new Error(formatProviderError("The Blue Alliance event lookup failed", tbaEventResult.error));
  if (!tbaTeamsResult.ok) throw new Error(formatProviderError("The Blue Alliance team lookup failed", tbaTeamsResult.error));
  if (!tbaMatchesResult.ok) throw new Error(formatProviderError("The Blue Alliance match lookup failed", tbaMatchesResult.error));

  const eventYear = Number(tbaEventResult.value?.year || statboticsEventResult.value?.year || 0);
  const eventModel = buildEventModelFromProviderBundle({
    key: normalizedEventCode,
    year: eventYear,
    importProfileId: "",
    sheet: null,
    tbaEvent: tbaEventResult.value || {},
    tbaTeams: Array.isArray(tbaTeamsResult.value) ? tbaTeamsResult.value : [],
    tbaMatches: Array.isArray(tbaMatchesResult.value) ? tbaMatchesResult.value : [],
    statboticsEvent: statboticsEventResult.ok ? (statboticsEventResult.value || {}) : {},
    statboticsTeamEvents: statboticsTeamEventsResult.ok ? (statboticsTeamEventsResult.value || []) : [],
    catalogSource: "dynamic-external",
  });

  const warnings = [];
  const sourceStates = {
    tba: buildReadySourceState("tba", eventModel, timestamp, {
      notes: "Loaded from The Blue Alliance live API.",
    }),
  };

  if (statboticsEventResult.ok && statboticsTeamEventsResult.ok) {
    sourceStates.statbotics = buildReadySourceState("statbotics", eventModel, timestamp, {
      notes: "Loaded from the Statbotics live API.",
    });
  } else {
    const statboticsError = !statboticsEventResult.ok ? statboticsEventResult.error : statboticsTeamEventsResult.error;
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
    sourceStates.pridge = buildPendingSourceState("pridge", {
      status: "manual",
      mode: "native-compute",
      eventKey: normalizedEventCode,
      generatedAt: timestamp,
      inputFingerprints: statboticsEventResult.ok && statboticsTeamEventsResult.ok
        ? {
          tba: buildSnapshotFingerprint(buildExternalSourceSnapshot("tba", eventModel)),
          statbotics: buildSnapshotFingerprint(buildExternalSourceSnapshot("statbotics", eventModel)),
        }
        : {
          tba: buildSnapshotFingerprint(buildExternalSourceSnapshot("tba", eventModel)),
        },
      notes: "pRidge needs complete TBA qualification results plus Statbotics team-event priors before it can be computed locally.",
    });
  }

  return {
    eventKey: normalizedEventCode,
    eventModel,
    sourceStates,
    warnings,
  };
}

globalThis.ExternalEventLoader = {
  loadEventByCode,
  normalizeEventCode,
};
})();
