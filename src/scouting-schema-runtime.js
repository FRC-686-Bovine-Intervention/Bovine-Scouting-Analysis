(function () {
function normalizeText(value) {
  return String(value || "").trim();
}

const sourceLabels = {
  scouter: "Scouting",
  epa: "EPA",
  opr: "OPR",
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

function derivedMetricDefinitions(schemaOrEventModel) {
  if (!schemaOrEventModel) return [];
  if (Array.isArray(schemaOrEventModel.derivedMetricDefinitions)) return schemaOrEventModel.derivedMetricDefinitions;
  return Array.isArray(schemaOrEventModel.derivedMetrics) ? schemaOrEventModel.derivedMetrics : [];
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
    ...["epa"].flatMap((sourceId) => [
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
      id: "source:opr:total",
      kind: "source",
      sourceId: "opr",
      componentId: "total",
      label: sourceLabels.opr,
      shortLabel: sourceLabels.opr,
      unit: "pts",
    },
    {
      id: "source:pridge:total",
      kind: "source",
      sourceId: "pridge",
      componentId: "total",
      label: sourceLabels.pridge,
      shortLabel: sourceLabels.pridge,
      unit: "pts",
    },
    {
      id: "derived:defenseImpact",
      kind: "derived",
      sourceId: "derived",
      componentId: "defenseImpact",
      label: "Defense Impact",
      shortLabel: "Defense Impact",
      unit: "pts",
    },
    {
      id: "derived:consistency",
      kind: "derived",
      sourceId: "derived",
      componentId: "consistency",
      label: "Consistency",
      shortLabel: "Consistency",
      unit: "%",
    },
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
  scouterMetricDefinitions,
  sourceLabels,
};
})();
