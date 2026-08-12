(function () {
function normalizeText(value) {
  return String(value || "").trim();
}

function defaultPolicyForSource(source) {
  if (source?.kind === "scouting") {
    return {
      baseIntervalMs: 2 * 60 * 1000,
      staleAfterMs: 15 * 60 * 1000,
      maxBackoffMs: 20 * 60 * 1000,
    };
  }
  return {
    baseIntervalMs: 5 * 60 * 1000,
    staleAfterMs: 15 * 60 * 1000,
    maxBackoffMs: 60 * 60 * 1000,
  };
}

function computeBackoffMs(policy, consecutiveFailures = 0) {
  const safeFailures = Math.max(0, Number(consecutiveFailures) || 0);
  const base = Number(policy?.baseIntervalMs) || 60 * 1000;
  const max = Number(policy?.maxBackoffMs) || base * 8;
  return Math.min(base * (2 ** safeFailures), max);
}

function computeNextPollAt(source, policy, now = Date.now()) {
  const lastAttempt = Date.parse(normalizeText(source?.lastAttemptedAt) || "") || now;
  return new Date(lastAttempt + computeBackoffMs(policy, source?.consecutiveFailures)).toISOString();
}

function computeInitialNextPollAt(source, policy, now = Date.now()) {
  const delayMs = source?.kind === "scouting" ? 5 * 1000 : 10 * 1000;
  return new Date(now + delayMs).toISOString();
}

function freshnessForSource(source, policy, now = Date.now()) {
  if (normalizeText(source?.status) === "error") return "stale";
  const lastSuccessfulAt = Date.parse(normalizeText(source?.lastSuccessfulAt) || "");
  if (!lastSuccessfulAt) return normalizeText(source?.freshness) || "unknown";
  const staleAfterMs = Number(policy?.staleAfterMs) || 5 * 60 * 1000;
  return now - lastSuccessfulAt > staleAfterMs ? "stale" : "fresh";
}

function visibleStatusForSource(source, policy, now = Date.now()) {
  const status = normalizeText(source?.status).toLowerCase();
  if (status === "error") return "error";
  const freshness = freshnessForSource(source, policy, now);
  if (status === "ready" && freshness !== "stale") return "ready";
  return "stale";
}

function sourceStatusBadgeClassName(status) {
  const normalizedStatus = normalizeText(status).toLowerCase();
  return `status-${normalizedStatus === "ready" || normalizedStatus === "error" ? normalizedStatus : "stale"}`;
}

function shouldPollSource(source, policy, now = Date.now()) {
  if (source?.pollingEnabled === false) return false;
  const nextPollAt = Date.parse(normalizeText(source?.nextPollAt) || "");
  if (!nextPollAt) return true;
  return now >= nextPollAt;
}

function createRefreshCoordinator() {
  const sequences = new Map();
  const inFlight = new Map();
  function begin(sourceId) {
    const sequence = (sequences.get(sourceId) || 0) + 1;
    sequences.set(sourceId, sequence);
    return { sourceId, sequence };
  }
  function isCurrent(token) { return Boolean(token) && sequences.get(token.sourceId) === token.sequence; }
  function run(sourceId, operation) {
    if (inFlight.has(sourceId)) return inFlight.get(sourceId);
    const token = begin(sourceId);
    const promise = Promise.resolve().then(() => operation(token)).finally(() => {
      if (inFlight.get(sourceId) === promise) inFlight.delete(sourceId);
    });
    inFlight.set(sourceId, promise);
    return promise;
  }
  return { begin, isCurrent, run, isInFlight: (sourceId) => inFlight.has(sourceId) };
}

globalThis.SourceRefresh = {
  computeNextPollAt,
  computeInitialNextPollAt,
  defaultPolicyForSource,
  freshnessForSource,
  sourceStatusBadgeClassName,
  visibleStatusForSource,
  shouldPollSource,
  createRefreshCoordinator,
};
})();
