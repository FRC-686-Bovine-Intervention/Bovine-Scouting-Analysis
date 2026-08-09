(function () {
function normalizeText(value) {
  return String(value || "").trim();
}

function sanitizeMetricIdentifier(value, fallback = "derivedMetric") {
  const trimmed = normalizeText(value);
  const normalized = trimmed
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) return fallback;
  if (/^[A-Za-z_]/.test(normalized)) return normalized;
  return `_${normalized}`;
}

function isValidMetricIdentifier(value) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(normalizeText(value));
}

function canonicalDerivedMetricName(metricDefinition, fallback = "derivedMetric") {
  const explicitName = normalizeText(metricDefinition?.name);
  const explicitId = normalizeText(metricDefinition?.id);
  const explicitLabel = normalizeText(metricDefinition?.label);
  if (isValidMetricIdentifier(explicitName)) return explicitName;
  if (isValidMetricIdentifier(explicitId)) return explicitId;
  if (isValidMetricIdentifier(explicitLabel)) return explicitLabel;
  return sanitizeMetricIdentifier(explicitName || explicitId || explicitLabel, fallback);
}

const sourceLabels = {
  scouter: "Scouting",
  statbotics: "Statbotics",
  pridge: "pRidge",
  derived: "Derived",
};

function scouterMetricDefinitions(schemaOrEventModel) {
  if (!schemaOrEventModel) return [];
  if (Array.isArray(schemaOrEventModel.scouterMetricDefinitions) && schemaOrEventModel.scouterMetricDefinitions.length) {
    return schemaOrEventModel.scouterMetricDefinitions;
  }
  return Array.isArray(schemaOrEventModel.scouterMetrics) ? schemaOrEventModel.scouterMetrics : [];
}

function formulaFieldDefinitions(schemaOrEventModel) {
  if (!schemaOrEventModel) return [];
  if (Array.isArray(schemaOrEventModel.formulaFieldDefinitions) && schemaOrEventModel.formulaFieldDefinitions.length) {
    return schemaOrEventModel.formulaFieldDefinitions;
  }
  const seen = new Set();
  const definitions = [];
  const append = (fieldDefinition) => {
    const fieldId = normalizeText(fieldDefinition?.id);
    if (!fieldId || seen.has(fieldId)) return;
    seen.add(fieldId);
    definitions.push(fieldDefinition);
  };
  (schemaOrEventModel?.scoringComponents || []).forEach((component) => append({
    id: component.id,
    label: component.label,
    unit: component.unit || "pts",
  }));
  scouterMetricDefinitions(schemaOrEventModel).forEach(append);
  (schemaOrEventModel?.formulaFields || []).forEach(append);
  return definitions;
}

function referencedDerivedMetricFields(metricDefinition) {
  return [
    ...(Array.isArray(metricDefinition?.fields) ? metricDefinition.fields : []),
    ...(Array.isArray(metricDefinition?.madeFields) ? metricDefinition.madeFields : []),
    ...(Array.isArray(metricDefinition?.missFields) ? metricDefinition.missFields : []),
    ...(Array.isArray(metricDefinition?.numeratorFields) ? metricDefinition.numeratorFields : []),
    ...(Array.isArray(metricDefinition?.denominatorFields) ? metricDefinition.denominatorFields : []),
    ...(Array.isArray(metricDefinition?.presenceFields) ? metricDefinition.presenceFields : []),
    ...(Array.isArray(metricDefinition?.weightedFields) ? metricDefinition.weightedFields.map((entry) => entry?.field) : []),
  ]
    .map((fieldId) => normalizeText(fieldId))
    .filter(Boolean);
}

function inferDerivedMetricUnit(metricDefinition, schemaOrEventModel = {}) {
  const explicitUnit = normalizeText(metricDefinition?.unit);
  if (explicitUnit) return explicitUnit;
  const formula = normalizeText(metricDefinition?.formula).toLowerCase();
  if (formula === "rate") return "%";
  const fieldUnitById = new Map(
    formulaFieldDefinitions(schemaOrEventModel)
      .map((fieldDefinition) => [normalizeText(fieldDefinition?.id), normalizeText(fieldDefinition?.unit)]),
  );
  const referencedUnits = [...new Set(
    referencedDerivedMetricFields(metricDefinition)
      .map((fieldId) => fieldUnitById.get(fieldId))
      .filter(Boolean),
  )];
  if (referencedUnits.length === 1) return referencedUnits[0];
  if (formula === "average" && referencedUnits.length) return referencedUnits[0];
  if (formula === "sum" || formula === "weighted_sum" || formula === "ratio") return referencedUnits[0] || "pts";
  return referencedUnits[0] || "pts";
}

function normalizeDerivedMetricDefinition(metricDefinition, schemaOrEventModel = {}, index = 0) {
  const name = canonicalDerivedMetricName(metricDefinition, `derivedMetric_${index + 1}`);
  if (!name) return null;
  return {
    ...metricDefinition,
    id: name,
    name,
    label: name,
    unit: inferDerivedMetricUnit(metricDefinition, schemaOrEventModel),
  };
}

function normalizeDerivedMetricDefinitions(schemaOrEventModel) {
  if (!schemaOrEventModel) return [];
  const sourceDefinitions = Array.isArray(schemaOrEventModel.derivedMetricDefinitions)
    ? schemaOrEventModel.derivedMetricDefinitions
    : (Array.isArray(schemaOrEventModel.derivedMetrics) ? schemaOrEventModel.derivedMetrics : []);
  const seen = new Set();
  return sourceDefinitions
    .map((metricDefinition, index) => normalizeDerivedMetricDefinition(metricDefinition, schemaOrEventModel, index))
    .filter((metricDefinition) => {
      const metricId = normalizeText(metricDefinition?.id);
      if (!metricId || seen.has(metricId)) return false;
      seen.add(metricId);
      return true;
    });
}

function derivedMetricDefinitions(schemaOrEventModel) {
  return normalizeDerivedMetricDefinitions(schemaOrEventModel);
}

function csvHeaderForField(fieldDefinition) {
  if (fieldDefinition?.csvKey) return fieldDefinition.csvKey;
  return fieldDefinition?.unit === "pts" ? `${fieldDefinition.id}Pts` : fieldDefinition?.id;
}

function metricFieldId(fieldDefinition) {
  return String(csvHeaderForField(fieldDefinition))
    .trim()
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function buildMetricCatalog(schemaOrEventModel = {}) {
  const scoringComponents = Array.isArray(schemaOrEventModel.scoringComponents) ? schemaOrEventModel.scoringComponents : [];
  const pridgeResponseDefinitions = Array.isArray(schemaOrEventModel.pridgeResponseDefinitions)
    ? schemaOrEventModel.pridgeResponseDefinitions
    : [];
  return [
    ...scouterMetricDefinitions(schemaOrEventModel).map((component) => ({
      id: `source:scouter:${component.id}`,
      kind: "source",
      sourceId: "scouter",
      componentId: component.id,
      label: `Scouting ${component.label}`,
      shortLabel: component.label,
      unit: component.unit,
    })),
    ...["statbotics"].flatMap((sourceId) => [
      {
        id: `source:${sourceId}:total`,
        kind: "source",
        sourceId,
        componentId: "total",
        label: sourceLabels[sourceId],
        shortLabel: sourceLabels[sourceId],
        unit: "pts",
      },
      ...scoringComponents.map((component) => ({
        id: `source:${sourceId}:${component.id}`,
        kind: "source",
        sourceId,
        componentId: component.id,
        label: `${sourceLabels[sourceId]} ${component.label}`,
        shortLabel: component.label,
        unit: component.unit,
      })),
    ]),
    {
      id: "source:pridge:total",
      kind: "source",
      sourceId: "pridge",
      componentId: "total",
      label: sourceLabels.pridge,
      shortLabel: sourceLabels.pridge,
      unit: "pts",
    },
    ...pridgeResponseDefinitions.map((definition) => ({
      id: `source:pridge:${definition.id}`,
      kind: "source",
      sourceId: "pridge",
      componentId: definition.id,
      label: `${sourceLabels.pridge} ${definition.label || definition.id}`,
      shortLabel: definition.label || definition.id,
      unit: definition.unit || "pts",
      definition,
    })),
    ...derivedMetricDefinitions(schemaOrEventModel).map((metricDefinition) => ({
      id: `derived:${metricDefinition.id}`,
      kind: "derived",
      sourceId: "derived",
      componentId: metricDefinition.id,
      label: metricDefinition.label,
      shortLabel: metricDefinition.label,
      unit: metricDefinition.unit,
      definition: metricDefinition,
    })),
  ];
}

globalThis.ScoutingSchemaRuntime = {
  buildMetricCatalog,
  csvHeaderForField,
  derivedMetricDefinitions,
  formulaFieldDefinitions,
  metricFieldId,
  normalizeDerivedMetricDefinitions,
  scouterMetricDefinitions,
  sourceLabels,
};
})();
