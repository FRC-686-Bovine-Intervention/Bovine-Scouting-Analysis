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

function loadBrowserScripts(relativePaths, exportName) {
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
  relativePaths.forEach((relativePath) => {
    const sourcePath = path.resolve(relativePath);
    const source = fs.readFileSync(sourcePath, "utf8");
    vm.runInNewContext(source, context, { filename: sourcePath });
  });
  return context[exportName];
}

function loadLegacyScoutingSchemaSeeds() {
  return loadBrowserScripts(["src/legacy-scouting-schema-seeds.js"], "LegacyScoutingSchemaSeeds");
}

const seasonFramework = loadBrowserScripts(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js"], "SeasonFramework");
const legacyScoutingSchemaSeeds = loadLegacyScoutingSchemaSeeds();

runTest("season metrics expose pRidge as a total-only source", () => {
  const season = seasonFramework.gameDefinitions[2026];
  const metrics = seasonFramework.buildMetrics(season);
  const criteriaSources = seasonFramework.buildCriteriaSources(season);

  const pridgeMetrics = metrics.filter((metric) => metric.sourceId === "pridge");
  assert.equal(pridgeMetrics.map((metric) => metric.id).join(","), "source:pridge:total");

  const pridgeCriteriaSource = criteriaSources.find((source) => source.id === "pridge");
  assert.equal(pridgeCriteriaSource.components.map((component) => component.id).join(","), "total");
});

runTest("season metrics do not inject legacy derived metrics that no longer exist", () => {
  const season = seasonFramework.gameDefinitions[2026];
  const metrics = seasonFramework.buildMetrics(season);
  const criteriaSources = seasonFramework.buildCriteriaSources(season);
  const derivedMetric = metrics.find((metric) => metric.id === "derived:fuelContributionAvg");

  assert.equal(metrics.some((metric) => metric.id === "derived:defenseImpact"), false);
  assert.equal(metrics.some((metric) => metric.id === "derived:consistency"), false);
  assert.equal(metrics.some((metric) => metric.id === "derived:fuelContributionAvg"), true);
  assert.equal(derivedMetric.label, "fuelContributionAvg");
  assert.equal(derivedMetric.unit, "%");

  const derivedCriteriaSource = criteriaSources.find((source) => source.id === "derived");
  assert.equal(derivedCriteriaSource.components.some((component) => component.id === "defenseImpact"), false);
  assert.equal(derivedCriteriaSource.components.some((component) => component.id === "consistency"), false);
  assert.equal(derivedCriteriaSource.components.some((component) => component.id === "fuelContributionAvg"), true);
});

runTest("season metrics expose Statbotics under its provider name", () => {
  const season = seasonFramework.gameDefinitions[2024];
  const metrics = seasonFramework.buildMetrics(season);
  const criteriaSources = seasonFramework.buildCriteriaSources(season);

  const statboticsMetrics = metrics.filter((metric) => metric.sourceId === "statbotics");
  assert.equal(statboticsMetrics.map((metric) => metric.id).join(","), "source:statbotics:total,source:statbotics:auto,source:statbotics:speaker,source:statbotics:amp,source:statbotics:trap");

  const statboticsCriteriaSource = criteriaSources.find((source) => source.id === "statbotics");
  assert.equal(statboticsCriteriaSource.components.map((component) => component.id).join(","), "total,auto,speaker,amp,trap");
});

runTest("season metrics do not expose OPR as a separate source", () => {
  const season = seasonFramework.gameDefinitions[2024];
  const metrics = seasonFramework.buildMetrics(season);
  const criteriaSources = seasonFramework.buildCriteriaSources(season);

  assert.equal(metrics.some((metric) => metric.sourceId === "opr"), false);
  assert.equal(criteriaSources.some((source) => source.id === "opr"), false);
});

runTest("formula field definitions include scoring components for derived equations", () => {
  const season2024 = seasonFramework.gameDefinitions[2024];
  const season2025 = seasonFramework.gameDefinitions[2025];
  const season2026 = seasonFramework.gameDefinitions[2026];

  assert.equal(
    seasonFramework.formulaFieldDefinitions(season2024).some((fieldDefinition) => fieldDefinition.id === "speaker"),
    true,
  );
  assert.equal(
    seasonFramework.formulaFieldDefinitions(season2025).some((fieldDefinition) => fieldDefinition.id === "coral"),
    true,
  );
  assert.equal(
    seasonFramework.formulaFieldDefinitions(season2026).some((fieldDefinition) => fieldDefinition.id === "cycle"),
    true,
  );
});

runTest("gameDefinitions exposes provider metadata without owning scouting schema fields", () => {
  const season2026 = seasonFramework.gameDefinitions[2026];
  const legacyDerivedMetric = legacyScoutingSchemaSeeds["2026"].derivedMetrics[0];

  assert.equal(season2026.season, 2026);
  assert.equal("scouterMetrics" in season2026, false);
  assert.equal("formulaFields" in season2026, false);
  assert.equal("derivedMetrics" in season2026, false);
  assert.equal("scoringMatrixPresets" in season2026, false);
  assert.ok(Array.isArray(legacyScoutingSchemaSeeds["2026"].scouterMetrics));
  assert.ok(Array.isArray(legacyScoutingSchemaSeeds["2026"].derivedMetrics));
  assert.equal(legacyDerivedMetric.name, "fuelContributionAvg");
  assert.equal("id" in legacyDerivedMetric, false);
  assert.equal("label" in legacyDerivedMetric, false);
  assert.equal("unit" in legacyDerivedMetric, false);
});
