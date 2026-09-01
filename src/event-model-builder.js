(function () {
const seasonFramework = globalThis.SeasonFramework || {};
const scoutingSchemaRuntime = globalThis.ScoutingSchemaRuntime || {};
const priorRidge = globalThis.PriorRidge || {};
const buildMetricCatalog =
  scoutingSchemaRuntime.buildMetricCatalog
  || seasonFramework.buildMetrics
  || ((eventModel) => eventModel?.metrics || []);
const computeEventPridge = priorRidge.computeEventPridge;
const computeEventPridgeTrend = priorRidge.computeEventPridgeTrend;
const computeEventPridgeBatch = priorRidge.computeEventPridgeBatch;
const teamIdentity = globalThis.TeamIdentity || {};
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

function normalizeRobotIdentity(value) {
  if (typeof teamIdentity.identityFromProviderValue === "function") {
    return teamIdentity.identityFromProviderValue(value);
  }
  const raw = normalizeText(value).replace(/^frc/i, "");
  const match = raw.match(/^(\d+)([A-Za-z]+)?$/);
  if (!match || Number(match[1]) <= 0) return null;
  const suffix = (match[2] || "").toUpperCase();
  const label = `${match[1]}${suffix}`;
  return { id: `frc${label}`, key: `frc${label}`, label, baseNumber: Number(match[1]), isSuffixed: Boolean(suffix) };
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
  let pridgeDiagnostics = [];
  const shouldCompute = !eventModel.pridgeComputationDeferred || options.force === true;
  let totalResults = {};
  if (shouldCompute && typeof computeEventPridgeBatch === "function") {
    const responseSets = [
      ...(options.force === true ? [{ id: "__total", matches: rawMatches }] : []),
      ...normalizedDefinitions.map((definition) => ({ id: definition.id, matches: buildFormulaMatches(rawMatches, definition) })),
    ];
    const batchResults = computeEventPridgeBatch(responseSets, teamEvents, { responseName: "score", digits: 1 });
    pridgeDiagnostics = batchResults.__diagnostics || [];
    totalResults = options.force === true ? batchResults.__total?.ratings || {} : {};
    normalizedDefinitions.forEach((definition) => {
      if (batchResults[definition.id]) results[definition.id] = batchResults[definition.id];
    });
  } else if (shouldCompute && options.force === true && typeof computeEventPridge === "function") {
    try {
      totalResults = computeEventPridge(rawMatches, teamEvents, { responseName: "score", digits: 1 }).ratings || {};
    } catch {
      totalResults = {};
    }
  }
  if (shouldCompute && typeof computeEventPridgeBatch !== "function" && typeof computeEventPridge === "function") {
    normalizedDefinitions.forEach((definition) => {
      try {
        const formulaMatches = buildFormulaMatches(rawMatches, definition);
        if (formulaMatches.length) {
          results[definition.id] = computeEventPridge(formulaMatches, teamEvents, { responseName: "score", digits: 1 });
        }
      } catch {
        // Keep the response unavailable when the active event lacks required live inputs.
      }
    });
  }
  return {
    ...eventModel,
    pridgeDiagnostics,
    pridgeComputationDeferred: shouldCompute ? false : eventModel.pridgeComputationDeferred === true,
    pridgeResponseDefinitions: normalizedDefinitions,
    teams: (eventModel.teams || []).map((team) => ({
      ...team,
      sources: {
        ...team.sources,
        pridge: {
          ...(team.sources?.pridge || {}),
          total: !team.isSuffixed && Number.isFinite(Number(totalResults[team.number]))
            ? totalResults[team.number]
            : team.sources?.pridge?.total ?? null,
          components: Object.fromEntries(normalizedDefinitions.map((definition) => [
            definition.id,
            !team.isSuffixed ? results[definition.id]?.ratings?.[team.number] ?? null : null,
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
    .map((match) => {
      const redTeamKeys = match.alliances?.red?.team_keys || [];
      const blueTeamKeys = match.alliances?.blue?.team_keys || [];
      const redLabels = redTeamKeys.map((teamKey) => String(teamKey).replace(/^frc/i, ""));
      const blueLabels = blueTeamKeys.map((teamKey) => String(teamKey).replace(/^frc/i, ""));
      const redScore = Number(match.alliances?.red?.score);
      const blueScore = Number(match.alliances?.blue?.score);
      return {
        id: String(match.key || `${match.comp_level || "qm"}-${match.set_number || 0}-${match.match_number || 0}`),
        compLevel: String(match.comp_level || "qm").toLowerCase(),
        setNumber: Number(match.set_number) || 0,
        number: Number(match.match_number),
        red: redLabels.map(Number).filter(Number.isFinite),
        blue: blueLabels.map(Number).filter(Number.isFinite),
        ...(redLabels.some((label) => !/^\d+$/.test(label)) ? {
          redLabels,
          redKeys: redTeamKeys.map(normalizeRobotIdentity).filter(Boolean).map((identity) => identity.key),
        } : {}),
        ...(blueLabels.some((label) => !/^\d+$/.test(label)) ? {
          blueLabels,
          blueKeys: blueTeamKeys.map(normalizeRobotIdentity).filter(Boolean).map((identity) => identity.key),
        } : {}),
        redScore: Number.isFinite(redScore) ? redScore : 0,
        blueScore: Number.isFinite(blueScore) ? blueScore : 0,
        hasScore: Number.isFinite(redScore) && Number.isFinite(blueScore) && redScore >= 0 && blueScore >= 0,
        winningAlliance: match.winning_alliance || "",
        scoreBreakdown: match.score_breakdown
          ? {
              red: cloneBreakdown(match.score_breakdown.red),
              blue: cloneBreakdown(match.score_breakdown.blue),
            }
          : null,
      };
    })
    // Keep scheduled matches while TBA is still filling in their alliance
    // assignments. Metric consumers can continue filtering for six-team rows;
    // the schedule can display incomplete rows with TBD slots.
}

function normalizePlayoffAlliances(alliances) {
  return (Array.isArray(alliances) ? alliances : []).map((alliance, index) => ({
    number: Number(alliance?.number ?? index + 1),
    name: normalizeText(alliance?.name) || `Alliance ${Number(alliance?.number ?? index + 1)}`,
    picks: (alliance?.picks || []).map(parseTeamNumberFromKey).filter(Number.isFinite),
    backup: alliance?.backup?.team || alliance?.backup ? parseTeamNumberFromKey(alliance.backup?.team || alliance.backup) : null,
    status: alliance?.status && typeof alliance.status === "object" ? { ...alliance.status } : null,
  })).filter((alliance) => Number.isFinite(alliance.number) && alliance.number > 0)
    .sort((left, right) => left.number - right.number);
}

function parseTeamNumberFromKey(value) {
  return normalizeRobotIdentity(value)?.baseNumber ?? Number.NaN;
}

function buildRankingMap(rankingsPayload) {
  const rankings = Array.isArray(rankingsPayload?.rankings) ? rankingsPayload.rankings : [];
  return new Map(rankings
    .map((entry) => [normalizeRobotIdentity(entry?.team_key), entry])
    .filter(([identity]) => identity)
    .map(([identity, entry]) => [identity.id, entry]));
}

function buildTbaTeamValueMap(teamStatsPayload, key) {
  const values = teamStatsPayload?.[key] && typeof teamStatsPayload[key] === "object" ? teamStatsPayload[key] : {};
  return new Map(Object.entries(values)
    .map(([teamKey, value]) => [normalizeRobotIdentity(teamKey), Number(value || 0)])
    .filter(([identity]) => identity)
    .map(([identity, value]) => [identity.id, value]));
}

function buildTbaTeamStatEntries(teamStatsPayload, teamIdentity) {
  const identity = typeof teamIdentity === "object" ? teamIdentity : normalizeRobotIdentity(teamIdentity);
  if (!identity) return [];
  const teamValueMaps = [
    { fieldId: "opr.total", valuesByTeamNumber: buildTbaTeamValueMap(teamStatsPayload, "oprs") },
    { fieldId: "dpr.total", valuesByTeamNumber: buildTbaTeamValueMap(teamStatsPayload, "dprs") },
    { fieldId: "ccwm.total", valuesByTeamNumber: buildTbaTeamValueMap(teamStatsPayload, "ccwms") },
  ];
  return teamValueMaps
    .map(({ fieldId, valuesByTeamNumber }) => {
      const value = valuesByTeamNumber.get(identity.id);
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
  const identity = normalizeRobotIdentity(teamInfo.key || teamInfo.team_key || teamInfo.team_number);
  const baseNumber = identity?.baseNumber ?? Number(teamInfo.team_number);
  return {
    id: identity?.id || `frc${baseNumber}`,
    key: identity?.key || `frc${baseNumber}`,
    label: identity?.label || String(baseNumber),
    baseNumber,
    isSuffixed: identity?.isSuffixed === true,
    number: baseNumber,
    name: teamInfo.nickname || teamEvent?.team_name || `Team ${identity?.label || teamInfo.team_number}`,
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
  const perfNow = () => globalThis.performance?.now?.() ?? Date.now();
  const pridgeStartedAt = perfNow();
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
  const teamEventsById = new Map((payload.statboticsTeamEvents || [])
    .map((teamEvent) => [normalizeRobotIdentity(teamEvent.team), teamEvent])
    .filter(([identity]) => identity)
    .map(([identity, teamEvent]) => [identity.id, teamEvent]));
  const teamMatchesById = new Map();
  (payload.statboticsTeamMatches || []).forEach((teamMatch) => {
    const identity = normalizeRobotIdentity(teamMatch?.team);
    if (!identity) return;
    if (!teamMatchesById.has(identity.id)) teamMatchesById.set(identity.id, []);
    teamMatchesById.get(identity.id).push(teamMatch);
  });
  const rankingsByTeamNumber = buildRankingMap(payload.tbaRankings);
  const tbaTeamStats = payload.tbaTeamStats || {};
  const teamInfosById = new Map();
  (payload.tbaTeams || []).forEach((teamInfo) => {
      const identity = normalizeRobotIdentity(teamInfo.key || teamInfo.team_key || teamInfo.team_number);
      if (identity) teamInfosById.set(identity.id, { ...teamInfo, key: identity.key });
  });
  (payload.tbaMatches || []).forEach((match) => {
    for (const teamKey of [...(match.alliances?.red?.team_keys || []), ...(match.alliances?.blue?.team_keys || [])]) {
      const identity = normalizeRobotIdentity(teamKey);
      if (identity && !teamInfosById.has(identity.id)) teamInfosById.set(identity.id, { team_number: identity.baseNumber, key: identity.key });
    }
  });
  const teams = [...teamInfosById.values()]
    .map((teamInfo) => {
      const identity = normalizeRobotIdentity(teamInfo.key || teamInfo.team_key || teamInfo.team_number);
      const teamNumber = identity?.baseNumber ?? Number(teamInfo.team_number);
      return buildTeam(
        teamInfo,
        teamEventsById.get(identity?.id) || {},
        eventSchema,
        buildTbaEventComponents(rankingsByTeamNumber.get(identity?.id) || null, [
          ...buildTbaTeamStatEntries(tbaTeamStats, identity),
        ]),
        teamMatchesById.get(identity?.id) || [],
      );
    })
    .sort((left, right) => left.number - right.number || left.id.localeCompare(right.id));
  const matches = normalizeMatches(payload.tbaMatches || []);
  const playoffAlliances = normalizePlayoffAlliances(payload.tbaAlliances);
  const qualificationMatches = (payload.tbaMatches || []).filter((match) => match?.comp_level === "qm");
  let pridgeResult = null;
  let pridgeError = "";
  let pridgeDiagnostics = [];
  let pridgeTotalDurationMs = 0;
  let pridgeTrendDurationMs = 0;
  let pridgeTrendProfiling = {
    scheduleQualificationCount: qualificationMatches.length,
    completedQualificationCount: 0,
    trendFitCount: 0,
    trendCacheHits: 0,
    trendCacheMisses: 0,
  };
  const pridgeResponseResults = {};
  if (!deferPridgeComputation && matches.length && (payload.statboticsTeamEvents || []).length) {
    const totalStartedAt = perfNow();
    try {
      const responseSets = [
        { id: "__total", matches: qualificationMatches },
        ...pridgeResponseDefinitions.map((definition) => ({ id: definition.id, matches: buildFormulaMatches(qualificationMatches, definition) })),
      ];
      const batchResults = typeof computeEventPridgeBatch === "function"
        ? computeEventPridgeBatch(responseSets, payload.statboticsTeamEvents || [], { responseName: "score", digits: 1 })
        : {};
      pridgeDiagnostics = batchResults.__diagnostics || [];
      pridgeResult = batchResults.__total || null;
      pridgeResponseDefinitions.forEach((definition) => {
        if (batchResults[definition.id]) pridgeResponseResults[definition.id] = batchResults[definition.id];
      });
      if (!pridgeResult && typeof computeEventPridge === "function") {
        pridgeResult = computeEventPridge(qualificationMatches, payload.statboticsTeamEvents || [], { responseName: "score", digits: 1 });
      }
      pridgeTotalDurationMs = Math.round((perfNow() - totalStartedAt) * 100) / 100;
    } catch (error) {
      pridgeError = String(error?.message || "Unable to compute pRidge.");
      pridgeTotalDurationMs = Math.round((perfNow() - totalStartedAt) * 100) / 100;
    }
  }
  const teamsWithPridge = teams.map((team) => {
    const total = team.isSuffixed ? null : pridgeResult?.ratings?.[team.number] ?? null;
    const responseComponents = Object.fromEntries(pridgeResponseDefinitions.map((definition) => [
      definition.id,
      team.isSuffixed ? null : pridgeResponseResults[definition.id]?.ratings?.[team.number] ?? null,
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
    const trendStartedAt = perfNow();
    const trendResult = typeof computeEventPridgeTrend === "function"
      ? computeEventPridgeTrend(payload.tbaMatches || [], payload.statboticsTeamEvents || [], { responseName: "score", digits: 1 })
      : { entriesByTeam: new Map(), profiling: pridgeTrendProfiling };
    pridgeTrendProfiling = trendResult.profiling || pridgeTrendProfiling;
    teamsWithPridge.forEach((team) => {
      const trendEntries = trendResult.entriesByTeam.get(team.number) || [];
      team.sources.pridge.trendEntries = trendEntries;
      team.sources.pridge.trend = trendEntries.map((entry) => entry.value);
    });
    pridgeTrendDurationMs = Math.round((perfNow() - trendStartedAt) * 100) / 100;
  }
  return {
    pridgeComputationDeferred: deferPridgeComputation,
    key: payload.key,
    name: payload.tbaEvent?.name || payload.statboticsEvent?.name || payload.key,
    season: payload.year,
    seasonLabel: "",
    matchesComplete: matches.length,
    matches,
    playoffAlliances,
    scoringComponents: [],
    scoringMatrixPresets: eventSchema.scoringMatrixPresets || [],
    scouterMetricDefinitions: explicitScouterMetricDefinitions,
    formulaFieldDefinitions: explicitFormulaFieldDefinitions,
    derivedMetricDefinitions: explicitDerivedMetricDefinitions,
    pridgeResponseDefinitions,
    pridgeDiagnostics,
    profiling: {
      eventModelBuildDurationMs: Math.round((perfNow() - pridgeStartedAt) * 100) / 100,
      pridgeTotalDurationMs,
      pridgeTrendDurationMs,
      ...pridgeTrendProfiling,
    },
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
    tbaAlliances: bundle.tbaAlliances || [],
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
