(function () {
const eventModelBuilder = globalThis.EventModelBuilder || {};
const seasonFramework = globalThis.SeasonFramework || {};
const providerSeasonMetadata = globalThis.ProviderSeasonMetadata || {};
const scoutingSchemaRuntime = globalThis.ScoutingSchemaRuntime || {};
const seasonMetadataByYear = providerSeasonMetadata.seasons || seasonFramework.gameDefinitions || {};
const buildMetricCatalog =
  scoutingSchemaRuntime.buildMetricCatalog
  || seasonFramework.buildMetrics
  || ((eventModel) => eventModel?.metrics || []);

function parseJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function minimalEventModelFromSnapshot(snapshot) {
  const season = Number(snapshot?.season || snapshot?.year || 0);
  const seasonDefinition = seasonMetadataByYear[season] || {};
  const explicitScouterMetricDefinitions = Array.isArray(snapshot?.scouterMetricDefinitions) ? snapshot.scouterMetricDefinitions : [];
  const explicitFormulaFieldDefinitions = Array.isArray(snapshot?.formulaFieldDefinitions) ? snapshot.formulaFieldDefinitions : [];
  const explicitDerivedMetricDefinitions = Array.isArray(snapshot?.derivedMetricDefinitions) ? snapshot.derivedMetricDefinitions : [];
  const scoutingSchemaSeed = {
    scoringComponents: seasonDefinition.scoringComponents || [],
    breakdownMap: seasonDefinition.breakdownMap || {},
    scouterMetricDefinitions: explicitScouterMetricDefinitions,
    formulaFieldDefinitions: explicitFormulaFieldDefinitions,
    derivedMetricDefinitions: explicitDerivedMetricDefinitions,
    scoringMatrixPresets: Array.isArray(snapshot?.scoringMatrixPresets) ? snapshot.scoringMatrixPresets : [],
  };
  const tbaEvent = parseJson(snapshot?.tbaEventText, {});
  const tbaTeams = parseJson(snapshot?.tbaTeamsText, []);
  const teams = (Array.isArray(tbaTeams) ? tbaTeams : [])
    .map((team) => ({
      number: Number(team?.team_number || team?.teamNumber || 0),
      name: String(team?.nickname || team?.name || "").trim(),
      flags: [],
      matches: [],
      sources: {},
      derived: {},
    }))
    .filter((team) => Number.isFinite(team.number) && team.number > 0);
  return {
    ...snapshot,
    key: snapshot?.key || "",
    name: tbaEvent?.name || snapshot?.key || "",
    season,
    seasonLabel: seasonDefinition.label || (season ? `${season} Season` : ""),
    scoringComponents: seasonDefinition.scoringComponents || [],
    scoringMatrixPresets: scoutingSchemaSeed.scoringMatrixPresets || [],
    scouterMetricDefinitions: explicitScouterMetricDefinitions,
    formulaFieldDefinitions: explicitFormulaFieldDefinitions,
    derivedMetricDefinitions: explicitDerivedMetricDefinitions,
    metrics: buildMetricCatalog(scoutingSchemaSeed),
    teams,
    teamNumbers: teams.map((team) => team.number),
    sheet: snapshot?.sheet ? { ...snapshot.sheet, recommendedProfileId: snapshot.importProfileId || "" } : null,
  };
}

const buildEventModelFromSnapshot =
  eventModelBuilder.buildEventModelFromSnapshot ||
  minimalEventModelFromSnapshot;

const snapshots = Array.isArray(globalThis.realEventSnapshots?.events) ? globalThis.realEventSnapshots.events : [];
globalThis.eventCatalog = snapshots.map(buildEventModelFromSnapshot);
})();
