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

runTest("buildScoutingDiagnosticsState parses committed schema signatures and computes pending diagnostics", () => {
  const context = loadBrowserContext([
    "src/metric-engine.js",
    "src/scouting-dependency-diagnostics.js",
    "src/scouting-diagnostics-state.js",
  ]);

  const state = context.ScoutingDiagnosticsState.buildScoutingDiagnosticsState({
    committedSchemaSignature: JSON.stringify({
      fields: [
        { id: "autoFuelPct", label: "Auto Fuel %", type: "number", unit: "%" },
        { id: "driverSignal", label: "Driver Signal", type: "string", unit: "text" },
      ],
    }),
    currentFieldDefinitions: [
      { id: "autoFuelPct", label: "Auto Fuel %", type: "number", unit: "%" },
    ],
    previewFieldDefinitions: [
      { id: "autoFuelPct", label: "Auto Fuel %", type: "number", unit: "%" },
      { id: "newField", label: "New Field", type: "number", unit: "count" },
    ],
    equations: [
      { id: "signalScore", name: "Signal Score", formula: "average(scouting.driverSignal)" },
    ],
    filters: [],
    sortEquations: [],
  });

  assert.equal(state.committedFields.length, 2);
  assert.equal(state.currentDiagnostics.diagnostics.equations.some((entry) => entry.id === "signalScore"), true);
  assert.equal(state.pendingDiagnostics.schemaDiff.added.some((fieldDefinition) => fieldDefinition.id === "newField"), true);
  assert.equal(state.pendingDiagnostics.schemaDiff.removed.some((fieldDefinition) => fieldDefinition.id === "driverSignal"), true);
});

runTest("legacy schema signatures treat unmarked types as inferred", () => {
  const context = loadBrowserContext([
    "src/metric-engine.js",
    "src/scouting-dependency-diagnostics.js",
    "src/scouting-diagnostics-state.js",
  ]);

  const state = context.ScoutingDiagnosticsState.buildScoutingDiagnosticsState({
    committedSchemaSignature: JSON.stringify({ fields: [{ id: "alliance", type: "number" }] }),
    currentFieldDefinitions: [{ id: "alliance", type: "string", unit: "text" }],
  });

  assert.equal(state.currentDiagnostics.schemaDiff.typeChanged.length, 0);
  assert.equal(state.committedFields[0].typeDeclared, false);
});
