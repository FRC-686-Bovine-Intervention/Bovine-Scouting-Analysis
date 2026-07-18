(function () {
const canonicalFormatId = "frc-scouting-analysis/v1";
const canonicalTemplateProfileId = "canonical-json-v1";
const requiredEntryIdentityFields = ["matchNumber", "teamNumber", "scoutUser", "alliance", "station"];
const requiredMetaFields = ["format", "season", "eventKey", "entryType"];

function normalizeText(value) {
  return String(value || "").trim();
}

function formulaFieldDefinitions(eventModel) {
  if (Array.isArray(eventModel?.formulaFieldDefinitions) && eventModel.formulaFieldDefinitions.length) {
    return eventModel.formulaFieldDefinitions;
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

function inferCanonicalFieldType(fieldDefinition) {
  const explicitType = normalizeText(fieldDefinition?.type).toLowerCase();
  if (explicitType) return explicitType;
  const unit = normalizeText(fieldDefinition?.unit).toLowerCase();
  if (unit === "text" || unit === "string") return "string";
  return "number";
}

function normalizeSchemaField(fieldDefinition) {
  return {
    id: normalizeText(fieldDefinition?.id),
    label: normalizeText(fieldDefinition?.label) || normalizeText(fieldDefinition?.id),
    type: inferCanonicalFieldType(fieldDefinition),
    unit: normalizeText(fieldDefinition?.unit),
    optional: fieldDefinition?.optional === true,
    aggregate: normalizeText(fieldDefinition?.aggregate) || (inferCanonicalFieldType(fieldDefinition) === "number" ? "average" : ""),
  };
}

function buildCanonicalSchemaForEventModel(eventModel, options = {}) {
  const schemaId = normalizeText(options.schemaId) || `${eventModel?.season || "season"}-match-v1`;
  return {
    schemaId,
    fields: formulaFieldDefinitions(eventModel).map((fieldDefinition) => normalizeSchemaField(fieldDefinition)),
  };
}

function buildCanonicalMetaForEventModel(eventModel, options = {}) {
  return {
    format: canonicalFormatId,
    eventKey: normalizeText(options.eventKey) || normalizeText(eventModel?.key),
    season: Number(options.season || eventModel?.season || 0),
    entryType: normalizeText(options.entryType) || "match",
    exportedAt: normalizeText(options.exportedAt),
    sourceApp: normalizeText(options.sourceApp),
  };
}

function validateCanonicalSchema(payload, eventModel, activeEventKey) {
  const errors = [];
  const warnings = [];
  const meta = payload?.meta && typeof payload.meta === "object" ? payload.meta : {};
  const schema = payload?.schema && typeof payload.schema === "object" ? payload.schema : {};
  const entries = Array.isArray(payload?.entries) ? payload.entries : null;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    errors.push("Canonical scouting JSON must be a JSON object.");
    return { errors, warnings, meta, schema, entries, schemaFieldMap: new Map(), expectedFieldMap: new Map() };
  }

  if (!payload?.meta || typeof payload.meta !== "object" || Array.isArray(payload.meta)) {
    errors.push("Canonical scouting JSON must include a meta object.");
  }
  if (!payload?.schema || typeof payload.schema !== "object" || Array.isArray(payload.schema)) {
    errors.push("Canonical scouting JSON must include a schema object.");
  }
  if (!entries) {
    errors.push("Canonical scouting JSON must include an entries array.");
  }

  requiredMetaFields.forEach((fieldId) => {
    if (!normalizeText(meta[fieldId])) {
      errors.push(`Canonical scouting JSON meta.${fieldId} is required.`);
    }
  });

  if (normalizeText(meta.format) && normalizeText(meta.format) !== canonicalFormatId) {
    errors.push(`Canonical scouting JSON format must be ${canonicalFormatId}.`);
  }
  if (normalizeText(meta.entryType) && normalizeText(meta.entryType) !== "match") {
    errors.push(`Canonical scouting JSON meta.entryType must be match, received ${normalizeText(meta.entryType)}.`);
  }
  if (normalizeText(meta.season) && String(meta.season) !== String(eventModel?.season)) {
    errors.push(`Metadata season ${meta.season} does not match active season ${eventModel?.season}.`);
  }
  if (normalizeText(meta.eventKey) && normalizeText(meta.eventKey) !== normalizeText(activeEventKey)) {
    errors.push(`Metadata event key ${meta.eventKey} does not match active event ${activeEventKey}.`);
  }

  const schemaId = normalizeText(schema.schemaId);
  if (!schemaId) {
    errors.push("Canonical scouting JSON schema.schemaId is required.");
  }
  if (!Array.isArray(schema.fields)) {
    errors.push("Canonical scouting JSON schema.fields must be an array.");
  }

  const expectedFields = buildCanonicalSchemaForEventModel(eventModel).fields;
  const expectedFieldMap = new Map(expectedFields.map((field) => [field.id, field]));
  const schemaFieldMap = new Map();

  if (Array.isArray(schema.fields)) {
    schema.fields.forEach((field, index) => {
      const fieldId = normalizeText(field?.id);
      const fieldLabel = normalizeText(field?.label);
      const fieldType = normalizeText(field?.type).toLowerCase();
      if (!fieldId) {
        errors.push(`Schema field ${index + 1} is missing id.`);
        return;
      }
      if (schemaFieldMap.has(fieldId)) {
        errors.push(`Schema field ${fieldId} is duplicated.`);
        return;
      }
      if (!fieldLabel) {
        errors.push(`Schema field ${fieldId} is missing label.`);
      }
      if (!fieldType) {
        errors.push(`Schema field ${fieldId} is missing type.`);
      } else if (!["number", "string"].includes(fieldType)) {
        errors.push(`Schema field ${fieldId} has unsupported type ${fieldType}.`);
      }
      schemaFieldMap.set(fieldId, {
        id: fieldId,
        label: fieldLabel || fieldId,
        type: fieldType || "string",
        unit: normalizeText(field?.unit),
        optional: field?.optional === true,
        aggregate: normalizeText(field?.aggregate),
      });
    });
  }

  expectedFields.forEach((expectedField) => {
    const actualField = schemaFieldMap.get(expectedField.id);
    if (!actualField) return;
    if (actualField.type !== expectedField.type) {
      errors.push(`Schema field ${expectedField.id} declares type ${actualField.type} but the active event expects ${expectedField.type}.`);
    }
  });

  return {
    errors,
    warnings,
    meta,
    schema: {
      ...schema,
      schemaId,
      fields: Array.isArray(schema.fields) ? schema.fields : [],
    },
    entries,
    schemaFieldMap,
    expectedFieldMap,
  };
}

globalThis.ScoutingJsonSchema = {
  buildCanonicalMetaForEventModel,
  buildCanonicalSchemaForEventModel,
  canonicalFormatId,
  canonicalTemplateProfileId,
  inferCanonicalFieldType,
  requiredEntryIdentityFields,
  validateCanonicalSchema,
};
})();
