(function () {
const seasonFramework = globalThis.SeasonFramework || {};
const scouterMetricDefinitions = seasonFramework.scouterMetricDefinitions || ((eventModel) => eventModel?.scoringComponents || []);
const formulaFieldDefinitions = seasonFramework.formulaFieldDefinitions || scouterMetricDefinitions;

function schemaFieldEntries(eventModel) {
  return formulaFieldDefinitions(eventModel).map((fieldDefinition) => ({
    id: fieldDefinition.id,
    label: fieldDefinition.label || fieldDefinition.id,
    unit: fieldDefinition.unit || "",
    aggregate: fieldDefinition.aggregate || "average",
  }));
}

function buildScoutingSchemaSignature(eventModel) {
  return JSON.stringify({
    eventKey: eventModel?.key || "",
    season: Number(eventModel?.season) || 0,
    fields: schemaFieldEntries(eventModel),
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
    return schemaFieldEntries(eventModel).some((fieldDefinition) => !Object.prototype.hasOwnProperty.call(rawMetrics, fieldDefinition.id));
  });
}

function repairLegacySubmissionRawMetrics(rawMetrics, eventModel) {
  if (!rawMetrics || typeof rawMetrics !== "object") return {};
  const repaired = { ...rawMetrics };
  if (
    Number(eventModel?.season) === 2024 &&
    !Object.prototype.hasOwnProperty.call(repaired, "climbAttempt") &&
    Object.prototype.hasOwnProperty.call(repaired, "climbSuccess")
  ) {
    repaired.climbAttempt = Number(repaired.climbSuccess) > 0 ? 1 : 0;
  }
  return repaired;
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
  repairLegacySubmissionRawMetrics,
  shouldRefreshSampleBackedScoutingSubmissions,
  stampScoutingSubmissionMetadata,
};
})();
