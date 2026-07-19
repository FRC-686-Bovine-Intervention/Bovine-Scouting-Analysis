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

function loadBrowserScript(relativePath, exportName) {
  const sourcePath = path.resolve(relativePath);
  const source = fs.readFileSync(sourcePath, "utf8");
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
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: sourcePath });
  return context[exportName];
}

const scoutingSchemaRuntime = loadBrowserScript("src/scouting-schema-runtime.js", "ScoutingSchemaRuntime");

runTest("generic metric catalog exposes provider totals and schema-driven scouting metrics", () => {
  const metrics = scoutingSchemaRuntime.buildMetricCatalog({
    scoringComponents: [
      { id: "auto", label: "Auto", unit: "pts" },
      { id: "cycle", label: "Cycle", unit: "pts" },
    ],
    scouterMetricDefinitions: [
      { id: "autoFuelPct", label: "Auto Fuel %", unit: "%" },
      { id: "overallDriver", label: "Overall Driver", unit: "rating" },
    ],
    derivedMetricDefinitions: [
      { id: "fuelContributionAvg", label: "Fuel Contribution Average", unit: "%" },
    ],
  });

  assert.equal(metrics.some((metric) => metric.id === "source:scouter:autoFuelPct"), true);
  assert.equal(metrics.some((metric) => metric.id === "source:scouter:overallDriver"), true);
  assert.equal(metrics.some((metric) => metric.id === "source:statbotics:auto"), true);
  assert.equal(metrics.some((metric) => metric.id === "source:opr:total"), false);
  assert.equal(metrics.some((metric) => metric.id === "source:pridge:total"), true);
  assert.equal(metrics.some((metric) => metric.id === "derived:fuelContributionAvg"), true);
});

runTest("formula field definitions remain schema-driven when explicit formula fields are absent", () => {
  const definitions = scoutingSchemaRuntime.formulaFieldDefinitions({
    scoringComponents: [{ id: "auto", label: "Auto", unit: "pts" }],
    scouterMetricDefinitions: [{ id: "autoFuelPct", label: "Auto Fuel %", unit: "%" }],
    formulaFields: [{ id: "autoPrimaryRole", label: "Auto Primary Role", unit: "text" }],
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(definitions.map((fieldDefinition) => fieldDefinition.id))),
    ["auto", "autoFuelPct", "autoPrimaryRole"],
  );
});
