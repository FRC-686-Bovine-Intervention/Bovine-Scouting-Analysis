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

function canonicalSchemaFieldName(fieldDefinition) {
  if (typeof fieldDefinition === "string") return normalizeText(fieldDefinition);
  return normalizeText(fieldDefinition?.name || fieldDefinition?.id || fieldDefinition?.label);
}

function normalizeSchemaField(fieldDefinition, expectedField = null) {
  const fieldId = canonicalSchemaFieldName(fieldDefinition) || normalizeText(expectedField?.id);
  return {
    id: fieldId,
    label: normalizeText(fieldDefinition?.label) || fieldId,
    type: inferCanonicalFieldType({ ...(expectedField || {}), ...(fieldDefinition || {}), id: fieldId }),
    unit: normalizeText(fieldDefinition?.unit) || normalizeText(expectedField?.unit),
  };
}

function normalizeProfileEquation(definition, index = 0) {
  const name = canonicalProfileEquationName(definition, `equation_${index + 1}`);
  if (!name) return null;
  return {
    name,
    formula: normalizeText(definition?.formula || definition?.expression),
  };
}

function normalizeProfileFilter(definition, index = 0) {
  const name = canonicalProfileEquationName(definition, `filter_${index + 1}`);
  if (!name) return null;
  return {
    name,
    formula: normalizeText(definition?.formula || definition?.expression),
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
  const derivedEquations = Array.isArray(profile?.derivedEquations) ? profile.derivedEquations : [];
  const legacyEquations = Array.isArray(profile?.equations) ? profile.equations : [];
  if (!profileId && !profileLabel && !derivedEquations.length && !legacyEquations.length && !Array.isArray(profile?.fieldMigrations || profile?.fieldMigrationRecords)) {
    return null;
  }
  return {
    id: profileId || canonicalTemplateProfileId,
    label: profileLabel || profileId || canonicalTemplateProfileId,
    versionKey: normalizeText(profile?.versionKey || profile?.versionId),
    derivedEquations: (derivedEquations.length ? derivedEquations : legacyEquations)
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
    expectedScoutingFields: formulaFieldDefinitions(eventModel)
      .map((fieldDefinition) => normalizeSchemaField(fieldDefinition).id)
      .filter(Boolean),
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
  const expectedFields = formulaFieldDefinitions(eventModel).map((fieldDefinition) => normalizeSchemaField(fieldDefinition));
  const expectedFieldMap = new Map(expectedFields.map((fieldDefinition) => [fieldDefinition.id, fieldDefinition]));
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
  const schemaFieldEntries = Array.isArray(normalized.schema?.expectedScoutingFields) && normalized.schema.expectedScoutingFields.length
    ? normalized.schema.expectedScoutingFields
    : (Array.isArray(normalized.schema?.fields) ? normalized.schema.fields : []);
  const schema = schemaFieldEntries.length
    ? {
        ...normalized.schema,
        schemaId: resolvedSchemaId,
        expectedScoutingFields: schemaFieldEntries
          .map((fieldDefinition) => normalizeSchemaField(fieldDefinition, expectedFieldMap.get(canonicalSchemaFieldName(fieldDefinition)) || null).id)
          .filter(Boolean),
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
    profile: profile
      ? {
          id: profile.id,
          label: profile.label,
          versionKey: profile.versionKey,
          derivedEquations: profile.derivedEquations,
          filters: profile.filters,
          fieldMigrations: profile.fieldMigrations,
        }
      : profile,
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
  const schemaFieldEntries = Array.isArray(schema.expectedScoutingFields) ? schema.expectedScoutingFields : schema.fields;
  if (!Array.isArray(schemaFieldEntries)) {
    errors.push("Canonical scouting schema JSON schema.expectedScoutingFields must be an array.");
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

  const expectedFields = formulaFieldDefinitions(eventModel).map((fieldDefinition) => normalizeSchemaField(fieldDefinition));
  const expectedFieldMap = new Map(expectedFields.map((field) => [field.id, field]));
  const schemaFieldMap = new Map();

  if (Array.isArray(schemaFieldEntries)) {
    schemaFieldEntries.forEach((field, index) => {
      const fieldId = canonicalSchemaFieldName(field);
      const expectedField = expectedFieldMap.get(fieldId) || null;
      const normalizedField = normalizeSchemaField(field, expectedField);
      const fieldLabel = normalizeText(normalizedField?.label);
      const fieldType = normalizeText(normalizedField?.type).toLowerCase();
      if (!fieldId) {
        errors.push(`Schema field ${index + 1} is missing name.`);
        return;
      }
      if (schemaFieldMap.has(fieldId)) {
        errors.push(`Schema field ${fieldId} is duplicated.`);
        return;
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
        unit: normalizeText(normalizedField?.unit),
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
      expectedScoutingFields: Array.isArray(schemaFieldEntries) ? schemaFieldEntries : [],
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
