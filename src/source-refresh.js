(function () {
function normalizeText(value) {
  return String(value || "").trim();
}

function defaultPolicyForSource(source) {
  if (source?.kind === "scouting") {
    return {
      baseIntervalMs: 2 * 60 * 1000,
      staleAfterMs: 5 * 60 * 1000,
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

function freshnessForSource(source, policy, now = Date.now()) {
  if (normalizeText(source?.status) === "error") return "stale";
  const lastSuccessfulAt = Date.parse(normalizeText(source?.lastSuccessfulAt) || "");
  if (!lastSuccessfulAt) return normalizeText(source?.freshness) || "unknown";
  const staleAfterMs = Number(policy?.staleAfterMs) || 5 * 60 * 1000;
  return now - lastSuccessfulAt > staleAfterMs ? "stale" : "fresh";
}

function shouldPollSource(source, policy, now = Date.now()) {
  if (source?.pollingEnabled === false) return false;
  const nextPollAt = Date.parse(normalizeText(source?.nextPollAt) || "");
  if (!nextPollAt) return true;
  return now >= nextPollAt;
}

globalThis.SourceRefresh = {
  computeNextPollAt,
  defaultPolicyForSource,
  freshnessForSource,
  shouldPollSource,
};
})();
