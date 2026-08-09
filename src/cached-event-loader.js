(function attachCachedEventLoader(globalScope) {
  const eventModelBuilder = globalScope.EventModelBuilder || {};
  const buildEventModelFromProviderBundle = eventModelBuilder.buildEventModelFromProviderBundle;

  function normalizeText(value) { return String(value ?? "").trim(); }
  function decodeRawSource(source = {}) {
    const raw = source.rawBytes instanceof Uint8Array ? new TextDecoder().decode(source.rawBytes) : String(source.rawText ?? "");
    try { return JSON.parse(raw); }
    catch { throw new Error(`Cached ${normalizeText(source?.manifest?.sourceId) || "provider"} data is not valid JSON.`); }
  }
  function cacheFreshness(manifest = {}, now = Date.now()) {
    const fetchedAt = Date.parse(normalizeText(manifest.fetchedAt));
    return fetchedAt && now - fetchedAt <= 15 * 60 * 1000 ? "fresh" : "stale";
  }
  function cachedSourceState(manifest, now) {
    return {
      status: "ready",
      freshness: cacheFreshness(manifest, now),
      lastSuccessfulAt: normalizeText(manifest?.fetchedAt),
      sourceFingerprint: normalizeText(manifest?.fingerprint),
      notes: `Loaded from the shared Firestore cache${cacheFreshness(manifest, now) === "stale" ? "; this cached source is stale." : "."}`,
    };
  }

  async function rebuildCachedEvent({ event = {}, loadSource, now = Date.now() } = {}) {
    if (typeof loadSource !== "function") throw new Error("A cached-source reader is required.");
    if (typeof buildEventModelFromProviderBundle !== "function") throw new Error("Event model construction is unavailable.");
    const sourceIds = ["tba-event", "tba-teams", "tba-matches", "tba-rankings", "tba-oprs", "statbotics-event", "statbotics-team-events"];
    const optionalSourceIds = ["statbotics-matches"];
    const loaded = Object.fromEntries(await Promise.all([...sourceIds, ...optionalSourceIds].map(async (sourceId) => {
      try { return [sourceId, await loadSource(sourceId)]; }
      catch (error) { return [sourceId, { error }]; }
    })));
    for (const sourceId of ["tba-event", "tba-teams", "tba-matches"]) {
      if (loaded[sourceId]?.error) throw new Error(`Cached ${sourceId} data is unavailable: ${loaded[sourceId].error?.message || "unknown error"}`);
    }
    const payload = (sourceId, fallback) => loaded[sourceId]?.error || !loaded[sourceId] ? fallback : decodeRawSource(loaded[sourceId]);
    const tbaEvent = payload("tba-event", {});
    const tbaTeams = payload("tba-teams", []);
    const tbaMatches = payload("tba-matches", []);
    const eventModel = buildEventModelFromProviderBundle({
      key: normalizeText(event.key), year: Number(tbaEvent?.year || event.season || 0), importProfileId: "", sheet: null,
      tbaEvent, tbaTeams: Array.isArray(tbaTeams) ? tbaTeams : [], tbaMatches: Array.isArray(tbaMatches) ? tbaMatches : [],
      tbaRankings: payload("tba-rankings", {}), tbaTeamStats: payload("tba-oprs", {}),
      statboticsEvent: payload("statbotics-event", {}), statboticsTeamEvents: payload("statbotics-team-events", []), catalogSource: "shared-cache",
      statboticsTeamMatches: payload("statbotics-matches", []),
    });
    const warnings = sourceIds.filter((sourceId) => loaded[sourceId]?.error).map((sourceId) => `Cached ${sourceId} data is unavailable.`);
    const sourceStates = {
      tba: cachedSourceState(loaded["tba-event"].manifest, now),
      statbotics: loaded["statbotics-event"]?.error || loaded["statbotics-team-events"]?.error
        ? { status: "error", freshness: "stale", lastSuccessfulAt: "", notes: "Statbotics cached source is unavailable; no replacement data was invented." }
        : cachedSourceState(loaded["statbotics-event"].manifest, now),
    };
    return { eventModel, sourceStates, warnings, cacheFreshness: cacheFreshness(loaded["tba-event"].manifest, now) };
  }

  globalScope.CachedEventLoader = { rebuildCachedEvent, cacheFreshness };
})(globalThis);
