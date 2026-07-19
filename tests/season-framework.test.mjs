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

runTest("season metrics expose OPR as a total-only source", () => {
  const season = seasonFramework.gameDefinitions[2024];
  const metrics = seasonFramework.buildMetrics(season);
  const criteriaSources = seasonFramework.buildCriteriaSources(season);

  const oprMetrics = metrics.filter((metric) => metric.sourceId === "opr");
  assert.equal(oprMetrics.map((metric) => metric.id).join(","), "source:opr:total");

  const oprCriteriaSource = criteriaSources.find((source) => source.id === "opr");
  assert.equal(oprCriteriaSource.components.map((component) => component.id).join(","), "total");
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

  assert.equal(season2026.season, 2026);
  assert.equal("scouterMetrics" in season2026, false);
  assert.equal("formulaFields" in season2026, false);
  assert.equal("derivedMetrics" in season2026, false);
  assert.equal("scoringMatrixPresets" in season2026, false);
  assert.ok(Array.isArray(legacyScoutingSchemaSeeds["2026"].scouterMetrics));
  assert.ok(Array.isArray(legacyScoutingSchemaSeeds["2026"].derivedMetrics));
});
