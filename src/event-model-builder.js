(function () {
const seasonFramework = globalThis.SeasonFramework || {};
const scoutingSchemaRuntime = globalThis.ScoutingSchemaRuntime || {};
const priorRidge = globalThis.PriorRidge || {};
const buildMetricCatalog =
  scoutingSchemaRuntime.buildMetricCatalog
  || seasonFramework.buildMetrics
  || ((eventModel) => eventModel?.metrics || []);
const computeEventPridge = priorRidge.computeEventPridge;
const PRIDGE_RESPONSE_IDS = new Set([
  "tbaTotalAutoPoints",
  "tbaTotalTeleopPoints",
  "tbaTotalEndgamePoints",
  "epa.total_points",
  "epa.breakdown.total_points",
  "epa.breakdown.auto_points",
  "epa.breakdown.teleop_points",
  "epa.breakdown.endgame_points",
]);

const PRIDGE_EPA_RESPONSE_CANDIDATES = [
  ["epa.total_points", ["totalPoints"]],
  ["epa.breakdown.total_points", ["totalPoints"]],
  ["epa.breakdown.auto_points", ["totalAutoPoints", "autoPoints"]],
  ["epa.breakdown.teleop_points", ["totalTeleopPoints", "teleopPoints"]],
  ["epa.breakdown.endgame_points", ["endGameTowerPoints", "endGameBargePoints", "endGamePoints", "endgamePoints"]],
];

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

function normalizePridgeResponseDefinitions(payload) {
  const definitions = [
    ...(Array.isArray(payload?.pridgeResponseDefinitions) ? payload.pridgeResponseDefinitions : []),
    ...(Array.isArray(payload?.formulaFieldDefinitions) ? payload.formulaFieldDefinitions : []),
  ];
  const seen = new Set();
  return definitions.filter((definition) => {
    const id = normalizeText(definition?.id);
    const formula = normalizeText(definition?.formula);
    if (!PRIDGE_RESPONSE_IDS.has(id) || !formula || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).map((definition) => ({
    ...definition,
    id: normalizeText(definition.id),
    label: normalizeText(definition.label) || normalizeText(definition.id),
    unit: normalizeText(definition.unit) || "pts",
    formula: normalizeText(definition.formula),
  }));
}

function buildLivePridgeEpaResponseDefinitions(rawMatches) {
  const qualificationMatches = (Array.isArray(rawMatches) ? rawMatches : [])
    .filter((match) => match?.comp_level === "qm");
  return PRIDGE_EPA_RESPONSE_CANDIDATES.flatMap(([id, candidates]) => {
    const field = candidates.find((candidate) => qualificationMatches.some((match) => {
      const values = [match?.score_breakdown?.red?.[candidate], match?.score_breakdown?.blue?.[candidate]];
      return values.some((value) => Number.isFinite(Number(value)));
    }));
    if (!field && id === "epa.total_points") {
      return [{ id, label: "pRidge EPA total points", unit: "pts", formula: "tba.totalPoints" }];
    }
    if (!field && id === "epa.breakdown.total_points") {
      return [{ id, label: "pRidge EPA breakdown total points", unit: "pts", formula: "tba.totalPoints" }];
    }
    return field ? [{ id, label: `pRidge ${id.replace("epa.", "EPA ").replaceAll(".", " ")}`, unit: "pts", formula: `tba.${field}` }] : [];
  });
}

function mergePridgeResponseDefinitions(rawMatches, definitions) {
  const merged = [...(Array.isArray(definitions) ? definitions : []), ...buildLivePridgeEpaResponseDefinitions(rawMatches)];
  const seen = new Set();
  return merged.filter((definition) => {
    const id = normalizeText(definition?.id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function readPath(source, path) {
  return String(path || "").split(".").reduce((value, segment) => {
    if (value === null || value === undefined || !segment) return undefined;
    return value[segment];
  }, source);
}

function evaluateAllianceFormula(formula, breakdown) {
  const metricEngine = globalThis.MetricEngine || {};
  if (typeof metricEngine.evaluateFormulaExpression !== "function") return null;
  const result = metricEngine.evaluateFormulaExpression(formula, {
    resolveIdentifier(identifier) {
      const name = normalizeText(identifier);
      if (!name.startsWith("tba.")) return metricEngine.errorResult?.(`Only tba.* fields are available in pRidge response formulas.`);
      const value = readPath(breakdown, name.slice(4));
      if (value === null || value === undefined || value === "") return metricEngine.errorResult?.(`TBA field ${name} is unavailable.`);
      const numericValue = Number(value);
      return Number.isFinite(numericValue)
        ? metricEngine.scalarResult(numericValue, "match")
        : metricEngine.errorResult?.(`TBA field ${name} is not numeric.`);
    },
  });
  const value = Number(result?.value);
  return result?.kind === "error" || !Number.isFinite(value) ? null : value;
}

function buildFormulaMatches(rawMatches, definition) {
  return rawMatches.map((match) => {
    const redScore = evaluateAllianceFormula(definition.formula, match.score_breakdown?.red);
    const blueScore = evaluateAllianceFormula(definition.formula, match.score_breakdown?.blue);
    if (!Number.isFinite(redScore) || !Number.isFinite(blueScore)) return null;
    return {
      ...match,
      alliances: {
        ...match.alliances,
        red: { ...match.alliances?.red, score: redScore },
        blue: { ...match.alliances?.blue, score: blueScore },
      },
    };
  }).filter(Boolean);
}

function rawMatchesFromEventModel(eventModel = {}) {
  return (eventModel.matches || []).filter((match) => (match?.compLevel || "qm") === "qm").map((match) => ({
    comp_level: "qm",
    match_number: match.number,
    alliances: {
      red: { team_keys: (match.red || []).map((team) => `frc${team}`), score: match.redScore },
      blue: { team_keys: (match.blue || []).map((team) => `frc${team}`), score: match.blueScore },
    },
    score_breakdown: {
      red: cloneBreakdown(match.scoreBreakdown?.red),
      blue: cloneBreakdown(match.scoreBreakdown?.blue),
    },
  }));
}

function teamEventsFromEventModel(eventModel = {}) {
  return (eventModel.teams || []).map((team) => ({
    team: team.number,
    epa: { stats: { start: team.sources?.statbotics?.components?.["epa.stats.start"] } },
  }));
}

function applyPridgeResponseDefinitions(eventModel = {}, definitions = [], options = {}) {
  const normalizedDefinitions = normalizePridgeResponseDefinitions({ pridgeResponseDefinitions: definitions });
  const rawMatches = rawMatchesFromEventModel(eventModel);
  const teamEvents = teamEventsFromEventModel(eventModel);
  const results = {};
  const shouldCompute = !eventModel.pridgeComputationDeferred || options.force === true;
  let totalResults = {};
  if (shouldCompute && options.force === true && typeof computeEventPridge === "function") {
    try {
      totalResults = computeEventPridge(rawMatches, teamEvents, { responseName: "score", digits: 1 }).ratings || {};
    } catch {
      totalResults = {};
    }
  }
  if (shouldCompute) normalizedDefinitions.forEach((definition) => {
    try {
      const formulaMatches = buildFormulaMatches(rawMatches, definition);
      if (formulaMatches.length) {
        results[definition.id] = computeEventPridge(formulaMatches, teamEvents, { responseName: "score", digits: 1 });
      }
    } catch {
      // Keep the response unavailable when the active event lacks required live inputs.
    }
  });
  return {
    ...eventModel,
    pridgeComputationDeferred: shouldCompute ? false : eventModel.pridgeComputationDeferred === true,
    pridgeResponseDefinitions: normalizedDefinitions,
    teams: (eventModel.teams || []).map((team) => ({
      ...team,
      sources: {
        ...team.sources,
        pridge: {
          ...(team.sources?.pridge || {}),
          total: Number.isFinite(Number(totalResults[team.number]))
            ? totalResults[team.number]
            : team.sources?.pridge?.total ?? null,
          components: Object.fromEntries(normalizedDefinitions.map((definition) => [
            definition.id,
            results[definition.id]?.ratings?.[team.number] ?? null,
          ])),
        },
      },
    })),
    metrics: buildMetricCatalog({ ...eventModel, pridgeResponseDefinitions: normalizedDefinitions }),
  };
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

function statboticsMatchNumber(match) {
  const direct = Number(match?.match_number ?? match?.matchNumber);
  if (Number.isFinite(direct)) return direct;
  const key = String(match?.match || match?.match_key || match?.key || "");
  const suffix = key.match(/_(?:qm|ef|qf|sf|f)(?:\d+m)?(\d+)$/i);
  return suffix ? Number(suffix[1]) : null;
}

function statboticsMatchEpa(match) {
  const candidates = [
    match?.epa?.post,
    match?.epa?.total_points,
    match?.epa?.total,
    match?.epa,
  ];
  return candidates.map((value) => Number(value)).find((value) => Number.isFinite(value)) ?? null;
}

function statboticsMatchLevel(match) {
  const explicit = String(match?.comp_level || "").toLowerCase();
  if (explicit) return explicit;
  const key = String(match?.match || match?.match_key || match?.key || "");
  return key.match(/_(qm|ef|qf|sf|f)\d+(?:m\d+)?$/i)?.[1].toLowerCase() || "";
}

function buildStatboticsTrendEntries(teamMatches) {
  return (Array.isArray(teamMatches) ? teamMatches : [])
    .map((match) => ({ matchNumber: statboticsMatchNumber(match), value: statboticsMatchEpa(match) }))
    .filter((entry) => Number.isFinite(entry.matchNumber) && Number.isFinite(entry.value))
    .sort((left, right) => left.matchNumber - right.matchNumber)
    .map((entry) => ({ key: entry.matchNumber, value: entry.value }));
}

function sourceValue(team, sourceId, componentId = "total") {
  if (sourceId === "derived") return Number(team.derived?.[componentId] || 0);
  if (componentId === "total") return Number(team.sources?.[sourceId]?.total || 0);
  return Number(team.sources?.[sourceId]?.components?.[componentId] || 0);
}

function tbaComponentValue(team, componentId) {
  return Number(team.sources?.tba?.components?.[componentId] || 0);
}

function buildSeedPicklists(teams) {
  const byStatbotics = [...teams]
    .sort((a, b) => sourceValue(b, "statbotics") - sourceValue(a, "statbotics") || a.number - b.number)
    .map((team) => team.number);
  const byPridge = [...teams]
    .sort((a, b) => {
      const left = sourceValue(a, "pridge");
      const right = sourceValue(b, "pridge");
      if (Number.isFinite(right) && Number.isFinite(left) && right !== left) return right - left;
      return tbaComponentValue(b, "opr.total") - tbaComponentValue(a, "opr.total") || a.number - b.number;
    })
    .map((team) => team.number);
  return [
    { id: "pick-first-pick", name: "First Pick", teams: byStatbotics },
    { id: "pick-backup-live", name: "Backup / Live Sources", teams: byPridge },
  ];
}

function matchSortValue(match) {
  const compOrder = { qm: 0, ef: 1, qf: 2, sf: 3, f: 4 };
  return (compOrder[match.comp_level] ?? 9) * 1000 + Number(match.match_number || 0) * 10 + Number(match.set_number || 0);
}

function cloneBreakdown(breakdown) {
  if (!breakdown || typeof breakdown !== "object") return null;
  return Object.fromEntries(Object.entries(breakdown));
}

function normalizeMatches(matches) {
  const supportedLevels = new Set(["qm", "ef", "qf", "sf", "f"]);
  return matches
    .filter((match) => supportedLevels.has(String(match?.comp_level || "").toLowerCase()))
    .sort((left, right) => matchSortValue(left) - matchSortValue(right))
    .map((match) => ({
      id: String(match.key || `${match.comp_level || "qm"}-${match.set_number || 0}-${match.match_number || 0}`),
      compLevel: String(match.comp_level || "qm").toLowerCase(),
      setNumber: Number(match.set_number) || 0,
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

function buildRankingMap(rankingsPayload) {
  const rankings = Array.isArray(rankingsPayload?.rankings) ? rankingsPayload.rankings : [];
  return new Map(rankings.map((entry) => [parseTeamNumberFromKey(entry?.team_key), entry]));
}

function buildTbaTeamValueMap(teamStatsPayload, key) {
  const values = teamStatsPayload?.[key] && typeof teamStatsPayload[key] === "object" ? teamStatsPayload[key] : {};
  return new Map(Object.entries(values).map(([teamKey, value]) => [parseTeamNumberFromKey(teamKey), Number(value || 0)]));
}

function buildTbaTeamStatEntries(teamStatsPayload, teamNumber) {
  const teamValueMaps = [
    { fieldId: "opr.total", valuesByTeamNumber: buildTbaTeamValueMap(teamStatsPayload, "oprs") },
    { fieldId: "dpr.total", valuesByTeamNumber: buildTbaTeamValueMap(teamStatsPayload, "dprs") },
    { fieldId: "ccwm.total", valuesByTeamNumber: buildTbaTeamValueMap(teamStatsPayload, "ccwms") },
  ];
  return teamValueMaps
    .map(({ fieldId, valuesByTeamNumber }) => {
      const value = valuesByTeamNumber.get(teamNumber);
      return Number.isFinite(Number(value)) ? { fieldId, value: Number(value) } : null;
    })
    .filter(Boolean);
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

function buildTeam(teamInfo, teamEvent, scoutingSchema, tbaComponents, teamMatches = []) {
  const statboticsTotal = Number(teamEvent?.epa?.total_points || 0);
  const statboticsComponents = Object.fromEntries(
    flattenStatboticsScalarEntries(teamEvent || {}).filter(([fieldId]) => fieldId !== "team_name" && fieldId !== "event_name"),
  );
  const scouterFields = Array.isArray(scoutingSchema?.scouterMetricDefinitions) ? scoutingSchema.scouterMetricDefinitions : [];
  const emptyScouterComponents = Object.fromEntries(scouterFields.map((component) => [component.id, 0]));
  const statboticsTrendEntries = buildStatboticsTrendEntries(teamMatches.filter((match) => statboticsMatchLevel(match) === "qm"));
  const statboticsPlayoffTrendEntries = buildStatboticsTrendEntries(teamMatches.filter((match) => ["ef", "qf", "sf", "f"].includes(statboticsMatchLevel(match))));
  if (statboticsTrendEntries.length) {
    statboticsComponents["epa.post"] = statboticsTrendEntries.at(-1).value;
  }
  return {
    number: Number(teamInfo.team_number),
    name: teamInfo.nickname || teamEvent?.team_name || `Team ${teamInfo.team_number}`,
    drivetrain: "unknown",
    flags: [],
    matches: [],
    record: teamEvent?.record ? { ...teamEvent.record } : {},
    sources: {
      scouter: { total: 0, components: emptyScouterComponents, trend: [], componentTrend: Object.fromEntries(scouterFields.map((component) => [component.id, []])) },
      statbotics: {
        total: round(statboticsTotal),
        components: { ...statboticsComponents },
        trend: statboticsTrendEntries.map((entry) => entry.value),
        trendEntries: statboticsTrendEntries,
        playoffTrendEntries: statboticsPlayoffTrendEntries,
      },
      tba: { total: null, components: { ...(tbaComponents || {}) }, trend: [] },
      pridge: { total: null, components: {}, trend: [] },
    },
    derived: {},
  };
}

function buildEventModelFromPayloads(payload) {
  const deferPridgeTrends = payload?.deferPridgeTrends === true;
  const deferPridgeComputation = payload?.deferPridgeComputation === true;
  const explicitScouterMetricDefinitions = Array.isArray(payload?.scouterMetricDefinitions) ? payload.scouterMetricDefinitions : [];
  const explicitFormulaFieldDefinitions = Array.isArray(payload?.formulaFieldDefinitions) ? payload.formulaFieldDefinitions : [];
  const explicitDerivedMetricDefinitions = Array.isArray(payload?.derivedMetricDefinitions) ? payload.derivedMetricDefinitions : [];
  const pridgeResponseDefinitions = normalizePridgeResponseDefinitions({
    pridgeResponseDefinitions: mergePridgeResponseDefinitions(payload?.tbaMatches, payload?.pridgeResponseDefinitions),
  });
  const eventSchema = {
    scoringComponents: [],
    scouterMetricDefinitions: explicitScouterMetricDefinitions,
    formulaFieldDefinitions: explicitFormulaFieldDefinitions,
    derivedMetricDefinitions: explicitDerivedMetricDefinitions,
    pridgeResponseDefinitions,
    scoringMatrixPresets: Array.isArray(payload?.scoringMatrixPresets) ? payload.scoringMatrixPresets : [],
  };
  const teamEventsByNumber = new Map((payload.statboticsTeamEvents || []).map((teamEvent) => [Number(teamEvent.team), teamEvent]));
  const teamMatchesByNumber = new Map();
  (payload.statboticsTeamMatches || []).forEach((teamMatch) => {
    const teamNumber = Number(teamMatch?.team);
    if (!Number.isFinite(teamNumber)) return;
    if (!teamMatchesByNumber.has(teamNumber)) teamMatchesByNumber.set(teamNumber, []);
    teamMatchesByNumber.get(teamNumber).push(teamMatch);
  });
  const rankingsByTeamNumber = buildRankingMap(payload.tbaRankings);
  const tbaTeamStats = payload.tbaTeamStats || {};
  const teams = (payload.tbaTeams || [])
    .map((teamInfo) => {
      const teamNumber = Number(teamInfo.team_number);
      return buildTeam(
        teamInfo,
        teamEventsByNumber.get(teamNumber) || {},
        eventSchema,
        buildTbaEventComponents(rankingsByTeamNumber.get(teamNumber) || null, [
          ...buildTbaTeamStatEntries(tbaTeamStats, teamNumber),
        ]),
        teamMatchesByNumber.get(teamNumber) || [],
      );
    })
    .sort((left, right) => left.number - right.number);
  const matches = normalizeMatches(payload.tbaMatches || []);
  const qualificationMatches = (payload.tbaMatches || []).filter((match) => match?.comp_level === "qm");
  let pridgeResult = null;
  let pridgeError = "";
  if (!deferPridgeComputation && typeof computeEventPridge === "function" && matches.length && (payload.statboticsTeamEvents || []).length) {
    try {
      pridgeResult = computeEventPridge(qualificationMatches, payload.statboticsTeamEvents || [], {
        responseName: "score",
        digits: 1,
      });
    } catch (error) {
      pridgeError = String(error?.message || "Unable to compute pRidge.");
    }
  }
  const pridgeResponseResults = {};
  if (!deferPridgeComputation) pridgeResponseDefinitions.forEach((definition) => {
    if (typeof computeEventPridge !== "function" || !matches.length || !(payload.statboticsTeamEvents || []).length) return;
    try {
      const formulaMatches = buildFormulaMatches(qualificationMatches, definition);
      if (formulaMatches.length) {
        pridgeResponseResults[definition.id] = computeEventPridge(formulaMatches, payload.statboticsTeamEvents || [], {
          responseName: "score",
          digits: 1,
        });
      }
    } catch (error) {
      pridgeError = pridgeError || `${definition.id}: ${String(error?.message || "Unable to compute pRidge response.")}`;
    }
  });
  const teamsWithPridge = teams.map((team) => {
    const total = pridgeResult?.ratings?.[team.number] ?? null;
    const responseComponents = Object.fromEntries(pridgeResponseDefinitions.map((definition) => [
      definition.id,
      pridgeResponseResults[definition.id]?.ratings?.[team.number] ?? null,
    ]));
    if (Number.isFinite(Number(total))) {
      responseComponents["epa.total_points"] = total;
      responseComponents["epa.breakdown.total_points"] = total;
    }
    return {
      ...team,
      sources: {
        ...team.sources,
        pridge: {
          total,
          components: responseComponents,
          trend: [],
          trendEntries: [],
        },
      },
    };
  });
  if (!deferPridgeComputation && !deferPridgeTrends && typeof computeEventPridge === "function" && matches.length && (payload.statboticsTeamEvents || []).length) {
    const cumulativeByTeam = new Map(teamsWithPridge.map((team) => [team.number, []]));
    matches.filter((match) => match.compLevel === "qm").forEach((match) => {
      try {
        const result = computeEventPridge((payload.tbaMatches || []).filter((candidate) => {
          const number = Number(candidate?.match_number);
          return candidate?.comp_level === "qm" && Number.isFinite(number) && number <= Number(match.number);
        }), payload.statboticsTeamEvents || [], { responseName: "score", digits: 1 });
        cumulativeByTeam.forEach((entries, teamNumber) => {
          const value = result.ratings?.[teamNumber];
          if (Number.isFinite(Number(value))) entries.push({ key: match.number, value: Number(value) });
        });
      } catch {
        // A partial event can be temporarily underdetermined; leave that point unavailable.
      }
    });
    teamsWithPridge.forEach((team) => {
      const trendEntries = cumulativeByTeam.get(team.number) || [];
      team.sources.pridge.trendEntries = trendEntries;
      team.sources.pridge.trend = trendEntries.map((entry) => entry.value);
    });
  }
  return {
    pridgeComputationDeferred: deferPridgeComputation,
    key: payload.key,
    name: payload.tbaEvent?.name || payload.statboticsEvent?.name || payload.key,
    season: payload.year,
    seasonLabel: "",
    matchesComplete: matches.length,
    matches,
    scoringComponents: [],
    scoringMatrixPresets: eventSchema.scoringMatrixPresets || [],
    scouterMetricDefinitions: explicitScouterMetricDefinitions,
    formulaFieldDefinitions: explicitFormulaFieldDefinitions,
    derivedMetricDefinitions: explicitDerivedMetricDefinitions,
    pridgeResponseDefinitions,
    metrics: buildMetricCatalog(eventSchema),
    teams: teamsWithPridge,
    teamNumbers: teamsWithPridge.map((team) => team.number),
    rankingSortOrderInfo: Array.isArray(payload.tbaRankings?.sort_order_info) ? [...payload.tbaRankings.sort_order_info] : [],
    defaultMetricId: "",
    defaultTeamDetailMetricId: "",
    seedSortEquations: [],
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
        name: "Statbotics",
        status: "Snapshot loaded",
        updated: payload.statboticsEvent?.status || "Event snapshot available",
        notes: "Raw Statbotics event metrics are sourced from Statbotics.",
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
    tbaTeamStats: parseJson(snapshot.tbaTeamStatsText || snapshot.tbaOprsText, {}),
    statboticsEvent: parseJson(snapshot.statboticsEventText, {}),
    statboticsTeamEvents: parseJson(snapshot.statboticsTeamEventsText, []),
    statboticsTeamMatches: parseJson(snapshot.statboticsTeamMatchesText, []),
    pridgeResponseDefinitions: parseJson(snapshot.pridgeResponseDefinitionsText, []),
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
    tbaTeamStats: bundle.tbaTeamStats || bundle.tbaOprs || {},
    statboticsEvent: bundle.statboticsEvent || {},
    statboticsTeamEvents: bundle.statboticsTeamEvents || [],
    statboticsTeamMatches: bundle.statboticsTeamMatches || [],
    deferPridgeTrends: bundle.deferPridgeTrends === true,
    deferPridgeComputation: bundle.deferPridgeComputation === true,
    pridgeResponseDefinitions: bundle.pridgeResponseDefinitions || [],
    catalogSource: bundle.catalogSource || "dynamic-external",
  });
}

globalThis.EventModelBuilder = {
  applyPridgeResponseDefinitions,
  buildEventModelFromProviderBundle,
  buildEventModelFromSnapshot,
};
})();
