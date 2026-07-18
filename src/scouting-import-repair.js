(function () {
const seasonFramework = globalThis.SeasonFramework || {};
const sheetImportAdapters = globalThis.SheetImportAdapters || {};
const scouterMetricDefinitions = seasonFramework.scouterMetricDefinitions || ((eventModel) => eventModel?.scoringComponents || []);
const importTranslationVersionForEvent = sheetImportAdapters.importTranslationVersionForEvent || (() => "");

function schemaFieldDefinitions(eventModel) {
  if (Array.isArray(eventModel?.formulaFieldDefinitions) && eventModel.formulaFieldDefinitions.length) {
    return eventModel.formulaFieldDefinitions;
  }
  return scouterMetricDefinitions(eventModel);
}

function schemaFieldEntries(eventModel) {
  return schemaFieldDefinitions(eventModel).map((fieldDefinition) => ({
    id: fieldDefinition.id,
    label: fieldDefinition.label || fieldDefinition.id,
    type: String(fieldDefinition?.type || "").trim() || (String(fieldDefinition?.unit || "").trim().toLowerCase() === "text" ? "string" : "number"),
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
  const expectedTranslationVersion = importTranslationVersionForEvent(eventModel);
  return submissions.some((submission) => {
    const rawMetrics = submission?.rawMetrics || {};
    const signature = String(submission?.scoutingSchemaSignature || "").trim();
    if (!signature || !submission?.schemaVersion || !submission?.templateProfileId) return true;
    if (signature !== expectedSignature) return true;
    if (expectedTranslationVersion && submission?.importTranslationVersion !== expectedTranslationVersion) return true;
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
  if (
    Number(eventModel?.season) === 2025 &&
    !Object.prototype.hasOwnProperty.call(repaired, "climbAttempt") &&
    Object.prototype.hasOwnProperty.call(repaired, "climbLevel")
  ) {
    repaired.climbAttempt = Number(repaired.climbLevel) > 0 ? 1 : 0;
  }
  return repaired;
}

function stampScoutingSubmissionMetadata(submissions, eventModel, extra = {}) {
  const signature = buildScoutingSchemaSignature(eventModel);
  const importTranslationVersion = importTranslationVersionForEvent(eventModel);
  return (submissions || []).map((submission) => ({
    ...submission,
    ...extra,
    importTranslationVersion,
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
