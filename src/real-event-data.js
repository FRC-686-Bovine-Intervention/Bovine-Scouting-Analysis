(function () {
const eventModelBuilder = globalThis.EventModelBuilder || {};
const seasonFramework = globalThis.SeasonFramework || {};
const gameDefinitions = seasonFramework.gameDefinitions || seasonFramework.seasonDefinitions || {};
const buildMetrics = seasonFramework.buildMetrics || ((season) => season?.metrics || []);
const scouterMetricDefinitions = seasonFramework.scouterMetricDefinitions || ((season) => season?.scouterMetrics || []);
const formulaFieldDefinitions = seasonFramework.formulaFieldDefinitions || scouterMetricDefinitions;
const derivedMetricDefinitions = seasonFramework.derivedMetricDefinitions || ((season) => season?.derivedMetrics || []);
const buildCriteriaSources = seasonFramework.buildCriteriaSources || ((season) => season?.criteriaSources || []);

function parseJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function minimalEventModelFromSnapshot(snapshot) {
  const season = Number(snapshot?.season || snapshot?.year || 0);
  const seasonDefinition = gameDefinitions[season] || {};
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
    seasonLabel: seasonDefinition.label || String(season || ""),
    scoringComponents: seasonDefinition.scoringComponents || [],
    scouterMetricDefinitions: scouterMetricDefinitions(seasonDefinition),
    formulaFieldDefinitions: formulaFieldDefinitions(seasonDefinition),
    derivedMetricDefinitions: derivedMetricDefinitions(seasonDefinition),
    metrics: buildMetrics(seasonDefinition),
    criteriaSources: buildCriteriaSources(seasonDefinition),
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
