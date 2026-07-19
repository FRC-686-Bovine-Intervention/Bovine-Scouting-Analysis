(function () {
const scoutingSchemaRuntime = globalThis.ScoutingSchemaRuntime || {};
const legacyScoutingSchemaSeeds = globalThis.LegacyScoutingSchemaSeeds || {};

const gameDefinitions = {
  2024: {
    season: 2024,
    label: "Crescendo",
    scoringComponents: [
      { id: "auto", label: "Auto", unit: "pts" },
      { id: "speaker", label: "Speaker", unit: "pts" },
      { id: "amp", label: "Amp", unit: "pts" },
      { id: "trap", label: "Trap", unit: "pts" },
    ],
    breakdownMap: {
      auto: ["auto_points"],
      speaker: ["speaker_points"],
      amp: ["amplified_notes"],
      trap: ["endgame_trap_points"],
    },
  },
  2025: {
    season: 2025,
    label: "Reefscape",
    scoringComponents: [
      { id: "auto", label: "Auto", unit: "pts" },
      { id: "coral", label: "Coral", unit: "pts" },
      { id: "algae", label: "Algae", unit: "pts" },
      { id: "climb", label: "Climb", unit: "pts" },
    ],
    breakdownMap: {
      auto: ["auto_points"],
      coral: ["total_coral_points"],
      algae: ["total_algae_points"],
      climb: ["barge_points"],
    },
  },
  2026: {
    season: 2026,
    label: "2026 Season",
    scoringComponents: [
      { id: "auto", label: "Auto", unit: "pts" },
      { id: "cycle", label: "Cycle", unit: "pts" },
      { id: "endgame", label: "Endgame", unit: "pts" },
    ],
    breakdownMap: {
      auto: ["auto_points"],
      cycle: ["teleop_points"],
      endgame: ["endgame_points"],
    },
  },
};

const sourceLabels = scoutingSchemaRuntime.sourceLabels || {
  scouter: "Scouting",
  statbotics: "Statbotics",
  pridge: "pRidge",
  derived: "Derived",
};

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

function derivedMetricDefinitions(seasonOrEventModel) {
  if (typeof scoutingSchemaRuntime.derivedMetricDefinitions === "function") {
    return scoutingSchemaRuntime.derivedMetricDefinitions(seasonOrEventModel);
  }
  if (!seasonOrEventModel) return [];
  if (Array.isArray(seasonOrEventModel.derivedMetricDefinitions)) return seasonOrEventModel.derivedMetricDefinitions;
  if (Array.isArray(seasonOrEventModel.derivedMetrics) && seasonOrEventModel.derivedMetrics.length) {
    return seasonOrEventModel.derivedMetrics;
  }
  return legacyScoutingSchemaForSeason(seasonOrEventModel).derivedMetrics || [];
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
    { id: "pridge", label: sourceLabels.pridge, components: [{ id: "total", label: "Total" }] },
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
  gameDefinitions,
  metricFieldId,
  scouterMetricDefinitions,
  sourceLabels,
};
})();
