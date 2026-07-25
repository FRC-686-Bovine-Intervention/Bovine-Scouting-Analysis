(function () {
const seasonFramework = globalThis.SeasonFramework || {};
const canonicalFormatId = "frc-scouting-analysis/v1";
const canonicalTemplateProfileId = "canonical-json-v1";
const requiredEntryIdentityFields = ["matchNumber", "teamNumber", "alliance"];
const requiredEntriesMetaFields = ["format", "season", "eventKey", "entryType"];
const requiredSchemaMetaFields = ["format"];
const contextualEntryMetricIds = ["scoutUser", "station", "defensePlayed", "robotStatus", "notes"];

function normalizeText(value) {
  return String(value || "").trim();
}

function sanitizeProfileIdentifier(value, fallback = "value") {
  const trimmed = normalizeText(value);
  const normalized = trimmed
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) return fallback;
  if (/^[A-Za-z_]/.test(normalized)) return normalized;
  return `_${normalized}`;
}

function isValidProfileIdentifier(value) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(normalizeText(value));
}

function canonicalProfileEquationName(definition, fallback = "equation") {
  const explicitId = normalizeText(definition?.id);
  const explicitName = normalizeText(definition?.name);
  const explicitLabel = normalizeText(definition?.label);
  if (isValidProfileIdentifier(explicitId)) return explicitId;
  if (isValidProfileIdentifier(explicitName)) return explicitName;
  if (isValidProfileIdentifier(explicitLabel)) return explicitLabel;
  return sanitizeProfileIdentifier(explicitId || explicitName || explicitLabel, fallback);
}

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

function normalizeProfileEquation(definition, index = 0) {
  const name = canonicalProfileEquationName(definition, `equation_${index + 1}`);
  if (!name) return null;
  return {
    name,
    formula: normalizeText(definition?.formula || definition?.expression),
    sourceOrder: Number.isFinite(Number(definition?.sourceOrder)) ? Number(definition.sourceOrder) : index,
  };
}

function normalizeProfileFilter(definition, index = 0) {
  const name = canonicalProfileEquationName(definition, `filter_${index + 1}`);
  if (!name) return null;
  return {
    name,
    formula: normalizeText(definition?.formula || definition?.expression),
    sourceOrder: Number.isFinite(Number(definition?.sourceOrder)) ? Number(definition.sourceOrder) : index,
  };
}

function normalizeProfileMigrationRecord(record, index = 0) {
  const kind = normalizeText(record?.kind).toLowerCase();
  const id = normalizeText(record?.id) || `field-migration-${index + 1}`;
  if (kind === "rename") {
    const fromFieldId = normalizeText(record?.fromFieldId || record?.from || record?.fieldId);
    const toFieldId = normalizeText(record?.toFieldId || record?.to);
    if (!fromFieldId || !toFieldId) return null;
    return {
      id,
      kind,
      fromFieldId,
      toFieldId,
      label: normalizeText(record?.label || `${fromFieldId} -> ${toFieldId}`),
      note: normalizeText(record?.note || record?.description),
      recordedAt: normalizeText(record?.recordedAt || record?.timestamp),
    };
  }
  if (kind === "add" || kind === "remove") {
    const fieldId = normalizeText(record?.fieldId || record?.toFieldId || record?.fromFieldId);
    if (!fieldId) return null;
    return {
      id,
      kind,
      fieldId,
      label: normalizeText(record?.label || fieldId),
      note: normalizeText(record?.note || record?.description),
      recordedAt: normalizeText(record?.recordedAt || record?.timestamp),
    };
  }
  return null;
}

function selectSchemaProfile(schemaSource, schemaMeta = {}) {
  if (schemaSource?.profile && typeof schemaSource.profile === "object" && !Array.isArray(schemaSource.profile)) {
    return schemaSource.profile;
  }
  if (Array.isArray(schemaSource?.profiles)) {
    const templateProfileId = normalizeText(schemaMeta?.templateProfileId);
    return schemaSource.profiles.find((profile) => normalizeText(profile?.id || profile?.profileId) === templateProfileId)
      || schemaSource.profiles[0]
      || null;
  }
  return null;
}

function normalizeCanonicalProfile(profile, schemaMeta = {}) {
  const profileId = normalizeText(profile?.id || profile?.profileId) || normalizeText(schemaMeta?.templateProfileId);
  const profileLabel = normalizeText(profile?.label || profile?.name) || normalizeText(schemaMeta?.profileLabel) || profileId;
  if (!profileId && !profileLabel && !Array.isArray(profile?.equations) && !Array.isArray(profile?.fieldMigrations || profile?.fieldMigrationRecords)) {
    return null;
  }
  return {
    id: profileId || canonicalTemplateProfileId,
    label: profileLabel || profileId || canonicalTemplateProfileId,
    versionKey: normalizeText(profile?.versionKey || profile?.versionId),
    equations: (Array.isArray(profile?.equations) ? profile.equations : [])
      .map((definition, index) => normalizeProfileEquation(definition, index))
      .filter(Boolean),
    filters: (Array.isArray(profile?.filters) ? profile.filters : [])
      .map((definition, index) => normalizeProfileFilter(definition, index))
      .filter(Boolean),
    fieldMigrations: (Array.isArray(profile?.fieldMigrations || profile?.fieldMigrationRecords)
      ? (profile.fieldMigrations || profile.fieldMigrationRecords)
      : [])
      .map((record, index) => normalizeProfileMigrationRecord(record, index))
      .filter(Boolean),
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
  return buildCanonicalEntriesMetaForEventModel(eventModel, options);
}

function buildCanonicalEntriesMetaForEventModel(eventModel, options = {}) {
  return {
    format: canonicalFormatId,
    eventKey: normalizeText(options.eventKey) || normalizeText(eventModel?.key),
    season: Number(options.season || eventModel?.season || 0),
    entryType: normalizeText(options.entryType) || "match",
    exportedAt: normalizeText(options.exportedAt),
  };
}

function buildCanonicalSchemaMeta(options = {}) {
  return {
    format: canonicalFormatId,
    sourceApp: normalizeText(options.sourceApp),
    templateProfileId: normalizeText(options.templateProfileId) || canonicalTemplateProfileId,
    profileLabel: normalizeText(options.profileLabel),
    translationVersion: normalizeText(options.translationVersion),
  };
}

function buildCanonicalSchemaArtifact(schemaPayload, options = {}) {
  const normalized = normalizeCanonicalPayload({}, schemaPayload);
  const eventModel = options.eventModel || {};
  const resolvedSchemaId = normalizeText(options.schemaId)
    || normalizeText(normalized.schema?.schemaId)
    || `${eventModel?.season || "season"}-match-v1`;
  const profile = normalizeCanonicalProfile(
    options.profile || normalized.profile,
    {
      ...normalized.schemaMeta,
      templateProfileId: normalizeText(options.profile?.id || normalized.schemaMeta?.templateProfileId),
      profileLabel: normalizeText(options.profile?.label || normalized.schemaMeta?.profileLabel),
    },
  ) || normalizeCanonicalProfile(null, normalized.schemaMeta);
  const schema = Array.isArray(normalized.schema?.fields) && normalized.schema.fields.length
    ? {
        ...normalized.schema,
        schemaId: resolvedSchemaId,
        fields: normalized.schema.fields.map((fieldDefinition) => normalizeSchemaField(fieldDefinition)),
      }
    : buildCanonicalSchemaForEventModel(eventModel, { schemaId: resolvedSchemaId });
  return {
    meta: {
      ...normalized.schemaMeta,
      format: normalizeText(normalized.schemaMeta?.format) || canonicalFormatId,
      sourceApp: normalizeText(normalized.schemaMeta?.sourceApp),
      templateProfileId: normalizeText(profile?.id || normalized.schemaMeta?.templateProfileId) || canonicalTemplateProfileId,
      profileLabel: normalizeText(profile?.label || normalized.schemaMeta?.profileLabel),
      translationVersion: normalizeText(normalized.schemaMeta?.translationVersion),
    },
    schema,
    profile,
  };
}

function normalizeCanonicalPayload(payload, schemaPayload = null) {
  const entriesPayload = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const schemaSource = schemaPayload && typeof schemaPayload === "object" && !Array.isArray(schemaPayload)
    ? schemaPayload
    : entriesPayload;
  const entriesMeta = entriesPayload?.meta && typeof entriesPayload.meta === "object" && !Array.isArray(entriesPayload.meta)
    ? entriesPayload.meta
    : {};
  const schemaMeta = schemaPayload
    ? (schemaSource?.meta && typeof schemaSource.meta === "object" && !Array.isArray(schemaSource.meta)
      ? schemaSource.meta
      : {})
    : (entriesPayload?.schemaMeta && typeof entriesPayload.schemaMeta === "object" && !Array.isArray(entriesPayload.schemaMeta)
      ? entriesPayload.schemaMeta
      : (schemaSource?.meta && typeof schemaSource.meta === "object" && !Array.isArray(schemaSource.meta)
        ? schemaSource.meta
        : {}));
  const schema = schemaSource?.schema && typeof schemaSource.schema === "object" && !Array.isArray(schemaSource.schema)
    ? schemaSource.schema
    : {};
  const profile = normalizeCanonicalProfile(selectSchemaProfile(schemaSource, schemaMeta), schemaMeta);
  const entries = Array.isArray(entriesPayload?.entries) ? entriesPayload.entries : null;
  return {
    entriesPayload,
    schemaPayload: schemaSource,
    meta: entriesMeta,
    schemaMeta,
    schema,
    profile,
    entries,
  };
}

function validateCanonicalSchema(payload, eventModel, activeEventKey, schemaPayload = null) {
  const errors = [];
  const warnings = [];
  const normalized = normalizeCanonicalPayload(payload, schemaPayload);
  const meta = normalized.meta;
  const schemaMeta = normalized.schemaMeta;
  const schema = normalized.schema;
  const profile = normalized.profile;
  const entries = normalized.entries;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    errors.push("Canonical scouting entries JSON must be a JSON object.");
    return { errors, warnings, meta, schemaMeta, schema, profile, entries, schemaFieldMap: new Map(), expectedFieldMap: new Map() };
  }

  if (!payload?.meta || typeof payload.meta !== "object" || Array.isArray(payload.meta)) {
    errors.push("Canonical scouting entries JSON must include a meta object.");
  }
  if (!schemaPayload && (!payload?.schema || typeof payload.schema !== "object" || Array.isArray(payload.schema))) {
    errors.push("Canonical scouting JSON must include a schema object.");
  }
  if (schemaPayload && (!schemaPayload?.schema || typeof schemaPayload.schema !== "object" || Array.isArray(schemaPayload.schema))) {
    errors.push("Canonical scouting schema JSON must include a schema object.");
  }
  if (!entries) {
    errors.push("Canonical scouting entries JSON must include an entries array.");
  }

  requiredEntriesMetaFields.forEach((fieldId) => {
    if (!normalizeText(meta[fieldId])) {
      errors.push(`Canonical scouting entries JSON meta.${fieldId} is required.`);
    }
  });
  requiredSchemaMetaFields.forEach((fieldId) => {
    if (!normalizeText(schemaMeta[fieldId])) {
      errors.push(`Canonical scouting schema JSON meta.${fieldId} is required.`);
    }
  });

  if (normalizeText(meta.format) && normalizeText(meta.format) !== canonicalFormatId) {
    errors.push(`Canonical scouting entries JSON format must be ${canonicalFormatId}.`);
  }
  if (normalizeText(schemaMeta.format) && normalizeText(schemaMeta.format) !== canonicalFormatId) {
    errors.push(`Canonical scouting schema JSON format must be ${canonicalFormatId}.`);
  }
  if (normalizeText(meta.entryType) && normalizeText(meta.entryType) !== "match") {
    errors.push(`Canonical scouting entries JSON meta.entryType must be match, received ${normalizeText(meta.entryType)}.`);
  }
  if (normalizeText(meta.season) && String(meta.season) !== String(eventModel?.season)) {
    errors.push(`Metadata season ${meta.season} does not match active season ${eventModel?.season}.`);
  }
  if (normalizeText(meta.eventKey) && normalizeText(meta.eventKey) !== normalizeText(activeEventKey)) {
    errors.push(`Metadata event key ${meta.eventKey} does not match active event ${activeEventKey}.`);
  }

  const schemaId = normalizeText(schema.schemaId);
  if (!schemaId) {
    errors.push("Canonical scouting schema JSON schema.schemaId is required.");
  }
  if (!Array.isArray(schema.fields)) {
    errors.push("Canonical scouting schema JSON schema.fields must be an array.");
  }

  if (Array.isArray(entries)) {
    entries.forEach((entry, index) => {
      contextualEntryMetricIds.forEach((fieldId) => {
        if (Object.prototype.hasOwnProperty.call(entry || {}, fieldId)) {
          errors.push(`Entry ${index + 1} must store ${fieldId} inside rawMetrics, not as a top-level field.`);
        }
      });
    });
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
    schemaMeta,
    schema: {
      ...schema,
      schemaId,
      fields: Array.isArray(schema.fields) ? schema.fields : [],
    },
    profile,
    entries,
    schemaFieldMap,
    expectedFieldMap,
  };
}

globalThis.ScoutingJsonSchema = {
  buildCanonicalEntriesMetaForEventModel,
  buildCanonicalSchemaMeta,
  buildCanonicalSchemaArtifact,
  buildCanonicalMetaForEventModel,
  buildCanonicalSchemaForEventModel,
  canonicalFormatId,
  canonicalTemplateProfileId,
  inferCanonicalFieldType,
  normalizeCanonicalProfile,
  normalizeCanonicalPayload,
  contextualEntryMetricIds,
  requiredEntryIdentityFields,
  validateCanonicalSchema,
};
})();
