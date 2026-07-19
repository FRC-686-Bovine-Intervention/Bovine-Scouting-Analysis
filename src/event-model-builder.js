(function () {
const seasonFramework = globalThis.SeasonFramework || {};
const providerSeasonMetadata = globalThis.ProviderSeasonMetadata || {};
const scoutingSchemaRuntime = globalThis.ScoutingSchemaRuntime || {};
const priorRidge = globalThis.PriorRidge || {};
const seasonMetadataByYear = providerSeasonMetadata.seasons || seasonFramework.gameDefinitions || {};
const buildMetricCatalog =
  scoutingSchemaRuntime.buildMetricCatalog
  || seasonFramework.buildMetrics
  || ((eventModel) => eventModel?.metrics || []);
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

function normalizeText(value) {
  return String(value || "").trim();
}

function providerPathSegment(segment) {
  return normalizeText(segment);
}

function scalarTbaValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number" || typeof value === "string") return value;
  return null;
}

function flattenTbaScalarEntries(value, prefix = "") {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => flattenTbaScalarEntries(entry, prefix ? `${prefix}.${index}` : String(index)));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, entryValue]) => {
      const segment = providerPathSegment(key);
      if (!segment) return [];
      return flattenTbaScalarEntries(entryValue, prefix ? `${prefix}.${segment}` : segment);
    });
  }
  const scalar = scalarTbaValue(value);
  return prefix && scalar !== null ? [[prefix, scalar]] : [];
}

function flattenStatboticsScalarEntries(value, prefix = "") {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => flattenStatboticsScalarEntries(entry, prefix ? `${prefix}.${index}` : String(index)));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, entryValue]) => {
      const segment = providerPathSegment(key);
      if (!segment) return [];
      return flattenStatboticsScalarEntries(entryValue, prefix ? `${prefix}.${segment}` : segment);
    });
  }
  const scalar = scalarTbaValue(value);
  return prefix && scalar !== null ? [[prefix, scalar]] : [];
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

function sourceValue(team, sourceId, componentId = "total") {
  if (sourceId === "derived") return Number(team.derived?.[componentId] || 0);
  if (componentId === "total") return Number(team.sources?.[sourceId]?.total || 0);
  return Number(team.sources?.[sourceId]?.components?.[componentId] || 0);
}

function buildSeedPicklists(teams) {
  const byEpa = [...teams].sort((a, b) => sourceValue(b, "epa") - sourceValue(a, "epa") || a.number - b.number).map((team) => team.number);
  const byPridge = [...teams]
    .sort((a, b) => {
      const left = sourceValue(a, "pridge");
      const right = sourceValue(b, "pridge");
      if (Number.isFinite(right) && Number.isFinite(left) && right !== left) return right - left;
      return sourceValue(b, "opr") - sourceValue(a, "opr") || a.number - b.number;
    })
    .map((team) => team.number);
  return [
    { id: "pick-first-pick", name: "First Pick", teams: byEpa },
    { id: "pick-backup-live", name: "Backup / Live Sources", teams: byPridge },
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

function parseTeamNumberFromKey(value) {
  return Number(String(value || "").replace("frc", ""));
}

function normalizeQualRecord(record) {
  if (!record || typeof record !== "object") return null;
  return {
    wins: Number(record.wins || 0),
    losses: Number(record.losses || 0),
    ties: Number(record.ties || 0),
  };
}

function buildRankingMap(rankingsPayload) {
  const rankings = Array.isArray(rankingsPayload?.rankings) ? rankingsPayload.rankings : [];
  return new Map(rankings.map((entry) => [parseTeamNumberFromKey(entry?.team_key), entry]));
}

function buildOprMap(oprsPayload) {
  const oprs = oprsPayload?.oprs && typeof oprsPayload.oprs === "object" ? oprsPayload.oprs : {};
  return new Map(Object.entries(oprs).map(([teamKey, value]) => [parseTeamNumberFromKey(teamKey), Number(value || 0)]));
}

function buildTeamStatMap(oprsPayload, key, fieldId) {
  const values = oprsPayload?.[key] && typeof oprsPayload[key] === "object" ? oprsPayload[key] : {};
  return new Map(Object.entries(values).map(([teamKey, value]) => [parseTeamNumberFromKey(teamKey), { fieldId, value: Number(value || 0) }]));
}

function buildTbaEventComponents(rankingEntry, tbaStatEntries = []) {
  const components = {};
  flattenTbaScalarEntries(rankingEntry || {}).forEach(([fieldId, value]) => {
    if (fieldId === "team_key") return;
    components[fieldId] = value;
  });
  tbaStatEntries.forEach((entry) => {
    if (!entry?.fieldId) return;
    components[entry.fieldId] = entry.value;
  });
  return components;
}

function emptySourceComponents(season, fallback = null) {
  return Object.fromEntries(season.scoringComponents.map((component) => [component.id, fallback]));
}

function buildTeam(teamInfo, teamEvent, scoutingSchema, rankingEntry, oprValue, tbaComponents) {
  const epa = Number(teamEvent?.epa?.total_points || 0);
  const breakdown = teamEvent?.epa?.breakdown || {};
  const statboticsComponents = Object.fromEntries(
    flattenStatboticsScalarEntries(teamEvent || {}).filter(([fieldId]) => fieldId !== "team_name" && fieldId !== "event_name"),
  );
  const qualRecord = teamEvent?.record?.qual || {};
  const scouterFields = Array.isArray(scoutingSchema?.scouterMetricDefinitions) ? scoutingSchema.scouterMetricDefinitions : [];
  const emptyScouterComponents = Object.fromEntries(scouterFields.map((component) => [component.id, 0]));
  const opr = Number.isFinite(Number(oprValue)) ? round(oprValue) : round(epa * 1.04);
  const normalizedRankingRecord = normalizeQualRecord(rankingEntry?.record);
  const rankingSortOrders = Array.isArray(rankingEntry?.sort_orders) ? rankingEntry.sort_orders : [];
  const rankingScore = rankingSortOrders.length ? Number(rankingSortOrders[0] || 0) : Number(qualRecord.rps_per_match || 0);
  const stats = teamEvent?.epa?.stats || {};
  const consistency = Math.max(25, Math.min(99, Math.round(100 - Math.abs((Number(stats.max || epa) - Number(stats.mean || epa)) / Math.max(1, Number(stats.mean || epa))) * 65)));
  const defenseImpact = round(Math.max(0, Number(qualRecord.rps_per_match || 0) * 2.2 - Number(teamEvent?.epa?.breakdown?.auto_points || 0) * 0.08));
  return {
    number: Number(teamInfo.team_number),
    name: teamInfo.nickname || teamEvent?.team_name || `Team ${teamInfo.team_number}`,
    drivetrain: "unknown",
    flags: [],
    matches: [],
    eventRank: Number(rankingEntry?.rank || qualRecord.rank || 0) || null,
    record: {
      ...(teamEvent?.record || {}),
      qual: {
        ...(teamEvent?.record?.qual || {}),
        ...(normalizedRankingRecord || {}),
        rank: Number(rankingEntry?.rank || qualRecord.rank || 0) || null,
        rps: rankingScore || null,
        rps_per_match: Number(qualRecord.rps_per_match || 0) || null,
      },
    },
    sources: {
      scouter: { total: 0, components: emptyScouterComponents, trend: [], componentTrend: Object.fromEntries(scouterFields.map((component) => [component.id, []])) },
      epa: { total: round(epa), components: { ...statboticsComponents }, trend: [] },
      tba: { total: null, components: { ...(tbaComponents || {}) }, trend: [] },
      opr: { total: round(opr), components: emptySourceComponents(scoutingSchema, null), trend: [] },
      pridge: { total: null, components: emptySourceComponents(scoutingSchema), trend: [] },
    },
    derived: {
      defenseImpact,
      consistency,
    },
  };
}

function buildEventModelFromPayloads(payload) {
  const season = seasonMetadataByYear[payload.year] || {
    label: `${payload.year} Season`,
    scoringComponents: [],
    breakdownMap: {},
  };
  const explicitScouterMetricDefinitions = Array.isArray(payload?.scouterMetricDefinitions) ? payload.scouterMetricDefinitions : [];
  const explicitFormulaFieldDefinitions = Array.isArray(payload?.formulaFieldDefinitions) ? payload.formulaFieldDefinitions : [];
  const explicitDerivedMetricDefinitions = Array.isArray(payload?.derivedMetricDefinitions) ? payload.derivedMetricDefinitions : [];
  const scoutingSchemaSeed = {
    scoringComponents: season.scoringComponents || [],
    breakdownMap: season.breakdownMap || {},
    scouterMetricDefinitions: explicitScouterMetricDefinitions,
    formulaFieldDefinitions: explicitFormulaFieldDefinitions,
    derivedMetricDefinitions: explicitDerivedMetricDefinitions,
    scoringMatrixPresets: Array.isArray(payload?.scoringMatrixPresets) ? payload.scoringMatrixPresets : [],
  };
  const teamEventsByNumber = new Map((payload.statboticsTeamEvents || []).map((teamEvent) => [Number(teamEvent.team), teamEvent]));
  const rankingsByTeamNumber = buildRankingMap(payload.tbaRankings);
  const oprByTeamNumber = buildOprMap(payload.tbaOprs);
  const dprByTeamNumber = buildTeamStatMap(payload.tbaOprs, "dprs", "dpr.total");
  const ccwmByTeamNumber = buildTeamStatMap(payload.tbaOprs, "ccwms", "ccwm.total");
  const teams = (payload.tbaTeams || [])
    .map((teamInfo) => {
      const teamNumber = Number(teamInfo.team_number);
      return buildTeam(
        teamInfo,
        teamEventsByNumber.get(teamNumber) || {},
        scoutingSchemaSeed,
        rankingsByTeamNumber.get(teamNumber) || null,
        oprByTeamNumber.get(teamNumber),
        buildTbaEventComponents(rankingsByTeamNumber.get(teamNumber) || null, [
          { fieldId: "opr.total", value: oprByTeamNumber.get(teamNumber) },
          dprByTeamNumber.get(teamNumber),
          ccwmByTeamNumber.get(teamNumber),
        ].filter((entry) => entry && Number.isFinite(Number(entry.value)))),
      );
    })
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
    breakdownMap: season.breakdownMap || {},
    matchesComplete: matches.length,
    matches,
    scoringComponents: season.scoringComponents,
    scoringMatrixPresets: scoutingSchemaSeed.scoringMatrixPresets || [],
    scouterMetricDefinitions: explicitScouterMetricDefinitions,
    formulaFieldDefinitions: explicitFormulaFieldDefinitions,
    derivedMetricDefinitions: explicitDerivedMetricDefinitions,
    metrics: buildMetricCatalog(scoutingSchemaSeed),
    teams: teamsWithPridge,
    teamNumbers: teamsWithPridge.map((team) => team.number),
    defaultMetricId: "",
    defaultTeamDetailMetricId: "",
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
    seedPicklists: buildSeedPicklists(teamsWithPridge),
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
    tbaRankings: parseJson(snapshot.tbaRankingsText, {}),
    tbaOprs: parseJson(snapshot.tbaOprsText, {}),
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
    tbaRankings: bundle.tbaRankings || {},
    tbaOprs: bundle.tbaOprs || {},
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
