(function () {
function metric(id, label, unit = "pts", extra = {}) {
  return { id, label, unit, ...extra };
}

function formulaField(id, label, extra = {}) {
  return { id, label, unit: "text", optional: true, ...extra };
}

function rateMetric(id, label, madeFields, missFields, unit = "%") {
  return { id, label, unit, formula: "rate", madeFields, missFields };
}

function sumMetric(id, label, fields, unit = "pts") {
  return { id, label, unit, formula: "sum", fields };
}

function averageMetric(id, label, fields, unit = "rating") {
  return { id, label, unit, formula: "average", fields };
}

function weightedMetric(id, label, weightedFields, unit = "pts") {
  return { id, label, unit, formula: "weighted_sum", weightedFields };
}

const gameDefinitions = {
  2024: {
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
    scouterMetrics: [
      metric("autoSpeakerMade", "Auto Speaker Made", "notes"),
      metric("autoSpeakerMissed", "Auto Speaker Missed", "notes"),
      metric("autoAmpMade", "Auto Amp Made", "notes"),
      metric("autoAmpMissed", "Auto Amp Missed", "notes"),
      metric("teleSpeakerMade", "Teleop Speaker Made", "notes"),
      metric("teleSpeakerMissed", "Teleop Speaker Missed", "notes"),
      metric("teleAmpMade", "Teleop Amp Made", "notes"),
      metric("teleAmpMissed", "Teleop Amp Missed", "notes"),
      metric("climbAttempt", "Climb Attempt", "count", { aggregate: "max" }),
      metric("climbSuccess", "Climb Success", "count"),
      metric("driverPerformance", "Driver Performance", "rating", { optional: true }),
      metric("defenseOnThemRating", "Defense On Them", "rating", { optional: true }),
    ],
    derivedMetrics: [
      rateMetric("autoSpeakerAccuracy", "Auto Speaker Accuracy", ["autoSpeakerMade"], ["autoSpeakerMissed"]),
      rateMetric("autoAmpAccuracy", "Auto Amp Accuracy", ["autoAmpMade"], ["autoAmpMissed"]),
      rateMetric("teleSpeakerAccuracy", "Teleop Speaker Accuracy", ["teleSpeakerMade"], ["teleSpeakerMissed"]),
      rateMetric("teleAmpAccuracy", "Teleop Amp Accuracy", ["teleAmpMade"], ["teleAmpMissed"]),
      averageMetric("driverPerformanceAvg", "Driver Performance Average", ["driverPerformance"]),
      averageMetric("defenseOnThemAvg", "Defense On Them Average", ["defenseOnThemRating"]),
    ],
    scoringMatrixPresets: [
      {
        id: "crescendoNotePoints",
        label: "Crescendo Note Points",
        description: "Prefills note-scoring rows that map directly to scouting counts.",
        unit: "pts",
        weightedFields: [
          { field: "autoSpeakerMade", weight: 5 },
          { field: "autoAmpMade", weight: 2 },
          { field: "teleSpeakerMade", weight: 2 },
          { field: "teleAmpMade", weight: 1 },
        ],
      },
    ],
  },
  2025: {
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
    scouterMetrics: [
      metric("autoL4Made", "Auto L4 Made", "count"),
      metric("autoL4Missed", "Auto L4 Missed", "count"),
      metric("autoL3Made", "Auto L3 Made", "count"),
      metric("autoL3Missed", "Auto L3 Missed", "count"),
      metric("autoL2Made", "Auto L2 Made", "count"),
      metric("autoL2Missed", "Auto L2 Missed", "count"),
      metric("autoTroughMade", "Auto Trough Made", "count"),
      metric("autoTroughMissed", "Auto Trough Missed", "count"),
      metric("autoRemovedAlgaeMade", "Auto Removed Algae Made", "count"),
      metric("autoRemovedAlgaeMissed", "Auto Removed Algae Missed", "count"),
      metric("autoProcessorMade", "Auto Processor Made", "count"),
      metric("autoProcessorMissed", "Auto Processor Missed", "count"),
      metric("autoBargeMade", "Auto Barge Made", "count"),
      metric("autoBargeMissed", "Auto Barge Missed", "count"),
      metric("teleL4Made", "Teleop L4 Made", "count"),
      metric("teleL4Missed", "Teleop L4 Missed", "count"),
      metric("teleL3Made", "Teleop L3 Made", "count"),
      metric("teleL3Missed", "Teleop L3 Missed", "count"),
      metric("teleL2Made", "Teleop L2 Made", "count"),
      metric("teleL2Missed", "Teleop L2 Missed", "count"),
      metric("teleTroughMade", "Teleop Trough Made", "count"),
      metric("teleTroughMissed", "Teleop Trough Missed", "count"),
      metric("teleRemovedAlgaeMade", "Teleop Removed Algae Made", "count"),
      metric("teleRemovedAlgaeMissed", "Teleop Removed Algae Missed", "count"),
      metric("teleProcessorMade", "Teleop Processor Made", "count"),
      metric("teleProcessorMissed", "Teleop Processor Missed", "count"),
      metric("teleBargeMade", "Teleop Barge Made", "count"),
      metric("teleBargeMissed", "Teleop Barge Missed", "count"),
      metric("climbLevel", "Climb Level", "level"),
      metric("climbAttempt", "Climb Attempt", "count", { aggregate: "max" }),
      metric("driverPerformance", "Driver Performance", "rating", { optional: true }),
      metric("playedDefenseRating", "Played Defense", "rating", { optional: true }),
      metric("defenseOnThemRating", "Defense On Them", "rating", { optional: true }),
    ],
    derivedMetrics: [
      sumMetric("teleopTotal", "Teleop Total", ["coral", "algae"]),
      sumMetric("endgameTotal", "Endgame Total", ["climb"]),
      rateMetric("autoL4Accuracy", "Auto L4 Accuracy", ["autoL4Made"], ["autoL4Missed"]),
      rateMetric("autoL3Accuracy", "Auto L3 Accuracy", ["autoL3Made"], ["autoL3Missed"]),
      rateMetric("autoL2Accuracy", "Auto L2 Accuracy", ["autoL2Made"], ["autoL2Missed"]),
      rateMetric("autoTroughAccuracy", "Auto Trough Accuracy", ["autoTroughMade"], ["autoTroughMissed"]),
      rateMetric("teleL4Accuracy", "Teleop L4 Accuracy", ["teleL4Made"], ["teleL4Missed"]),
      rateMetric("teleL3Accuracy", "Teleop L3 Accuracy", ["teleL3Made"], ["teleL3Missed"]),
      rateMetric("teleL2Accuracy", "Teleop L2 Accuracy", ["teleL2Made"], ["teleL2Missed"]),
      rateMetric("teleTroughAccuracy", "Teleop Trough Accuracy", ["teleTroughMade"], ["teleTroughMissed"]),
      rateMetric("processorAccuracy", "Processor Accuracy", ["autoProcessorMade", "teleProcessorMade"], ["autoProcessorMissed", "teleProcessorMissed"]),
      rateMetric("bargeAccuracy", "Barge Accuracy", ["autoBargeMade", "teleBargeMade"], ["autoBargeMissed", "teleBargeMissed"]),
      averageMetric("driverPerformanceAvg", "Driver Performance Average", ["driverPerformance"]),
      averageMetric("playedDefenseAvg", "Played Defense Average", ["playedDefenseRating"]),
      averageMetric("defenseOnThemAvg", "Defense On Them Average", ["defenseOnThemRating"]),
    ],
    scoringMatrixPresets: [
      {
        id: "reefscapeCoralAlgaePoints",
        label: "Reefscape Coral + Algae Points",
        description: "Prefills coral and algae point values that map directly to scouting counts.",
        unit: "pts",
        weightedFields: [
          { field: "autoTroughMade", weight: 3 },
          { field: "autoL2Made", weight: 4 },
          { field: "autoL3Made", weight: 6 },
          { field: "autoL4Made", weight: 7 },
          { field: "autoProcessorMade", weight: 6 },
          { field: "autoBargeMade", weight: 4 },
          { field: "teleTroughMade", weight: 2 },
          { field: "teleL2Made", weight: 3 },
          { field: "teleL3Made", weight: 4 },
          { field: "teleL4Made", weight: 5 },
          { field: "teleProcessorMade", weight: 6 },
          { field: "teleBargeMade", weight: 4 },
        ],
      },
    ],
  },
  2026: {
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
    scouterMetrics: [
      metric("autoFuelPct", "Auto Fuel %", "%"),
      metric("transitionFuelPct", "Transition Fuel %", "%"),
      metric("shift1FuelPct", "Shift 1 Fuel %", "%"),
      metric("shift2FuelPct", "Shift 2 Fuel %", "%"),
      metric("shift3FuelPct", "Shift 3 Fuel %", "%"),
      metric("shift4FuelPct", "Shift 4 Fuel %", "%"),
      metric("endgameFuelPct", "Endgame Fuel %", "%"),
      metric("overallShooter", "Overall Shooter", "rating", { optional: true }),
      metric("overallPasser", "Overall Passer", "rating", { optional: true }),
      metric("overallIntake", "Overall Intake", "rating", { optional: true }),
      metric("overallDriver", "Overall Driver", "rating", { optional: true }),
      metric("overallDefenseAvoidance", "Overall Defense Avoidance", "rating", { optional: true }),
      metric("overallDefense", "Overall Defense", "rating", { optional: true }),
      metric("noShow", "No Show", "count"),
    ],
    formulaFields: [
      formulaField("alliance", "Alliance"),
      formulaField("startingPosition", "Starting Position"),
      formulaField("autoPrimaryRole", "Auto Primary Role"),
      formulaField("autoSecondaryRole", "Auto Secondary Role"),
      formulaField("autoClimbAttempt", "Auto Climb Attempt"),
      formulaField("transitionPrimaryRole", "Transition Primary Role"),
      formulaField("transitionSecondaryRole", "Transition Secondary Role"),
      formulaField("shift1PrimaryRole", "Shift 1 Primary Role"),
      formulaField("shift1SecondaryRole", "Shift 1 Secondary Role"),
      formulaField("shift2PrimaryRole", "Shift 2 Primary Role"),
      formulaField("shift2SecondaryRole", "Shift 2 Secondary Role"),
      formulaField("shift3PrimaryRole", "Shift 3 Primary Role"),
      formulaField("shift3SecondaryRole", "Shift 3 Secondary Role"),
      formulaField("shift4PrimaryRole", "Shift 4 Primary Role"),
      formulaField("shift4SecondaryRole", "Shift 4 Secondary Role"),
      formulaField("endgamePrimaryRole", "Endgame Primary Role"),
      formulaField("endgameSecondaryRole", "Endgame Secondary Role"),
      formulaField("teleopClimbAttempt", "Tele-Op Climb Attempt"),
      formulaField("overallNotes", "Overall Notes"),
    ],
    derivedMetrics: [
      averageMetric("fuelContributionAvg", "Fuel Contribution Average", ["autoFuelPct", "transitionFuelPct", "shift1FuelPct", "shift2FuelPct", "shift3FuelPct", "shift4FuelPct", "endgameFuelPct"], "%"),
      averageMetric("overallShooterAvg", "Overall Shooter Average", ["overallShooter"]),
      averageMetric("overallPasserAvg", "Overall Passer Average", ["overallPasser"]),
      averageMetric("overallIntakeAvg", "Overall Intake Average", ["overallIntake"]),
      averageMetric("overallDriverAvg", "Overall Driver Average", ["overallDriver"]),
      averageMetric("overallDefenseAvoidanceAvg", "Overall Defense Avoidance Average", ["overallDefenseAvoidance"]),
      averageMetric("overallDefenseAvg", "Overall Defense Average", ["overallDefense"]),
    ],
  },
};

const sourceLabels = {
  scouter: "Scouting",
  epa: "EPA",
  opr: "OPR",
  pridge: "pRidge",
  derived: "Derived",
};

function scouterMetricDefinitions(seasonOrEventModel) {
  if (!seasonOrEventModel) return [];
  if (Array.isArray(seasonOrEventModel.scouterMetricDefinitions) && seasonOrEventModel.scouterMetricDefinitions.length) {
    return seasonOrEventModel.scouterMetricDefinitions;
  }
  return Array.isArray(seasonOrEventModel.scouterMetrics) ? seasonOrEventModel.scouterMetrics : [];
}

function derivedMetricDefinitions(seasonOrEventModel) {
  if (!seasonOrEventModel) return [];
  if (Array.isArray(seasonOrEventModel.derivedMetricDefinitions)) return seasonOrEventModel.derivedMetricDefinitions;
  return seasonOrEventModel.derivedMetrics || [];
}

function formulaFieldDefinitions(seasonOrEventModel) {
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
  return [...scoringComponentFields, ...scouterMetricDefinitions(seasonOrEventModel), ...((seasonOrEventModel.formulaFields) || [])].filter((fieldDefinition) => {
    const fieldId = String(fieldDefinition?.id || "");
    if (!fieldId || seen.has(fieldId)) return false;
    seen.add(fieldId);
    return true;
  });
}

function csvHeaderForMetric(metricDefinition) {
  return metricDefinition.csvKey || (metricDefinition.unit === "pts" ? `${metricDefinition.id}Pts` : metricDefinition.id);
}

function metricFieldId(metricDefinition) {
  return String(csvHeaderForMetric(metricDefinition))
    .trim()
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function buildMetrics(season) {
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
    { id: "epa", label: sourceLabels.epa, components: scoringComponents },
    { id: "scouter", label: sourceLabels.scouter, components: scouterComponents },
    { id: "opr", label: sourceLabels.opr, components: [{ id: "total", label: "Total" }] },
    { id: "pridge", label: sourceLabels.pridge, components: [{ id: "total", label: "Total" }] },
    {
      id: "derived",
      label: sourceLabels.derived,
      components: [
        { id: "defenseImpact", label: "Defense Impact" },
        { id: "consistency", label: "Consistency" },
        ...derivedMetricDefinitions(season).map((metricDefinition) => ({ id: metricDefinition.id, label: metricDefinition.label })),
      ],
    },
  ];
}

globalThis.SeasonFramework = {
  averageMetric,
  buildCriteriaSources,
  buildMetrics,
  csvHeaderForMetric,
  derivedMetricDefinitions,
  formulaField,
  formulaFieldDefinitions,
  gameDefinitions,
  metric,
  metricFieldId,
  rateMetric,
  scouterMetricDefinitions,
  seasonDefinitions: gameDefinitions,
  sourceLabels,
  sumMetric,
  weightedMetric,
};
})();
