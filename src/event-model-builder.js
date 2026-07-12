(function () {
const seasonFramework = globalThis.SeasonFramework || {};
const priorRidge = globalThis.PriorRidge || {};
const seasonDefinitions = seasonFramework.seasonDefinitions || {};
const buildMetrics = seasonFramework.buildMetrics;
const buildCriteriaSources = seasonFramework.buildCriteriaSources;
const scouterMetricDefinitions = seasonFramework.scouterMetricDefinitions || ((season) => season?.scoringComponents || []);
const formulaFieldDefinitions = seasonFramework.formulaFieldDefinitions || scouterMetricDefinitions;
const derivedMetricDefinitions = seasonFramework.derivedMetricDefinitions || ((season) => season?.derivedMetrics || []);
const computeEventPridge = priorRidge.computeEventPridge;

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

function cloneBreakdown(breakdown) {
  if (!breakdown || typeof breakdown !== "object") return null;
  return Object.fromEntries(Object.entries(breakdown));
}

function normalizeMatches(matches) {
  return matches
    .filter((match) => match?.comp_level === "qm")
    .sort((left, right) => matchSortValue(left) - matchSortValue(right))
    .map((match) => ({
      number: Number(match.match_number),
      red: (match.alliances?.red?.team_keys || []).map((teamKey) => Number(String(teamKey).replace("frc", ""))).filter(Number.isFinite),
      blue: (match.alliances?.blue?.team_keys || []).map((teamKey) => Number(String(teamKey).replace("frc", ""))).filter(Number.isFinite),
      redScore: Number(match.alliances?.red?.score || 0),
      blueScore: Number(match.alliances?.blue?.score || 0),
      winningAlliance: match.winning_alliance || "",
      scoreBreakdown: match.score_breakdown
        ? {
            red: cloneBreakdown(match.score_breakdown.red),
            blue: cloneBreakdown(match.score_breakdown.blue),
          }
        : null,
    }))
    .filter((match) => match.red.length === 3 && match.blue.length === 3);
}

function emptySourceComponents(season, fallback = null) {
  return Object.fromEntries(season.scoringComponents.map((component) => [component.id, fallback]));
}

function buildTeam(teamInfo, teamEvent, season) {
  const epa = Number(teamEvent?.epa?.total_points || 0);
  const breakdown = teamEvent?.epa?.breakdown || {};
  const stats = teamEvent?.epa?.stats || {};
  const qualRecord = teamEvent?.record?.qual || {};
  const trend = buildTrend(epa, stats, qualRecord.count, Number(teamInfo.team_number));
  const componentMap = buildComponentMap(epa, season, breakdown);
  const emptyScouterComponents = Object.fromEntries(scouterMetricDefinitions(season).map((component) => [component.id, 0]));
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
      scouter: { total: 0, components: emptyScouterComponents, trend: trend.map(() => 0), componentTrend: Object.fromEntries(scouterMetricDefinitions(season).map((component) => [component.id, trend.map(() => 0)])) },
      epa: { total: round(epa), components: componentMap, trend },
      opr: { total: round(opr), components: componentMap, trend: trend.map((value) => round(value * 1.04)) },
      pridge: { total: null, components: emptySourceComponents(season), trend: [] },
    },
    derived: {
      defenseImpact,
      consistency,
    },
  };
}

function buildEventModelFromPayloads(payload) {
  const season = seasonDefinitions[payload.year] || seasonDefinitions[2026];
  const teamEventsByNumber = new Map((payload.statboticsTeamEvents || []).map((teamEvent) => [Number(teamEvent.team), teamEvent]));
  const teams = (payload.tbaTeams || [])
    .map((teamInfo) => buildTeam(teamInfo, teamEventsByNumber.get(Number(teamInfo.team_number)) || {}, season))
    .sort((left, right) => left.number - right.number);
  const matches = normalizeMatches(payload.tbaMatches || []);
  let pridgeResult = null;
  let pridgeError = "";
  if (typeof computeEventPridge === "function" && matches.length && (payload.statboticsTeamEvents || []).length) {
    try {
      pridgeResult = computeEventPridge(payload.tbaMatches || [], payload.statboticsTeamEvents || [], {
        responseName: "score",
        digits: 1,
      });
    } catch (error) {
      pridgeError = String(error?.message || "Unable to compute pRidge.");
    }
  }
  const teamsWithPridge = teams.map((team) => {
    const total = pridgeResult?.ratings?.[team.number] ?? null;
    return {
      ...team,
      sources: {
        ...team.sources,
        pridge: {
          total,
          components: emptySourceComponents(season),
          trend: [],
        },
      },
    };
  });
  return {
    key: payload.key,
    name: payload.tbaEvent?.name || payload.statboticsEvent?.name || payload.key,
    season: payload.year,
    seasonLabel: season.label,
    matchesComplete: matches.length,
    matches,
    scoringComponents: season.scoringComponents,
    scouterMetricDefinitions: scouterMetricDefinitions(season),
    formulaFieldDefinitions: formulaFieldDefinitions(season),
    derivedMetricDefinitions: derivedMetricDefinitions(season),
    metrics: buildMetrics(season),
    criteriaSources: buildCriteriaSources(season),
    teams: teamsWithPridge,
    teamNumbers: teamsWithPridge.map((team) => team.number),
    defaultMetricId: "source:epa:total",
    defaultTeamDetailMetricId: "source:epa:total",
    seedSortEquations: [
      {
        id: "sort-defense-backup",
        name: "Defense / Backup Formula",
        terms: [
          { operator: "+", weight: 0.65, metricId: "derived:defenseImpact" },
          { operator: "+", weight: 0.25, metricId: "derived:consistency" },
        ],
      },
    ],
    seedPicklists: buildSeedPicklists(teams),
    dataSources: [
      {
        name: "Scouting Spreadsheet",
        status: payload.sheet?.access === "public_csv" ? "Sample ready" : "Manual import",
        updated: payload.sheet?.access === "public_csv" ? `${payload.sheet.tab} cached locally` : "Google sign-in required",
        notes:
          payload.sheet?.access === "public_csv"
            ? "Admin can preload the source CSV into the importer from this event's sheet."
            : "This sheet is sign-in gated, so admins should export or paste CSV manually before importing.",
      },
      {
        name: "The Blue Alliance",
        status: "Snapshot loaded",
        updated: `${matches.length} qualification matches / ${teamsWithPridge.length} teams`,
        notes: "Teams and qualification schedule are sourced from real TBA event snapshots.",
      },
      {
        name: "Statbotics EPA",
        status: "Snapshot loaded",
        updated: payload.statboticsEvent?.status || "Event snapshot available",
        notes: "EPA totals and season-specific scoring breakdowns are sourced from Statbotics.",
      },
      {
        name: "pRidge",
        status: pridgeResult ? "Computed locally" : "Unavailable",
        updated: pridgeResult ? `Lambda ${round(pridgeResult.lambda, 3)} over ${pridgeResult.matchCount} qual matches` : "Requires complete TBA + Statbotics event payloads",
        notes: pridgeResult
          ? "Event-total pRidge was computed locally from TBA qualification scores and Statbotics start EPA priors."
          : (pridgeError || "pRidge could not be computed from the available event payloads."),
      },
    ],
    sheet: payload.sheet ? { ...payload.sheet, recommendedProfileId: payload.importProfileId || "" } : null,
    catalogSource: payload.catalogSource || "snapshot",
  };
}

function buildEventModelFromSnapshot(snapshot) {
  return buildEventModelFromPayloads({
    key: snapshot.key,
    year: snapshot.year,
    importProfileId: snapshot.importProfileId || "",
    sheet: snapshot.sheet || null,
    tbaEvent: parseJson(snapshot.tbaEventText, {}),
    tbaTeams: parseJson(snapshot.tbaTeamsText, []),
    tbaMatches: parseJson(snapshot.tbaMatchesText, []),
    statboticsEvent: parseJson(snapshot.statboticsEventText, {}),
    statboticsTeamEvents: parseJson(snapshot.statboticsTeamEventsText, []),
    catalogSource: snapshot.catalogSource || "snapshot",
  });
}

function buildEventModelFromProviderBundle(bundle) {
  return buildEventModelFromPayloads({
    key: bundle.key,
    year: Number(bundle.year || 0),
    importProfileId: bundle.importProfileId || "",
    sheet: bundle.sheet || null,
    tbaEvent: bundle.tbaEvent || {},
    tbaTeams: bundle.tbaTeams || [],
    tbaMatches: bundle.tbaMatches || [],
    statboticsEvent: bundle.statboticsEvent || {},
    statboticsTeamEvents: bundle.statboticsTeamEvents || [],
    catalogSource: bundle.catalogSource || "dynamic-external",
  });
}

globalThis.EventModelBuilder = {
  buildEventModelFromProviderBundle,
  buildEventModelFromSnapshot,
};
})();
