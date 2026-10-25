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
      { name: "fuelContributionAvg", formula: "average", fields: ["autoFuelPct"] },
    ],
  });

  const derivedMetric = metrics.find((metric) => metric.id === "derived:fuelContributionAvg");
  assert.equal(metrics.some((metric) => metric.id === "source:scouter:autoFuelPct"), true);
  assert.equal(metrics.some((metric) => metric.id === "source:scouter:overallDriver"), true);
  assert.equal(metrics.some((metric) => metric.id === "source:statbotics:auto"), true);
  assert.equal(metrics.some((metric) => metric.id === "source:opr:total"), false);
  assert.equal(metrics.some((metric) => metric.id === "source:pridge:epa.total_points"), true);
  assert.equal(metrics.some((metric) => metric.id === "derived:fuelContributionAvg"), true);
  assert.equal(metrics.some((metric) => metric.id === "derived:defenseImpact"), false);
  assert.equal(metrics.some((metric) => metric.id === "derived:consistency"), false);
  assert.equal(derivedMetric.label, "fuelContributionAvg");
  assert.equal(derivedMetric.unit, "%");
});

runTest("runtime metric catalog keeps generated pRidge totals unique by ID and source", () => {
  const metrics = scoutingSchemaRuntime.buildMetricCatalog({
    pridgeResponseDefinitions: [
      { id: "epa.total_points", label: "Generated live pRidge total", unit: "pts" },
      { id: "epa.total_points", label: "Repeated live pRidge total", unit: "pts" },
      { id: "tbaTotalAutoPoints", label: "TBA total auto points", unit: "pts" },
    ],
  });
  const pRidgeTotals = metrics.filter((metric) => metric.id === "source:pridge:epa.total_points");
  assert.equal(pRidgeTotals.length, 1);
  assert.equal(pRidgeTotals[0].sourceId, "pridge");
  assert.equal(metrics.filter((metric) => metric.id === "source:pridge:tbaTotalAutoPoints").length, 1);
  assert.equal(metrics.filter((metric) => metric.id === "source:statbotics:epa.total_points").length, 0);
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
