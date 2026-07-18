(function () {
function normalizeText(value) {
  return String(value || "").trim();
}

function baseFormulaFieldDefinitions(eventModel) {
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

function titleCaseToken(token) {
  const normalized = normalizeText(token);
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function humanizeFieldId(fieldId) {
  const normalized = normalizeText(fieldId)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-]+/g, " ");
  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map(titleCaseToken)
    .join(" ");
}

function inferFieldType(values) {
  const samples = (values || []).filter((value) => value !== null && value !== undefined && value !== "");
  if (!samples.length) return "string";
  const allNumeric = samples.every((value) => Number.isFinite(Number(value)));
  return allNumeric ? "number" : "string";
}

function dynamicFieldDefinition(fieldId, samples = [], schemaField = null) {
  const type = normalizeText(schemaField?.type) || inferFieldType(samples);
  return {
    id: fieldId,
    label: normalizeText(schemaField?.label) || humanizeFieldId(fieldId) || fieldId,
    unit: normalizeText(schemaField?.unit) || (type === "number" ? "count" : "text"),
    aggregate: normalizeText(schemaField?.aggregate) || (type === "number" ? "average" : ""),
    optional: schemaField?.optional !== undefined ? Boolean(schemaField.optional) : true,
    dynamic: true,
    type,
  };
}

function buildDynamicScoutingFieldDefinitions({ eventModel, submissions = [], schemaFields = [] } = {}) {
  const seededDefinitions = baseFormulaFieldDefinitions(eventModel) || [];
  const definitionById = new Map(
    seededDefinitions
      .filter((fieldDefinition) => normalizeText(fieldDefinition?.id))
      .map((fieldDefinition) => [normalizeText(fieldDefinition.id), fieldDefinition]),
  );

  const schemaFieldById = new Map(
    (schemaFields || [])
      .filter((fieldDefinition) => normalizeText(fieldDefinition?.id))
      .map((fieldDefinition) => [normalizeText(fieldDefinition.id), fieldDefinition]),
  );

  const sampleValuesByFieldId = new Map();
  (submissions || []).forEach((submission) => {
    Object.entries(submission?.rawMetrics || {}).forEach(([fieldId, value]) => {
      const normalizedFieldId = normalizeText(fieldId);
      if (!normalizedFieldId) return;
      if (!sampleValuesByFieldId.has(normalizedFieldId)) sampleValuesByFieldId.set(normalizedFieldId, []);
      sampleValuesByFieldId.get(normalizedFieldId).push(value);
    });
  });

  [...sampleValuesByFieldId.keys(), ...schemaFieldById.keys()].forEach((fieldId) => {
    if (definitionById.has(fieldId)) return;
    definitionById.set(fieldId, dynamicFieldDefinition(fieldId, sampleValuesByFieldId.get(fieldId) || [], schemaFieldById.get(fieldId)));
  });

  return [...definitionById.values()];
}

globalThis.DynamicScoutingFields = {
  buildDynamicScoutingFieldDefinitions,
  humanizeFieldId,
  inferFieldType,
};
})();
