import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function loadBrowserContext(relativePaths, extras = {}) {
  const context = {
    globalThis: {},
    console,
    Set,
    Map,
    Math,
    Number,
    Array,
    Object,
    String,
    JSON,
    ...extras,
  };
  context.globalThis = context;
  relativePaths.forEach((relativePath) => {
    const sourcePath = path.resolve(relativePath);
    const source = fs.readFileSync(sourcePath, "utf8");
    vm.runInNewContext(source, context, { filename: sourcePath });
  });
  return context;
}

runTest("compareScoutingFieldDefinitions reports added and removed fields", () => {
  const context = loadBrowserContext(["src/metric-engine.js", "src/scouting-dependency-diagnostics.js"]);
  const diff = context.ScoutingDependencyDiagnostics.compareScoutingFieldDefinitions(
    [
      { id: "autoFuelPct", label: "Auto Fuel %", type: "number" },
      { id: "driverNote", label: "Driver Note", type: "string" },
      { id: "defenseRating", label: "Defense Rating", type: "number" },
    ],
    [
      { id: "autoFuelPct", label: "Auto Fuel %", type: "number" },
      { id: "driverNote", label: "Driver Note", type: "number" },
      { id: "newCyclePlan", label: "New Cycle Plan", type: "string" },
    ],
  );

  assert.deepEqual(JSON.parse(JSON.stringify(diff.added.map((fieldDefinition) => fieldDefinition.id))), ["newCyclePlan"]);
  assert.deepEqual(JSON.parse(JSON.stringify(diff.removed.map((fieldDefinition) => fieldDefinition.id))), ["defenseRating"]);
  assert.deepEqual(JSON.parse(JSON.stringify(diff.typeChanged)), []);
});

runTest("compareScoutingFieldDefinitions treats string schema field ids as committed fields", () => {
  const context = loadBrowserContext(["src/metric-engine.js", "src/scouting-dependency-diagnostics.js"]);
  const diff = context.ScoutingDependencyDiagnostics.compareScoutingFieldDefinitions(
    [
      "autoFuelPct",
      "climbLevel",
      "notes",
    ],
    [
      { id: "autoFuelPct", label: "Auto Fuel %", type: "number" },
      { id: "climbHeight", label: "Climb Height", type: "number" },
      { id: "notes", label: "Notes", type: "string" },
    ],
  );

  assert.deepEqual(JSON.parse(JSON.stringify(diff.added.map((fieldDefinition) => fieldDefinition.id))), ["climbHeight"]);
  assert.deepEqual(JSON.parse(JSON.stringify(diff.removed.map((fieldDefinition) => fieldDefinition.id))), ["climbLevel"]);
  assert.deepEqual(JSON.parse(JSON.stringify(diff.typeChanged)), []);
});

runTest("buildScoutingDependencyDiagnostics propagates removed-field roots through equations filters and sort equations", () => {
  const context = loadBrowserContext(["src/metric-engine.js", "src/scouting-dependency-diagnostics.js"]);
  const result = context.ScoutingDependencyDiagnostics.buildScoutingDependencyDiagnostics({
    previousFields: [
      { id: "autoFuelPct", type: "number" },
      { id: "driverSignal", type: "string" },
    ],
    currentFields: [
      { id: "driverSignal", type: "number" },
    ],
    equations: [
      { id: "fuelScore", name: "Fuel Score", formula: "average(scouting.autoFuelPct)" },
      { id: "signalAndFuel", name: "Signal And Fuel", formula: "fuelScore + if(scouting.driverSignal > 0, 1, 0)" },
    ],
    filters: [
      { id: "goodFuel", name: "Good Fuel", formula: "signalAndFuel > 10" },
    ],
    sortEquations: [
      { id: "sort-main", name: "Main Sort", terms: [{ operator: "+", weight: 1, metricId: "derived:signalAndFuel" }] },
    ],
  });

  assert.equal(result.diagnostics.roots.some((entry) => entry.id === "autoFuelPct" && entry.reason === "removed"), true);
  assert.equal(result.diagnostics.roots.some((entry) => entry.id === "driverSignal"), false);
  assert.equal(result.diagnostics.equations.some((entry) => entry.id === "fuelScore"), true);
  assert.equal(result.diagnostics.equations.some((entry) => entry.id === "signalAndFuel"), true);
  assert.equal(result.diagnostics.filters.some((entry) => entry.id === "goodFuel"), true);
  assert.equal(result.diagnostics.sortEquations.some((entry) => entry.id === "sort-main"), true);
});

runTest("buildScoutingDependencyDiagnostics flags missing scouting references even without a prior schema", () => {
  const context = loadBrowserContext(["src/metric-engine.js", "src/scouting-dependency-diagnostics.js"]);
  const result = context.ScoutingDependencyDiagnostics.buildScoutingDependencyDiagnostics({
    previousFields: [],
    currentFields: [{ id: "autoFuelPct", type: "number" }],
    equations: [
      { id: "mystery", name: "Mystery", formula: "average(scouting.defenseCallout)" },
    ],
  });

  assert.equal(result.diagnostics.roots.some((entry) => entry.id === "defenseCallout" && entry.reason === "missing"), true);
  assert.equal(result.diagnostics.equations.some((entry) => entry.id === "mystery"), true);
});

runTest("buildScoutingDependencyDiagnostics ignores built-in scouting helper fields", () => {
  const context = loadBrowserContext(["src/metric-engine.js", "src/scouting-dependency-diagnostics.js"]);
  const result = context.ScoutingDependencyDiagnostics.buildScoutingDependencyDiagnostics({
    previousFields: [
      { id: "autoFuelPct", type: "number" },
    ],
    currentFields: [
      { id: "autoFuelPct", type: "number" },
    ],
    equations: [
      { id: "shareGate", name: "Share Gate", formula: "if(allianceCount(scouting.hasEntry) > 0, average(scouting.autoFuelPct), 0)" },
    ],
    filters: [
      { id: "hasEntry", name: "Has Entry", formula: "scouting.hasEntry > 0" },
    ],
  });

  assert.equal(context.ScoutingDependencyDiagnostics.isBuiltInScoutingFieldId("hasEntry"), true);
  assert.equal(context.ScoutingDependencyDiagnostics.isBuiltInScoutingFieldId("total"), false);
  assert.equal(result.diagnostics.roots.some((entry) => entry.id === "hasEntry"), false);
  assert.equal(result.diagnostics.equations.some((entry) => entry.id === "shareGate"), false);
  assert.equal(result.diagnostics.filters.some((entry) => entry.id === "hasEntry"), false);
});

runTest("buildScoutingDependencyDiagnostics treats legacy scouting-prefixed derived equation references as equation dependencies", () => {
  const context = loadBrowserContext(["src/metric-engine.js", "src/scouting-dependency-diagnostics.js"]);
  const result = context.ScoutingDependencyDiagnostics.buildScoutingDependencyDiagnostics({
    previousFields: [
      { id: "autoSpeakerMade", type: "number" },
      { id: "autoAmpMade", type: "number" },
      { id: "teleSpeakerMade", type: "number" },
      { id: "teleAmpMade", type: "number" },
    ],
    currentFields: [
      { id: "autoSpeakerMade", type: "number" },
      { id: "autoAmpMade", type: "number" },
      { id: "teleSpeakerMade", type: "number" },
      { id: "teleAmpMade", type: "number" },
    ],
    equations: [
      { id: "scoutingTotal", name: "Scouting Total", formula: "scouting.auto + scouting.speaker + scouting.amp + scouting.trap" },
      { id: "auto", name: "Auto", formula: "average(scouting.autoSpeakerMade * 5 + scouting.autoAmpMade * 2)" },
      { id: "speaker", name: "Speaker", formula: "average(scouting.teleSpeakerMade * 2)" },
      { id: "amp", name: "Amp", formula: "average(scouting.teleAmpMade)" },
      { id: "trap", name: "Trap", formula: "0" },
    ],
  });

  assert.equal(result.diagnostics.roots.some((entry) => ["auto", "speaker", "amp", "trap"].includes(entry.id)), false);
  assert.equal(result.diagnostics.equations.some((entry) => entry.id === "scoutingTotal"), false);
});
