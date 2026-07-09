(function () {
const seasonDefinitions = {
  2024: {
    label: "Crescendo",
    scoringComponents: [
      { id: "auto", label: "Auto", unit: "pts" },
      { id: "speaker", label: "Speaker", unit: "pts" },
      { id: "amp", label: "Amp", unit: "pts" },
      { id: "trap", label: "Trap", unit: "pts" },
    ],
    componentRatios: { auto: 0.2, speaker: 0.46, amp: 0.18, trap: 0.16 },
  },
  2025: {
    label: "Reefscape",
    scoringComponents: [
      { id: "auto", label: "Auto", unit: "pts" },
      { id: "coral", label: "Coral", unit: "pts" },
      { id: "algae", label: "Algae", unit: "pts" },
      { id: "climb", label: "Climb", unit: "pts" },
    ],
    componentRatios: { auto: 0.18, coral: 0.5, algae: 0.2, climb: 0.12 },
  },
  2026: {
    label: "Future Season Demo",
    scoringComponents: [
      { id: "auto", label: "Auto", unit: "pts" },
      { id: "cycle", label: "Cycle", unit: "pts" },
      { id: "endgame", label: "Endgame", unit: "pts" },
    ],
    componentRatios: { auto: 0.22, cycle: 0.58, endgame: 0.2 },
  },
};

const baseTeams = [
  {
    number: 118,
    name: "Robonauts",
    drivetrain: "swerve",
    flags: [{ type: "defense_specialist", label: "Defense", severity: "good", evidence: "Reduced opponent scoring in 3 marked defense matches." }],
    matches: [42, 50, 47, 54, 61, 38, 57, 62],
    epa: 49.1,
    pridge: 51.4,
    defenseImpact: 10.8,
    consistency: 82,
  },
  {
    number: 1678,
    name: "Citrus Circuits",
    drivetrain: "swerve",
    flags: [],
    matches: [58, 63, 61, 65, 67, 62, 64, 69],
    epa: 61.8,
    pridge: 63.2,
    defenseImpact: 2.1,
    consistency: 94,
  },
  {
    number: 254,
    name: "Cheesy Poofs",
    drivetrain: "swerve",
    flags: [],
    matches: [55, 57, 62, 60, 66, 64, 68, 70],
    epa: 60.4,
    pridge: 62.5,
    defenseImpact: 1.7,
    consistency: 92,
  },
  {
    number: 2056,
    name: "OP Robotics",
    drivetrain: "swerve",
    flags: [{ type: "inconsistent", label: "Inconsistent", severity: "warn", evidence: "Large scoring spread across qualification matches." }],
    matches: [38, 59, 41, 63, 46, 66, 44, 70],
    epa: 53.7,
    pridge: 55.9,
    defenseImpact: 4.2,
    consistency: 61,
  },
  {
    number: 2910,
    name: "Jack in the Bot",
    drivetrain: "swerve",
    flags: [],
    matches: [47, 51, 55, 58, 60, 61, 64, 66],
    epa: 56.5,
    pridge: 57.1,
    defenseImpact: 3.8,
    consistency: 88,
  },
  {
    number: 4414,
    name: "HighTide",
    drivetrain: "swerve",
    flags: [{ type: "declining", label: "Declining", severity: "warn", evidence: "Last 3 matches are 14% below event average for this team." }],
    matches: [64, 62, 59, 56, 51, 47, 43, 41],
    epa: 52.2,
    pridge: 50.8,
    defenseImpact: 2.9,
    consistency: 72,
  },
  {
    number: 6328,
    name: "Mechanical Advantage",
    drivetrain: "swerve",
    flags: [{ type: "data_suspect", label: "Suspect Data", severity: "warn", evidence: "One scout entry conflicts with alliance score by 28 points." }],
    matches: [45, 49, 77, 50, 52, 53, 55, 54],
    epa: 51.0,
    pridge: 50.1,
    defenseImpact: 3.2,
    consistency: 76,
  },
  {
    number: 7426,
    name: "Pair of Dice",
    drivetrain: "tank",
    flags: [
      { type: "do_not_pick", label: "DNP", severity: "danger", evidence: "Pit scouting notes drivetrain damage and repeated disconnects." },
      { type: "broken", label: "Broken", severity: "danger", evidence: "No mobility in final two observed matches." },
    ],
    matches: [31, 35, 33, 29, 24, 18, 4, 0],
    epa: 22.4,
    pridge: 20.5,
    defenseImpact: 1.1,
    consistency: 38,
  },
  {
    number: 971,
    name: "Spartan Robotics",
    drivetrain: "swerve",
    flags: [],
    matches: [46, 49, 52, 55, 57, 58, 60, 63],
    epa: 53.4,
    pridge: 54.2,
    defenseImpact: 4.8,
    consistency: 86,
  },
  {
    number: 1323,
    name: "MadTown Robotics",
    drivetrain: "swerve",
    flags: [],
    matches: [51, 53, 55, 58, 61, 63, 60, 66],
    epa: 57.8,
    pridge: 58.6,
    defenseImpact: 4.4,
    consistency: 89,
  },
  {
    number: 3005,
    name: "RoboChargers",
    drivetrain: "swerve",
    flags: [{ type: "data_suspect", label: "Sparse", severity: "warn", evidence: "Only 4 scouted matches imported." }],
    matches: [39, 43, 48, 51],
    epa: 44.9,
    pridge: 45.1,
    defenseImpact: 5.7,
    consistency: 70,
  },
  {
    number: 6800,
    name: "Valor",
    drivetrain: "tank",
    flags: [{ type: "defense_specialist", label: "Defense", severity: "good", evidence: "Scouters marked effective defense in 4 matches." }],
    matches: [26, 28, 30, 29, 31, 27, 32, 30],
    epa: 30.2,
    pridge: 31.4,
    defenseImpact: 12.6,
    consistency: 91,
  },
  {
    number: 27,
    name: "RUSH",
    drivetrain: "swerve",
    flags: [],
    matches: [43, 45, 47, 49, 52, 54, 53, 56],
    epa: 48.6,
    pridge: 49.3,
    defenseImpact: 5.1,
    consistency: 84,
  },
  {
    number: 33,
    name: "Killer Bees",
    drivetrain: "swerve",
    flags: [{ type: "defense_specialist", label: "Defense", severity: "good", evidence: "Strong pin timing and protected-zone awareness in recent matches." }],
    matches: [40, 42, 45, 46, 48, 49, 51, 50],
    epa: 46.8,
    pridge: 47.4,
    defenseImpact: 9.3,
    consistency: 86,
  },
  {
    number: 67,
    name: "HOT Team",
    drivetrain: "swerve",
    flags: [],
    matches: [49, 52, 50, 55, 57, 56, 58, 60],
    epa: 54.6,
    pridge: 55.2,
    defenseImpact: 4.7,
    consistency: 87,
  },
  {
    number: 148,
    name: "Robowranglers",
    drivetrain: "swerve",
    flags: [{ type: "climber", label: "Climb+", severity: "good", evidence: "Reliable endgame contribution in all imported matches." }],
    matches: [53, 56, 58, 59, 62, 64, 63, 65],
    epa: 58.9,
    pridge: 59.7,
    defenseImpact: 3.1,
    consistency: 90,
  },
  {
    number: 217,
    name: "ThunderChickens",
    drivetrain: "swerve",
    flags: [],
    matches: [44, 47, 49, 50, 48, 52, 54, 55],
    epa: 49.9,
    pridge: 50.6,
    defenseImpact: 6.2,
    consistency: 83,
  },
  {
    number: 359,
    name: "Hawaiian Kids",
    drivetrain: "tank",
    flags: [{ type: "inconsistent", label: "Inconsistent", severity: "warn", evidence: "Fast scoring cycles, but several dead-time stretches were observed." }],
    matches: [36, 44, 39, 52, 41, 55, 46, 57],
    epa: 45.3,
    pridge: 46.0,
    defenseImpact: 7.4,
    consistency: 64,
  },
  {
    number: 604,
    name: "Quixilver",
    drivetrain: "swerve",
    flags: [],
    matches: [41, 43, 45, 47, 46, 48, 50, 51],
    epa: 46.1,
    pridge: 46.8,
    defenseImpact: 4.9,
    consistency: 85,
  },
  {
    number: 1114,
    name: "Simbotics",
    drivetrain: "swerve",
    flags: [],
    matches: [56, 59, 61, 60, 64, 66, 65, 68],
    epa: 60.7,
    pridge: 61.6,
    defenseImpact: 3.9,
    consistency: 93,
  },
  {
    number: 1690,
    name: "Orbit",
    drivetrain: "swerve",
    flags: [],
    matches: [54, 57, 59, 62, 63, 61, 66, 67],
    epa: 59.4,
    pridge: 60.1,
    defenseImpact: 3.4,
    consistency: 91,
  },
  {
    number: 1796,
    name: "RoboTigers",
    drivetrain: "tank",
    flags: [{ type: "data_suspect", label: "Sparse", severity: "warn", evidence: "Only partial pit and match scouting is available." }],
    matches: [28, 34, 31, 36, 33, 38],
    epa: 34.8,
    pridge: 35.6,
    defenseImpact: 8.9,
    consistency: 67,
  },
  {
    number: 8840,
    name: "Bay Robotics",
    drivetrain: "swerve",
    flags: [{ type: "rising", label: "Rising", severity: "good", evidence: "Last three matches are trending above their event average." }],
    matches: [32, 36, 39, 42, 45, 48, 50, 53],
    epa: 42.7,
    pridge: 44.2,
    defenseImpact: 5.5,
    consistency: 79,
  },
  {
    number: 10255,
    name: "Five Digit Demo",
    drivetrain: "swerve",
    flags: [
      { type: "rising", label: "Rising", severity: "good", evidence: "Cycle times improved steadily over the last four matches." },
      { type: "data_suspect", label: "Sparse", severity: "warn", evidence: "One autonomous entry is missing from the scouting sheet." },
    ],
    matches: [30, 35, 37, 41, 43, 46, 49, 52],
    epa: 41.6,
    pridge: 43.1,
    defenseImpact: 6.6,
    consistency: 75,
  },
];

const eventSpecs = [
  {
    key: "2024miket",
    name: "Michigan Tech Event",
    season: 2024,
    matchesComplete: 54,
    scoreScale: 0.86,
    epaScale: 0.9,
    pridgeScale: 0.92,
    defenseScale: 0.95,
    consistencyOffset: -2,
    matchTemplate: [
      { number: 41, red: [1678, 4414, 6800], blue: [254, 3005, 7426] },
      { number: 42, red: [118, 2910, 6328], blue: [1323, 971, 2056] },
      { number: 43, red: [254, 971, 6800], blue: [1678, 118, 3005] },
      { number: 44, red: [2056, 1323, 7426], blue: [2910, 4414, 6328] },
    ],
  },
  {
    key: "2025lon",
    name: "Lone Star Regional",
    season: 2025,
    matchesComplete: 48,
    scoreScale: 1.02,
    epaScale: 1.04,
    pridgeScale: 1.03,
    defenseScale: 1,
    consistencyOffset: 0,
    matchTemplate: [
      { number: 38, red: [1678, 4414, 6800], blue: [254, 3005, 7426] },
      { number: 39, red: [118, 2910, 6328], blue: [1323, 971, 2056] },
      { number: 40, red: [254, 971, 6800], blue: [1678, 118, 3005] },
      { number: 41, red: [2056, 1323, 7426], blue: [2910, 4414, 6328] },
    ],
  },
  {
    key: "2026miket",
    name: "Lake Superior Regional",
    season: 2026,
    matchesComplete: 42,
    scoreScale: 1,
    epaScale: 1,
    pridgeScale: 1,
    defenseScale: 1,
    consistencyOffset: 0,
    matchTemplate: [
      { number: 38, red: [1678, 4414, 6800], blue: [254, 3005, 7426] },
      { number: 39, red: [118, 2910, 6328], blue: [1323, 971, 2056] },
      { number: 40, red: [254, 971, 6800], blue: [1678, 118, 3005] },
      { number: 41, red: [2056, 1323, 7426], blue: [2910, 4414, 6328] },
    ],
  },
];

const sourceLabels = {
  scouter: "Scouter Data",
  epa: "EPA",
  opr: "OPR",
  pridge: "pRidge",
  derived: "Derived",
};

const sourceUnits = {
  scouter: "pts",
  epa: "pts",
  opr: "pts",
  pridge: "pts",
  derived: "pts",
};

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value, digits = 1) {
  return Number(value.toFixed(digits));
}

function scaleMatches(values, factor, teamNumber) {
  return values.map((value, index) => {
    const wobble = ((teamNumber + index) % 3) - 1;
    return Math.max(0, Math.round(value * factor + wobble));
  });
}

function componentMap(total, components, ratios) {
  const entries = components.map((component, index) => {
    if (index === components.length - 1) return [component.id, round(total)];
    return [component.id, round(total * (ratios[component.id] || 0))];
  });
  const used = entries.slice(0, -1).reduce((sum, [, value]) => sum + value, 0);
  if (entries.length) {
    entries[entries.length - 1][1] = round(Math.max(0, total - used));
  }
  return Object.fromEntries(entries);
}

function trendScale(values, target) {
  const baseline = average(values) || 1;
  return values.map((value) => round((value / baseline) * target));
}

function buildMetrics(season) {
  const seasonComponents = season.scoringComponents;
  const sourceMetricOrder = [
    { sourceId: "scouter", label: "Scouter Total" },
    { sourceId: "epa", label: "EPA" },
    { sourceId: "opr", label: "OPR" },
    { sourceId: "pridge", label: "pRidge" },
  ];
  const metrics = sourceMetricOrder.flatMap((source) => [
    {
      id: `source:${source.sourceId}:total`,
      kind: "source",
      sourceId: source.sourceId,
      componentId: "total",
      label: source.label,
      shortLabel: source.label,
      unit: "pts",
    },
    ...seasonComponents.map((component) => ({
      id: `source:${source.sourceId}:${component.id}`,
      kind: "source",
      sourceId: source.sourceId,
      componentId: component.id,
      label: `${source.label} ${component.label}`,
      shortLabel: component.label,
      unit: component.unit,
    })),
  ]);
  return [
    ...metrics,
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
  ];
}

function buildCriteriaSources(season) {
  const components = [{ id: "total", label: "Total" }, ...season.scoringComponents.map((component) => ({ id: component.id, label: component.label }))];
  return [
    { id: "epa", label: sourceLabels.epa, components },
    { id: "scouter", label: sourceLabels.scouter, components },
    { id: "opr", label: sourceLabels.opr, components },
    { id: "pridge", label: sourceLabels.pridge, components },
    {
      id: "derived",
      label: sourceLabels.derived,
      components: [
        { id: "defenseImpact", label: "Defense Impact" },
        { id: "consistency", label: "Consistency" },
      ],
    },
  ];
}

function buildTeam(team, season, spec) {
  const matches = scaleMatches(team.matches, spec.scoreScale, team.number);
  const scouterTotal = round(average(matches));
  const epaTotal = round(team.epa * spec.epaScale);
  const pridgeTotal = round(team.pridge * spec.pridgeScale);
  const oprTotal = round(scouterTotal * 1.06);
  const defenseImpact = round(team.defenseImpact * spec.defenseScale);
  const consistency = Math.max(25, Math.min(99, Math.round(team.consistency + spec.consistencyOffset)));
  const sourceTotals = {
    scouter: scouterTotal,
    epa: epaTotal,
    opr: oprTotal,
    pridge: pridgeTotal,
  };
  const sources = Object.fromEntries(
    Object.entries(sourceTotals).map(([sourceId, total]) => [
      sourceId,
      {
        total,
        components: componentMap(total, season.scoringComponents, season.componentRatios),
        trend: trendScale(matches, total),
      },
    ]),
  );
  return {
    number: team.number,
    name: team.name,
    drivetrain: team.drivetrain,
    flags: team.flags,
    matches,
    sources,
    derived: {
      defenseImpact,
      consistency,
    },
  };
}

function sourceValue(team, sourceId, componentId = "total") {
  if (sourceId === "derived") {
    return Number(team.derived[componentId] || 0);
  }
  if (componentId === "total") {
    return Number(team.sources[sourceId]?.total || 0);
  }
  return Number(team.sources[sourceId]?.components?.[componentId] || 0);
}

function buildSeedPicklists(teams) {
  const byEpa = [...teams].sort((a, b) => sourceValue(b, "epa") - sourceValue(a, "epa") || a.number - b.number).map((team) => team.number);
  const byDefense = [...teams]
    .sort((a, b) => sourceValue(b, "derived", "defenseImpact") - sourceValue(a, "derived", "defenseImpact") || a.number - b.number)
    .map((team) => team.number);
  return [
    { id: "pick-first-pick", name: "First Pick", teams: byEpa },
    { id: "pick-defense-backup", name: "Defense / Backup", teams: byDefense },
  ];
}

function buildEventModel(spec) {
  const season = seasonDefinitions[spec.season];
  const teams = baseTeams.map((team) => buildTeam(team, season, spec));
  const metrics = buildMetrics(season);
  return {
    key: spec.key,
    name: spec.name,
    season: spec.season,
    seasonLabel: season.label,
    matchesComplete: spec.matchesComplete,
    matches: spec.matchTemplate,
    scoringComponents: season.scoringComponents,
    metrics,
    criteriaSources: buildCriteriaSources(season),
    teams,
    teamNumbers: teams.map((team) => team.number).sort((a, b) => a - b),
    defaultMetricId: "source:epa:total",
    defaultTeamDetailMetricId: "source:scouter:total",
    seedSortEquations: [
      {
        id: "sort-defense-backup",
        name: "Defense / Backup Formula",
        terms: [
          { operator: "+", weight: 0.05, source: "scouter", component: "total" },
          { operator: "+", weight: 0.75, source: "derived", component: "defenseImpact" },
          { operator: "+", weight: 0.2, source: "derived", component: "consistency" },
        ],
      },
    ],
    seedPicklists: buildSeedPicklists(teams),
    dataSources: [
      {
        name: "Scouting Spreadsheet",
        status: "Mocked import",
        updated: `${spec.matchesComplete} seeded matches`,
        notes: "CSV/XLSX import contract is represented, but files are not parsed yet.",
      },
      {
        name: "The Blue Alliance",
        status: "Mocked sync",
        updated: `${spec.season} ${season.label} event shell loaded`,
        notes: "Event teams, rankings, and schedule are demo data shaped like TBA inputs.",
      },
      {
        name: "Statbotics EPA",
        status: "Mocked sync",
        updated: `${spec.season} EPA values seeded`,
        notes: "EPA is modeled as a refreshable source with season-specific scoring components.",
      },
      {
        name: "pRidge",
        status: "Mocked sync",
        updated: `${spec.season} pRidge values seeded`,
        notes: "pRidge is available as a metric source and weighted-sum component.",
      },
    ],
  };
}

const eventCatalog = eventSpecs.map(buildEventModel);
globalThis.eventCatalog = eventCatalog;
})();
