(function () {
const seasonFramework = globalThis.SeasonFramework || {};
const scoutingJsonSchema = globalThis.ScoutingJsonSchema || {};
const requiredIdentityFields = scoutingJsonSchema.requiredEntryIdentityFields || ["matchNumber", "teamNumber", "alliance"];
const canonicalFormatId = scoutingJsonSchema.canonicalFormatId || "frc-scouting-analysis/v1";
const canonicalTemplateProfileId = scoutingJsonSchema.canonicalTemplateProfileId || "canonical-json-v1";
const buildCanonicalSchemaForEventModel = scoutingJsonSchema.buildCanonicalSchemaForEventModel || (() => ({ schemaId: canonicalTemplateProfileId, fields: [] }));
const normalizeCanonicalPayload = scoutingJsonSchema.normalizeCanonicalPayload || ((payload, schemaPayload = null) => ({
  meta: payload?.meta || {},
  schemaMeta: (schemaPayload || payload)?.meta || {},
  schema: (schemaPayload || payload)?.schema || {},
  entries: Array.isArray(payload?.entries) ? payload.entries : [],
}));
const validateCanonicalSchema = scoutingJsonSchema.validateCanonicalSchema || (() => ({
  errors: [],
  warnings: [],
  meta: {},
  schemaMeta: {},
  schema: {},
  entries: [],
  schemaFieldMap: new Map(),
  expectedFieldMap: new Map(),
}));

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function currentScoutingSourceUtils() {
  return globalThis.ScoutingSourceUtils || {};
}

function normalizeText(value) {
  return String(value || "").trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toBoolean(value) {
  if (value === true || value === false) return value;
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return false;
  return ["true", "yes", "1", "y"].includes(normalized);
}

function normalizeMetricValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  return JSON.stringify(value);
}

function normalizeProvenance(value, fallback = {}) {
  const base = value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
  return Object.fromEntries(
    Object.entries({ ...fallback, ...base }).filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== ""),
  );
}

const contextualEntryMetricIds = new Set(["scoutUser", "station", "defensePlayed", "robotStatus", "notes"]);

function formulaFieldDefinitions(eventModel) {
  if (Array.isArray(eventModel?.formulaFieldDefinitions) && eventModel.formulaFieldDefinitions.length) {
    return eventModel.formulaFieldDefinitions;
  }
  if (typeof seasonFramework.formulaFieldDefinitions === "function") {
    const seededDefinitions = seasonFramework.formulaFieldDefinitions(eventModel);
    if (Array.isArray(seededDefinitions) && seededDefinitions.length) return seededDefinitions;
  }
  const definitions = [];
  const seen = new Set();
  const append = (fieldDefinition) => {
    const fieldId = normalizeText(fieldDefinition?.id);
    if (!fieldId || seen.has(fieldId)) return;
    seen.add(fieldId);
    definitions.push(fieldDefinition);
  };
  (eventModel?.scoringComponents || []).forEach((component) => append({
    id: component.id,
    label: component.label,
    unit: component.unit || "pts",
  }));
  (eventModel?.scouterMetricDefinitions || eventModel?.scouterMetrics || []).forEach(append);
  (eventModel?.formulaFields || []).forEach(append);
  return definitions;
}

function validateSeasonPackage(eventModel) {
  const missing = [];
  if (!eventModel?.season) missing.push("season");
  if (!eventModel?.seasonLabel) missing.push("seasonLabel");
  if (!Array.isArray(formulaFieldDefinitions(eventModel)) || !formulaFieldDefinitions(eventModel).length) missing.push("formulaFieldDefinitions");
  return {
    valid: missing.length === 0,
    missing,
  };
}

function assessDuplicateSubmissions(existingSubmissions, incomingSubmissions) {
  const scoutingSourceUtils = currentScoutingSourceUtils();
  return scoutingSourceUtils.assessDuplicateSubmissions
    ? scoutingSourceUtils.assessDuplicateSubmissions(existingSubmissions, incomingSubmissions)
    : { impactedTeams: [], duplicateGroups: [] };
}

function parseCanonicalJson(text) {
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { error: `Canonical scouting artifact is not valid JSON. ${error?.message || ""}`.trim() };
  }
}

function entryContextValue(entry, rawMetricsSource, fieldId) {
  if (entry && Object.prototype.hasOwnProperty.call(entry, fieldId)) return entry[fieldId];
  return rawMetricsSource?.[fieldId];
}

function previewScoutingJsonImport({ jsonText, schemaJsonText = "", eventModel, activeEventKey, existingSubmissions = [] }) {
  const profileIdOverride = normalizeText(arguments[0]?.profileId);
  const profileLabelOverride = normalizeText(arguments[0]?.profileLabel);
  const translationVersionOverride = normalizeText(arguments[0]?.translationVersion);
  const seasonCheck = validateSeasonPackage(eventModel);
  if (!seasonCheck.valid) {
    return {
      ok: false,
      errors: [`Season package is incomplete: ${seasonCheck.missing.join(", ")}.`],
      warnings: [],
      summary: null,
    };
  }

  const parsed = parseCanonicalJson(jsonText || "");
  if (parsed.error) {
    return {
      ok: false,
      errors: [parsed.error],
      warnings: [],
      summary: null,
    };
  }

  let schemaPayload = null;
  if (normalizeText(schemaJsonText)) {
    const parsedSchema = parseCanonicalJson(schemaJsonText);
    if (parsedSchema.error) {
      return {
        ok: false,
        errors: [parsedSchema.error],
        warnings: [],
        summary: null,
      };
    }
    schemaPayload = parsedSchema.value;
  }

  const payload = parsed.value;
  const normalizedPayload = normalizeCanonicalPayload(payload, schemaPayload);
  const validation = validateCanonicalSchema(payload, eventModel, activeEventKey, schemaPayload);
  const errors = validation.errors.slice();
  const warnings = validation.warnings.slice();
  const meta = validation.meta || normalizedPayload.meta || {};
  const schemaMeta = validation.schemaMeta || normalizedPayload.schemaMeta || {};
  const schema = validation.schema || {};
  const entries = validation.entries;

  if (errors.length) {
    return {
      ok: false,
      errors,
      warnings,
      summary: null,
      suggestedEventKey: meta.eventKey || null,
      canSwitchContext: Boolean(meta.eventKey && meta.eventKey !== activeEventKey),
    };
  }

  const expectedSchema = buildCanonicalSchemaForEventModel(eventModel);
  const schemaFieldDefinitions = Array.isArray(schema.fields) && schema.fields.length
    ? schema.fields
    : expectedSchema.fields;
  const fieldIds = new Set(schemaFieldDefinitions.map((fieldDefinition) => normalizeText(fieldDefinition?.id)).filter(Boolean));
  const schemaFieldMap = validation.schemaFieldMap || new Map();
  const parsedRows = [];

  entries.forEach((entry, index) => {
    const rawMetricsSource = entry?.rawMetrics && typeof entry.rawMetrics === "object" ? entry.rawMetrics : {};
    const rawMetrics = Object.fromEntries(
      Object.entries(rawMetricsSource).map(([key, value]) => [key, normalizeMetricValue(value)]),
    );
    const submission = {
      id: normalizeText(entry?.entryId) || createId("submission"),
      season: Number(meta.season || eventModel.season),
      eventKey: normalizeText(meta.eventKey) || eventModel.key,
      schemaVersion: normalizeText(schema.schemaId) || canonicalTemplateProfileId,
      templateProfileId: profileIdOverride || normalizeText(schemaMeta.templateProfileId) || normalizeText(meta.templateProfileId) || canonicalTemplateProfileId,
      sourceType: "team-scouting",
      matchNumber: toNumber(entry?.matchNumber),
      teamNumber: toNumber(entry?.teamNumber),
      scoutUser: normalizeText(entryContextValue(entry, rawMetricsSource, "scoutUser")),
      alliance: normalizeText(entry?.alliance),
      station: normalizeText(entryContextValue(entry, rawMetricsSource, "station")),
      defensePlayed: toBoolean(entryContextValue(entry, rawMetricsSource, "defensePlayed")),
      robotStatus: normalizeText(entryContextValue(entry, rawMetricsSource, "robotStatus")),
      notes: normalizeText(entryContextValue(entry, rawMetricsSource, "notes")),
      rawMetrics,
      validity: "valid",
      confidenceTier: "high",
      confidenceReasons: [],
      rowNumber: index + 1,
      provenance: normalizeProvenance(entry?.provenance, {
        mode: "canonical-json-import",
        sourceEntryId: normalizeText(entry?.entryId) || `entry-${index + 1}`,
        sourceRowNumber: index + 1,
        sourceApp: normalizeText(schemaMeta.sourceApp) || normalizeText(meta.sourceApp),
      }),
    };

    const missingIdentity = requiredIdentityFields.filter((field) => {
      if (field === "matchNumber") return !submission.matchNumber;
      if (field === "teamNumber") return !submission.teamNumber;
      return !submission[field];
    });
    if (missingIdentity.length) {
      submission.validity = "excluded";
      submission.confidenceTier = "low";
      submission.confidenceReasons.push("schema_gap");
      warnings.push(`Entry ${index + 1} is missing required identity fields: ${missingIdentity.join(", ")}.`);
    } else {
      schemaFieldDefinitions.forEach((fieldDefinition) => {
        const fieldId = normalizeText(fieldDefinition?.id);
        if (!fieldId) return;
        if (!Object.prototype.hasOwnProperty.call(rawMetrics, fieldId) && fieldDefinition.optional !== true) {
          submission.confidenceReasons.push("missing_metric");
        }
      });
      if (submission.confidenceReasons.length) {
        submission.validity = "flagged";
        submission.confidenceTier = "medium";
      }
    }

    Object.keys(rawMetrics).forEach((fieldId) => {
      if (contextualEntryMetricIds.has(fieldId)) return;
      if (!fieldIds.has(fieldId)) {
        warnings.push(`Entry ${index + 1} includes unknown metric ${fieldId}.`);
        return;
      }
      const schemaField = schemaFieldMap.get(fieldId);
      const value = rawMetrics[fieldId];
      if (!schemaField || value === null) return;
      if (schemaField.type === "number" && typeof value !== "number") {
        warnings.push(`Entry ${index + 1} metric ${fieldId} should be a number.`);
      }
      if (schemaField.type === "string" && typeof value !== "string") {
        warnings.push(`Entry ${index + 1} metric ${fieldId} should be a string.`);
      }
    });
    parsedRows.push(submission);
  });

  const duplicateAssessment = assessDuplicateSubmissions(existingSubmissions, parsedRows);
  const flaggedRows = parsedRows.filter((submission) => submission.validity === "flagged");
  const excludedRows = parsedRows.filter((submission) => submission.validity === "excluded");
  const impactedTeams = [...new Set([...duplicateAssessment.impactedTeams, ...flaggedRows.map((submission) => submission.teamNumber)])];

  return {
    ok: true,
    errors: [],
    warnings,
    summary: {
      profileId: profileIdOverride || normalizeText(schemaMeta.templateProfileId) || normalizeText(meta.templateProfileId) || canonicalTemplateProfileId,
      profileLabel: profileLabelOverride || normalizeText(schemaMeta.profileLabel) || normalizeText(meta.profileLabel) || "Canonical Scouting JSON",
      schemaVersion: normalizeText(schema.schemaId) || canonicalTemplateProfileId,
      rowCount: parsedRows.length,
      newRows: parsedRows.length,
      duplicateGroups: duplicateAssessment.duplicateGroups.length,
      duplicateGroupKeys: duplicateAssessment.duplicateGroups.map((group) => group.key),
      flaggedRows: flaggedRows.length,
      excludedRows: excludedRows.length,
      impactedTeams,
      confidenceImpactTeams: impactedTeams.length,
      metadata: {
        season: String(meta.season || eventModel.season),
        eventKey: normalizeText(meta.eventKey) || eventModel.key,
        schemaVersion: normalizeText(schema.schemaId) || canonicalTemplateProfileId,
        schemaId: normalizeText(schema.schemaId) || canonicalTemplateProfileId,
        templateProfileId: profileIdOverride || normalizeText(schemaMeta.templateProfileId) || normalizeText(meta.templateProfileId) || canonicalTemplateProfileId,
        translationVersion: translationVersionOverride || normalizeText(schemaMeta.translationVersion) || normalizeText(meta.translationVersion),
      },
      schemaFields: (schema.fields || []).map((field) => ({
        id: normalizeText(field?.id),
        label: normalizeText(field?.label) || normalizeText(field?.id),
        type: normalizeText(field?.type),
        unit: normalizeText(field?.unit),
        aggregate: normalizeText(field?.aggregate),
      })),
      submissions: parsedRows,
    },
  };
}

globalThis.ScoutingJsonImport = {
  canonicalFormatId,
  canonicalTemplateProfileId,
  previewScoutingJsonImport,
};
})();
