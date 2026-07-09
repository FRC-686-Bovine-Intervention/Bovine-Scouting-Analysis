(function () {
const seasonFramework = globalThis.SeasonFramework || {};
const scouterMetricDefinitions = seasonFramework.scouterMetricDefinitions || ((eventModel) => eventModel?.scoringComponents || []);

function schemaMetricEntries(eventModel) {
  return scouterMetricDefinitions(eventModel).map((metricDefinition) => ({
    id: metricDefinition.id,
    label: metricDefinition.label || metricDefinition.id,
    unit: metricDefinition.unit || "",
    aggregate: metricDefinition.aggregate || "average",
  }));
}

function buildScoutingSchemaSignature(eventModel) {
  return JSON.stringify({
    eventKey: eventModel?.key || "",
    season: Number(eventModel?.season) || 0,
    metrics: schemaMetricEntries(eventModel),
  });
}

function shouldRefreshSampleBackedScoutingSubmissions(submissions, eventModel) {
  if (!Array.isArray(submissions) || !submissions.length) return false;
  if (!eventModel?.sheet?.sampleCsvText) return false;
  const expectedSignature = buildScoutingSchemaSignature(eventModel);
  if (submissions.every((submission) => String(submission?.scoutingSchemaSignature || "").trim() === expectedSignature)) return false;
  return submissions.some((submission) => {
    const rawMetrics = submission?.rawMetrics || {};
    const signature = String(submission?.scoutingSchemaSignature || "").trim();
    if (!signature || !submission?.schemaVersion || !submission?.templateProfileId) return true;
    return schemaMetricEntries(eventModel).some((metricDefinition) => !Object.prototype.hasOwnProperty.call(rawMetrics, metricDefinition.id));
  });
}

function stampScoutingSubmissionMetadata(submissions, eventModel, extra = {}) {
  const signature = buildScoutingSchemaSignature(eventModel);
  return (submissions || []).map((submission) => ({
    ...submission,
    ...extra,
    scoutingSchemaSignature: signature,
  }));
}

globalThis.ScoutingImportRepair = {
  buildScoutingSchemaSignature,
  shouldRefreshSampleBackedScoutingSubmissions,
  stampScoutingSubmissionMetadata,
};
})();
