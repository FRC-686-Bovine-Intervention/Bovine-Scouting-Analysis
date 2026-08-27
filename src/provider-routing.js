(function () {
  const REAL_TBA = "https://www.thebluealliance.com/api/v3";
  const REAL_STATBOTICS = "https://api.statbotics.io/v3";

  function text(value) { return String(value || "").trim().replace(/\/$/, ""); }

  function readRuntimeConfig() {
    const configured = globalThis.__EVENT_SIMULATOR_CONFIG;
    if (!configured || typeof configured !== "object") return { mode: "production" };
    const mode = configured.mode === "simulator-first" || configured.mode === "fallback" ? configured.mode : "production";
    return {
      mode,
      tbaUrl: text(configured.tbaUrl),
      statboticsUrl: text(configured.statboticsUrl),
      scoutingUrl: text(configured.scoutingUrl),
    };
  }

  function resolveProviderRouting(options = {}) {
    const runtime = readRuntimeConfig();
    const explicitMode = options.providerRoutingMode || options.routingMode;
    const mode = explicitMode === "simulator-first" || explicitMode === "fallback" || explicitMode === "production" ? explicitMode : runtime.mode;
    const simulator = {
      tba: text(options.simulatorTbaBaseUrl) || runtime.tbaUrl,
      statbotics: text(options.simulatorStatboticsBaseUrl) || runtime.statboticsUrl,
      scouting: text(options.simulatorScoutingUrl) || runtime.scoutingUrl,
    };
    const tbaPrimary = text(options.tbaBaseUrl) || REAL_TBA;
    const statboticsPrimary = text(options.statboticsBaseUrl) || REAL_STATBOTICS;
    if (mode === "simulator-first") return { mode, tbaBaseUrl: simulator.tba || tbaPrimary, statboticsBaseUrl: simulator.statbotics || statboticsPrimary, tbaFallbackBaseUrl: "", statboticsFallbackBaseUrl: "", scoutingUrl: simulator.scouting };
    if (mode === "fallback") return { mode, tbaBaseUrl: tbaPrimary, statboticsBaseUrl: statboticsPrimary, tbaFallbackBaseUrl: simulator.tba, statboticsFallbackBaseUrl: simulator.statbotics, scoutingUrl: simulator.scouting };
    return { mode: "production", tbaBaseUrl: tbaPrimary, statboticsBaseUrl: statboticsPrimary, tbaFallbackBaseUrl: "", statboticsFallbackBaseUrl: "", scoutingUrl: "" };
  }

  globalThis.ProviderRouting = { readRuntimeConfig, resolveProviderRouting };
})();
