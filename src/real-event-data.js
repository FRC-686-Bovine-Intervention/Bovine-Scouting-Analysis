(function () {
const eventModelBuilder = globalThis.EventModelBuilder || {};
const seasonFramework = globalThis.SeasonFramework || {};
const scoutingSchemaRuntime = globalThis.ScoutingSchemaRuntime || {};
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
  const explicitScouterMetricDefinitions = Array.isArray(snapshot?.scouterMetricDefinitions) ? snapshot.scouterMetricDefinitions : [];
  const explicitFormulaFieldDefinitions = Array.isArray(snapshot?.formulaFieldDefinitions) ? snapshot.formulaFieldDefinitions : [];
  const explicitDerivedMetricDefinitions = Array.isArray(snapshot?.derivedMetricDefinitions) ? snapshot.derivedMetricDefinitions : [];
  const eventSchema = {
    scoringComponents: [],
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
    seasonLabel: "",
    scoringComponents: [],
    scoringMatrixPresets: eventSchema.scoringMatrixPresets || [],
    scouterMetricDefinitions: explicitScouterMetricDefinitions,
    formulaFieldDefinitions: explicitFormulaFieldDefinitions,
    derivedMetricDefinitions: explicitDerivedMetricDefinitions,
    metrics: buildMetricCatalog(eventSchema),
    teams,
    teamNumbers: teams.map((team) => team.number),
    sheet: snapshot?.sheet ? { ...snapshot.sheet, recommendedProfileId: snapshot.importProfileId || "" } : null,
  };
}

const buildEventModelFromSnapshot =
  eventModelBuilder.buildEventModelFromSnapshot ||
  minimalEventModelFromSnapshot;

function buildCatalogEventRecord(snapshot) {
  const eventModel = minimalEventModelFromSnapshot(snapshot);
  if (buildEventModelFromSnapshot === minimalEventModelFromSnapshot) {
    return { ...eventModel, __snapshot: snapshot, __hydrated: true };
  }
  return { ...eventModel, __snapshot: snapshot, __hydrated: false };
}

function hydrateEventModel(eventModel) {
  if (!eventModel || eventModel.__hydrated || !eventModel.__snapshot) return eventModel;
  return {
    ...buildEventModelFromSnapshot(eventModel.__snapshot),
    __snapshot: eventModel.__snapshot,
    __hydrated: true,
  };
}

const snapshots = Array.isArray(globalThis.realEventSnapshots?.events) ? globalThis.realEventSnapshots.events : [];
globalThis.eventCatalog = snapshots.map(buildCatalogEventRecord);
globalThis.RealEventData = {
  hydrateEventModel,
};
})();
