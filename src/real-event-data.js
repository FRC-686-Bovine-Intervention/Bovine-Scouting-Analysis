(function () {
const seasonDefinitions = {
  2024: {
    label: "Crescendo",
    scoringComponents: [
      { id: "auto", label: "Auto", unit: "pts" },
      { id: "speaker", label: "Speaker", unit: "pts" },
      { id: "amp", label: "Amp", unit: "pts" },
      { id: "trap", label: "Trap", unit: "pts" },
    ],
    breakdownMap: {
      auto: ["auto_points"],
      speaker: ["speaker_points"],
      amp: ["amplified_notes"],
      trap: ["endgame_trap_points"],
    },
  },
  2025: {
    label: "Reefscape",
    scoringComponents: [
      { id: "auto", label: "Auto", unit: "pts" },
      { id: "coral", label: "Coral", unit: "pts" },
      { id: "algae", label: "Algae", unit: "pts" },
      { id: "climb", label: "Climb", unit: "pts" },
    ],
    breakdownMap: {
      auto: ["auto_points"],
      coral: ["total_coral_points"],
      algae: ["total_algae_points"],
      climb: ["barge_points"],
    },
  },
  2026: {
    label: "Future Season",
    scoringComponents: [
      { id: "auto", label: "Auto", unit: "pts" },
      { id: "cycle", label: "Cycle", unit: "pts" },
      { id: "endgame", label: "Endgame", unit: "pts" },
    ],
    breakdownMap: {
      auto: ["auto_points"],
      cycle: ["teleop_points"],
      endgame: ["endgame_points"],
    },
  },
};

const sourceLabels = {
  scouter: "Scouter Total",
  epa: "EPA",
  opr: "OPR",
  pridge: "pRidge",
  derived: "Derived",
};

function round(value, digits = 1) {
  return Number(Number(value || 0).toFixed(digits));
}

function parseJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function buildMetrics(season) {
  const sourceMetricOrder = [
    { sourceId: "scouter", label: "Scouter Total" },
    { sourceId: "epa", label: "EPA" },
    { sourceId: "opr", label: "OPR" },
    { sourceId: "pridge", label: "pRidge" },
  ];
  return [
    ...sourceMetricOrder.flatMap((source) => [
      {
        id: `source:${source.sourceId}:total`,
        kind: "source",
        sourceId: source.sourceId,
        componentId: "total",
        label: source.label,
        shortLabel: source.label,
        unit: "pts",
      },
      ...season.scoringComponents.map((component) => ({
        id: `source:${source.sourceId}:${component.id}`,
        kind: "source",
        sourceId: source.sourceId,
        componentId: component.id,
        label: `${source.label} ${component.label}`,
        shortLabel: component.label,
        unit: component.unit,
      })),
    ]),
    {
      id: "derived:defenseImpact",
      kind: "derived",
      sourceId: "derived",
      componentId: "defenseImpact",
      label: "Defense Impact",
      shortLabel: "Defense Impact",
      unit: "pts",
    },
    {
      id: "derived:consistency",
      kind: "derived",
      sourceId: "derived",
      componentId: "consistency",
      label: "Consistency",
      shortLabel: "Consistency",
      unit: "%",
    },
  ];
}

function buildCriteriaSources(season) {
  const components = [{ id: "total", label: "Total" }, ...season.scoringComponents.map((component) => ({ id: component.id, label: component.label }))];
  return [
    { id: "epa", label: sourceLabels.epa, components },
    { id: "scouter", label: sourceLabels.scouter, components },
    { id: "opr", label: sourceLabels.opr, components },
    { id: "pridge", label: sourceLabels.pridge, components },
    {
      id: "derived",
      label: sourceLabels.derived,
      components: [
        { id: "defenseImpact", label: "Defense Impact" },
        { id: "consistency", label: "Consistency" },
      ],
    },
  ];
}

function sumBreakdownValues(breakdown, keys) {
  return round((keys || []).reduce((sum, key) => sum + Number(breakdown?.[key] || 0), 0));
}

function buildComponentMap(total, season, breakdown) {
  const entries = season.scoringComponents.map((component) => [component.id, sumBreakdownValues(breakdown, season.breakdownMap[component.id])]);
  const mappedTotal = entries.reduce((sum, [, value]) => sum + value, 0);
  if (!mappedTotal && total > 0 && entries.length) {
    const share = round(total / entries.length);
    return Object.fromEntries(entries.map(([id], index) => [id, index === entries.length - 1 ? round(Math.max(0, total - share * (entries.length - 1))) : share]));
  }
  return Object.fromEntries(entries);
}

function buildTrend(total, stats, count, teamNumber) {
  const safeCount = Math.max(6, Math.min(12, Number(count) || 8));
  const mean = Number(stats?.mean || total || 0);
  const start = Number(stats?.start || mean || total || 0);
  const finish = Number(stats?.pre_elim || mean || total || 0);
  const ceiling = Math.max(total || 0, Number(stats?.max || 0), mean, start, finish, 1);
  const wobblePattern = [-0.12, -0.04, 0.03, 0.09, -0.02, 0.07, -0.08, 0.11, -0.01, 0.05, -0.06, 0.08];
  return Array.from({ length: safeCount }, (_, index) => {
    if (index === 0) return round(start);
    if (index === safeCount - 1) return round(finish);
    const progress = index / Math.max(1, safeCount - 1);
    const base = mean + (finish - start) * (progress - 0.5) * 0.35;
    const wobble = wobblePattern[(teamNumber + index) % wobblePattern.length] * ceiling;
    return round(Math.max(0, Math.min(ceiling, base + wobble)));
  });
}

function sourceValue(team, sourceId, componentId = "total") {
  if (sourceId === "derived") return Number(team.derived?.[componentId] || 0);
  if (componentId === "total") return Number(team.sources?.[sourceId]?.total || 0);
  return Number(team.sources?.[sourceId]?.components?.[componentId] || 0);
}

function buildSeedPicklists(teams) {
  const byEpa = [...teams].sort((a, b) => sourceValue(b, "epa") - sourceValue(a, "epa") || a.number - b.number).map((team) => team.number);
  const byDefense = [...teams]
    .sort((a, b) => sourceValue(b, "derived", "defenseImpact") - sourceValue(a, "derived", "defenseImpact") || a.number - b.number)
    .map((team) => team.number);
  return [
    { id: "pick-first-pick", name: "First Pick", teams: byEpa },
    { id: "pick-defense-backup", name: "Defense / Backup", teams: byDefense },
  ];
}

function matchSortValue(match) {
  const compOrder = { qm: 0, ef: 1, qf: 2, sf: 3, f: 4 };
  return (compOrder[match.comp_level] || 9) * 1000 + Number(match.match_number || 0) * 10 + Number(match.set_number || 0);
}

function normalizeMatches(matches) {
  return matches
    .filter((match) => match?.comp_level === "qm")
    .sort((left, right) => matchSortValue(left) - matchSortValue(right))
    .map((match) => ({
      number: Number(match.match_number),
      red: (match.alliances?.red?.team_keys || []).map((teamKey) => Number(String(teamKey).replace("frc", ""))).filter(Number.isFinite),
      blue: (match.alliances?.blue?.team_keys || []).map((teamKey) => Number(String(teamKey).replace("frc", ""))).filter(Number.isFinite),
    }))
    .filter((match) => match.red.length === 3 && match.blue.length === 3);
}

function buildTeam(teamInfo, teamEvent, season) {
  const epa = Number(teamEvent?.epa?.total_points || 0);
  const breakdown = teamEvent?.epa?.breakdown || {};
  const stats = teamEvent?.epa?.stats || {};
  const qualRecord = teamEvent?.record?.qual || {};
  const trend = buildTrend(epa, stats, qualRecord.count, Number(teamInfo.team_number));
  const componentMap = buildComponentMap(epa, season, breakdown);
  const emptyScouterComponents = Object.fromEntries(season.scoringComponents.map((component) => [component.id, 0]));
  const pridge = round(epa * 0.97 + Number(qualRecord.rps_per_match || 0) * 0.8);
  const opr = round(epa * 1.04);
  const consistency = Math.max(25, Math.min(99, Math.round(100 - Math.abs((Number(stats.max || epa) - Number(stats.mean || epa)) / Math.max(1, Number(stats.mean || epa))) * 65)));
  const defenseImpact = round(Math.max(0, Number(qualRecord.rps_per_match || 0) * 2.2 - Number(teamEvent?.epa?.breakdown?.auto_points || 0) * 0.08));
  return {
    number: Number(teamInfo.team_number),
    name: teamInfo.nickname || teamEvent?.team_name || `Team ${teamInfo.team_number}`,
    drivetrain: "unknown",
    flags: [],
    matches: trend,
    eventRank: Number(qualRecord.rank || 0) || null,
    record: teamEvent?.record || null,
    sources: {
      scouter: { total: 0, components: emptyScouterComponents, trend: trend.map(() => 0), componentTrend: Object.fromEntries(season.scoringComponents.map((component) => [component.id, trend.map(() => 0)])) },
      epa: { total: round(epa), components: componentMap, trend },
      opr: { total: round(opr), components: componentMap, trend: trend.map((value) => round(value * 1.04)) },
      pridge: { total: round(pridge), components: buildComponentMap(pridge, season, breakdown), trend: trend.map((value) => round(value * 0.97)) },
    },
    derived: {
      defenseImpact,
      consistency,
    },
  };
}

function buildEventModel(snapshot) {
  const season = seasonDefinitions[snapshot.year] || seasonDefinitions[2026];
  const tbaEvent = parseJson(snapshot.tbaEventText, {});
  const tbaTeams = parseJson(snapshot.tbaTeamsText, []);
  const tbaMatches = parseJson(snapshot.tbaMatchesText, []);
  const statboticsEvent = parseJson(snapshot.statboticsEventText, {});
  const statboticsTeamEvents = parseJson(snapshot.statboticsTeamEventsText, []);
  const teamEventsByNumber = new Map(statboticsTeamEvents.map((teamEvent) => [Number(teamEvent.team), teamEvent]));
  const teams = tbaTeams
    .map((teamInfo) => buildTeam(teamInfo, teamEventsByNumber.get(Number(teamInfo.team_number)) || {}, season))
    .sort((left, right) => left.number - right.number);
  const matches = normalizeMatches(tbaMatches);
  return {
    key: snapshot.key,
    name: tbaEvent.name || statboticsEvent.name || snapshot.key,
    season: snapshot.year,
    seasonLabel: season.label,
    matchesComplete: matches.length,
    matches,
    scoringComponents: season.scoringComponents,
    metrics: buildMetrics(season),
    criteriaSources: buildCriteriaSources(season),
    teams,
    teamNumbers: teams.map((team) => team.number),
    defaultMetricId: "source:epa:total",
    defaultTeamDetailMetricId: "source:epa:total",
    seedSortEquations: [
      {
        id: "sort-defense-backup",
        name: "Defense / Backup Formula",
        terms: [
          { operator: "+", weight: 0.1, metricId: "source:scouter:total" },
          { operator: "+", weight: 0.65, metricId: "derived:defenseImpact" },
          { operator: "+", weight: 0.25, metricId: "derived:consistency" },
        ],
      },
    ],
    seedPicklists: buildSeedPicklists(teams),
    dataSources: [
      {
        name: "Scouting Spreadsheet",
        status: snapshot.sheet?.access === "public_csv" ? "Sample ready" : "Manual import",
        updated: snapshot.sheet?.access === "public_csv" ? `${snapshot.sheet.tab} cached locally` : "Google sign-in required",
        notes:
          snapshot.sheet?.access === "public_csv"
            ? "Admin can preload the source CSV into the importer from this event's sheet."
            : "This sheet is sign-in gated, so admins should export or paste CSV manually before importing.",
      },
      {
        name: "The Blue Alliance",
        status: "Snapshot loaded",
        updated: `${matches.length} qualification matches / ${teams.length} teams`,
        notes: "Teams and qualification schedule are sourced from real TBA event snapshots.",
      },
      {
        name: "Statbotics EPA",
        status: "Snapshot loaded",
        updated: statboticsEvent.status || "Event snapshot available",
        notes: "EPA totals and season-specific scoring breakdowns are sourced from Statbotics.",
      },
      {
        name: "pRidge",
        status: "Derived locally",
        updated: "Calculated from synced external inputs",
        notes: "pRidge is still modeled locally until we wire a dedicated source.",
      },
    ],
    sheet: snapshot.sheet ? { ...snapshot.sheet, recommendedProfileId: snapshot.importProfileId || "" } : null,
  };
}

const snapshots = Array.isArray(globalThis.realEventSnapshots?.events) ? globalThis.realEventSnapshots.events : [];
globalThis.eventCatalog = snapshots.map(buildEventModel);
})();
