(function () {
const sheetImportAdapters = globalThis.SheetImportAdapters || {};
const importTranslationVersionForEvent = sheetImportAdapters.importTranslationVersionForEvent || (() => "");

function normalizeText(value) {
  return String(value || "").trim();
}

function schemaFieldDefinitions(eventModel) {
  if (Array.isArray(eventModel?.formulaFieldDefinitions) && eventModel.formulaFieldDefinitions.length) {
    return eventModel.formulaFieldDefinitions;
  }
  if (Array.isArray(eventModel?.scouterMetricDefinitions) && eventModel.scouterMetricDefinitions.length) {
    return eventModel.scouterMetricDefinitions;
  }
  return (eventModel?.scoringComponents || []).map((component) => ({
    id: component.id,
    label: component.label,
    unit: component.unit || "pts",
  }));
}

function normalizeSchemaFieldEntry(fieldDefinition) {
  return {
    id: fieldDefinition.id,
    label: fieldDefinition.label || fieldDefinition.id,
    type: String(fieldDefinition?.type || "").trim() || (String(fieldDefinition?.unit || "").trim().toLowerCase() === "text" ? "string" : "number"),
    unit: fieldDefinition.unit || "",
    aggregate: fieldDefinition.aggregate || "average",
  };
}

function schemaFieldEntries(eventModel) {
  return schemaFieldDefinitions(eventModel).map(normalizeSchemaFieldEntry);
}

function normalizedSchemaFieldEntries(eventModel, fields = []) {
  if (Array.isArray(fields) && fields.length) {
    return fields.map(normalizeSchemaFieldEntry);
  }
  return schemaFieldEntries(eventModel);
}

function buildScoutingSchemaSignatureFromFields({ eventKey = "", season = 0, fields = [] } = {}) {
  return JSON.stringify({
    eventKey: String(eventKey || "").trim(),
    season: Number(season) || 0,
    fields: normalizedSchemaFieldEntries(null, fields),
  });
}

function buildScoutingSchemaSignature(eventModel) {
  return buildScoutingSchemaSignatureFromFields({
    eventKey: eventModel?.key || "",
    season: Number(eventModel?.season) || 0,
    fields: schemaFieldEntries(eventModel),
  });
}

function shouldRefreshSampleBackedScoutingSubmissions(submissions, eventModel, options = {}) {
  if (!Array.isArray(submissions) || !submissions.length) return false;
  if (!eventModel?.sheet?.sampleCsvText) return false;
  const expectedSignature = normalizeText(options?.schemaSignature)
    || (Array.isArray(options?.schemaFields) && options.schemaFields.length
      ? buildScoutingSchemaSignatureFromFields({
          eventKey: eventModel?.key || "",
          season: Number(eventModel?.season) || 0,
          fields: options.schemaFields,
        })
      : buildScoutingSchemaSignature(eventModel));
  const expectedFields = Array.isArray(options?.schemaFields) && options.schemaFields.length
    ? normalizedSchemaFieldEntries(eventModel, options.schemaFields)
    : schemaFieldEntries(eventModel);
  const expectedTranslationVersion = normalizeText(options?.translationVersion) || importTranslationVersionForEvent(eventModel);
  return submissions.some((submission) => {
    const rawMetrics = submission?.rawMetrics || {};
    const signature = String(submission?.scoutingSchemaSignature || "").trim();
    if (!signature || !submission?.schemaVersion || !submission?.templateProfileId) return true;
    if (signature !== expectedSignature) return true;
    if (expectedTranslationVersion && submission?.importTranslationVersion !== expectedTranslationVersion) return true;
    return expectedFields.some((fieldDefinition) => !Object.prototype.hasOwnProperty.call(rawMetrics, fieldDefinition.id));
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
  const signature = Array.isArray(extra?.schemaFields) && extra.schemaFields.length
    ? buildScoutingSchemaSignatureFromFields({
        eventKey: eventModel?.key || "",
        season: Number(eventModel?.season) || 0,
        fields: extra.schemaFields,
      })
    : buildScoutingSchemaSignature(eventModel);
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
  buildScoutingSchemaSignatureFromFields,
  repairLegacySubmissionRawMetrics,
  schemaFieldEntries,
  shouldRefreshSampleBackedScoutingSubmissions,
  stampScoutingSubmissionMetadata,
};
})();
