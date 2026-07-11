(function () {
globalThis.SeasonFilters = {
  seasons: {
    "2024": [],
    "2025": [],
    "2026": [
      {
        id: "hasEntry",
        name: "Has Entry",
        formula: "scouting.hasEntry > 0",
        description: "True when a scouting row exists for the team and match.",
      },
    ],
  },
};
})();
