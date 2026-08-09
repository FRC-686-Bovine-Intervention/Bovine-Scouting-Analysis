(function () {
const scoutingSchemaRuntime = globalThis.ScoutingSchemaRuntime || {};
const legacyScoutingSchemaSeeds = globalThis.LegacyScoutingSchemaSeeds || {};

const sourceLabels = scoutingSchemaRuntime.sourceLabels || {
  scouter: "Scouting",
  statbotics: "Statbotics",
  pridge: "pRidge",
  derived: "Derived",
};

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

function seasonKeyForValue(seasonOrEventModel) {
  const candidate = typeof seasonOrEventModel === "object" && seasonOrEventModel
    ? (seasonOrEventModel.season ?? seasonOrEventModel.year)
    : seasonOrEventModel;
  const season = Number(candidate);
  return Number.isFinite(season) && season > 0 ? String(season) : "";
}

function legacyScoutingSchemaForSeason(seasonOrEventModel) {
  const seasonKey = seasonKeyForValue(seasonOrEventModel);
  return seasonKey ? (legacyScoutingSchemaSeeds[seasonKey] || {}) : {};
}

function scouterMetricDefinitions(seasonOrEventModel) {
  if (typeof scoutingSchemaRuntime.scouterMetricDefinitions === "function") {
    return scoutingSchemaRuntime.scouterMetricDefinitions(seasonOrEventModel);
  }
  if (!seasonOrEventModel) return [];
  if (Array.isArray(seasonOrEventModel.scouterMetricDefinitions) && seasonOrEventModel.scouterMetricDefinitions.length) {
    return seasonOrEventModel.scouterMetricDefinitions;
  }
  if (Array.isArray(seasonOrEventModel.scouterMetrics) && seasonOrEventModel.scouterMetrics.length) {
    return seasonOrEventModel.scouterMetrics;
  }
  return legacyScoutingSchemaForSeason(seasonOrEventModel).scouterMetrics || [];
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

function inferDerivedMetricUnit(metricDefinition, seasonOrEventModel = {}) {
  const explicitUnit = normalizeText(metricDefinition?.unit);
  if (explicitUnit) return explicitUnit;
  const formula = normalizeText(metricDefinition?.formula).toLowerCase();
  if (formula === "rate") return "%";
  const fieldUnitById = new Map(
    formulaFieldDefinitions(seasonOrEventModel)
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

function normalizeDerivedMetricDefinitionsForSeason(sourceDefinitions, seasonOrEventModel = {}) {
  const seen = new Set();
  return (Array.isArray(sourceDefinitions) ? sourceDefinitions : [])
    .map((metricDefinition, index) => {
      const name = canonicalDerivedMetricName(metricDefinition, `derivedMetric_${index + 1}`);
      if (!name) return null;
      return {
        ...metricDefinition,
        id: name,
        name,
        label: name,
        unit: inferDerivedMetricUnit(metricDefinition, seasonOrEventModel),
      };
    })
    .filter((metricDefinition) => {
      const metricId = normalizeText(metricDefinition?.id);
      if (!metricId || seen.has(metricId)) return false;
      seen.add(metricId);
      return true;
    });
}

function derivedMetricDefinitions(seasonOrEventModel) {
  if (typeof scoutingSchemaRuntime.normalizeDerivedMetricDefinitions === "function") {
    return scoutingSchemaRuntime.normalizeDerivedMetricDefinitions(seasonOrEventModel);
  }
  if (typeof scoutingSchemaRuntime.derivedMetricDefinitions === "function") {
    return scoutingSchemaRuntime.derivedMetricDefinitions(seasonOrEventModel);
  }
  if (!seasonOrEventModel) return [];
  if (Array.isArray(seasonOrEventModel.derivedMetricDefinitions)) {
    return normalizeDerivedMetricDefinitionsForSeason(seasonOrEventModel.derivedMetricDefinitions, seasonOrEventModel);
  }
  if (Array.isArray(seasonOrEventModel.derivedMetrics) && seasonOrEventModel.derivedMetrics.length) {
    return normalizeDerivedMetricDefinitionsForSeason(seasonOrEventModel.derivedMetrics, seasonOrEventModel);
  }
  return normalizeDerivedMetricDefinitionsForSeason(legacyScoutingSchemaForSeason(seasonOrEventModel).derivedMetrics || [], seasonOrEventModel);
}

function formulaFieldDefinitions(seasonOrEventModel) {
  if (typeof scoutingSchemaRuntime.formulaFieldDefinitions === "function") {
    return scoutingSchemaRuntime.formulaFieldDefinitions(seasonOrEventModel);
  }
  if (!seasonOrEventModel) return [];
  if (Array.isArray(seasonOrEventModel.formulaFieldDefinitions)) return seasonOrEventModel.formulaFieldDefinitions;
  const seen = new Set();
  const scoringComponentFields = Array.isArray(seasonOrEventModel.scoringComponents)
    ? seasonOrEventModel.scoringComponents.map((component) => ({
        id: component.id,
        label: component.label,
        unit: component.unit || "pts",
      }))
    : [];
  const explicitFormulaFields = Array.isArray(seasonOrEventModel.formulaFields) && seasonOrEventModel.formulaFields.length
    ? seasonOrEventModel.formulaFields
    : (legacyScoutingSchemaForSeason(seasonOrEventModel).formulaFields || []);
  return [...scoringComponentFields, ...scouterMetricDefinitions(seasonOrEventModel), ...explicitFormulaFields].filter((fieldDefinition) => {
    const fieldId = String(fieldDefinition?.id || "");
    if (!fieldId || seen.has(fieldId)) return false;
    seen.add(fieldId);
    return true;
  });
}

function csvHeaderForMetric(metricDefinition) {
  if (typeof scoutingSchemaRuntime.csvHeaderForField === "function") {
    return scoutingSchemaRuntime.csvHeaderForField(metricDefinition);
  }
  return metricDefinition.csvKey || (metricDefinition.unit === "pts" ? `${metricDefinition.id}Pts` : metricDefinition.id);
}

function metricFieldId(metricDefinition) {
  if (typeof scoutingSchemaRuntime.metricFieldId === "function") {
    return scoutingSchemaRuntime.metricFieldId(metricDefinition);
  }
  return String(csvHeaderForMetric(metricDefinition))
    .trim()
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function buildMetrics(season) {
  if (typeof scoutingSchemaRuntime.buildMetricCatalog === "function") {
    return scoutingSchemaRuntime.buildMetricCatalog(season);
  }
  const scouterMetrics = scouterMetricDefinitions(season);
  const pridgeResponseDefinitions = Array.isArray(season?.pridgeResponseDefinitions) ? season.pridgeResponseDefinitions : [];
  return [
    ...scouterMetrics.map((component) => ({
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
      ...season.scoringComponents.map((component) => ({
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
    ...derivedMetricDefinitions(season).map((metricDefinition) => ({
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

function buildCriteriaSources(season) {
  const scoringComponents = [{ id: "total", label: "Total" }, ...season.scoringComponents.map((component) => ({ id: component.id, label: component.label }))];
  const scouterComponents = scouterMetricDefinitions(season).map((component) => ({ id: component.id, label: component.label }));
  return [
    { id: "statbotics", label: sourceLabels.statbotics, components: scoringComponents },
    { id: "scouter", label: sourceLabels.scouter, components: scouterComponents },
    { id: "pridge", label: sourceLabels.pridge, components: [
      { id: "total", label: "Total" },
      ...(Array.isArray(season?.pridgeResponseDefinitions) ? season.pridgeResponseDefinitions : [])
        .map((definition) => ({ id: definition.id, label: definition.label || definition.id })),
    ] },
    {
      id: "derived",
      label: sourceLabels.derived,
      components: [
        ...derivedMetricDefinitions(season).map((metricDefinition) => ({ id: metricDefinition.id, label: metricDefinition.label })),
      ],
    },
  ];
}

globalThis.SeasonFramework = {
  buildCriteriaSources,
  buildMetrics,
  csvHeaderForMetric,
  derivedMetricDefinitions,
  formulaFieldDefinitions,
  metricFieldId,
  scouterMetricDefinitions,
  sourceLabels,
};
})();
