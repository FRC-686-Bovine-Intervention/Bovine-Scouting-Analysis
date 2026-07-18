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

runTest("dynamic scouting fields merge imported raw metric ids into seeded field definitions", () => {
  const context = loadBrowserContext(["src/season-framework.js", "src/dynamic-scouting-fields.js"]);
  const season = context.SeasonFramework.gameDefinitions[2026];
  const eventModel = {
    ...season,
    season: 2026,
    key: "2026chcmp",
    formulaFieldDefinitions: context.SeasonFramework.formulaFieldDefinitions(season),
  };

  const fields = context.DynamicScoutingFields.buildDynamicScoutingFieldDefinitions({
    eventModel,
    submissions: [
      {
        rawMetrics: {
          autoFuelPct: 50,
          customDefenseCallout: "Switchable",
        },
      },
    ],
  });

  assert.ok(fields.some((fieldDefinition) => fieldDefinition.id === "autoFuelPct"));
  const customField = fields.find((fieldDefinition) => fieldDefinition.id === "customDefenseCallout");
  assert.equal(customField.label, "Custom Defense Callout");
  assert.equal(customField.type, "string");
  assert.equal(customField.dynamic, true);
});

runTest("dynamic scouting fields infer numeric imported fields and omit removed ones when they disappear", () => {
  const context = loadBrowserContext(["src/season-framework.js", "src/dynamic-scouting-fields.js"]);
  const season = context.SeasonFramework.gameDefinitions[2025];
  const eventModel = {
    ...season,
    season: 2025,
    key: "2025chcmp",
    formulaFieldDefinitions: context.SeasonFramework.formulaFieldDefinitions(season),
  };

  const fieldsWithExtra = context.DynamicScoutingFields.buildDynamicScoutingFieldDefinitions({
    eventModel,
    submissions: [
      {
        rawMetrics: {
          customAutoBursts: 3,
        },
      },
    ],
  });
  const fieldsWithoutExtra = context.DynamicScoutingFields.buildDynamicScoutingFieldDefinitions({
    eventModel,
    submissions: [
      {
        rawMetrics: {
          autoL4Made: 2,
        },
      },
    ],
  });

  assert.equal(fieldsWithExtra.find((fieldDefinition) => fieldDefinition.id === "customAutoBursts").type, "number");
  assert.equal(fieldsWithoutExtra.some((fieldDefinition) => fieldDefinition.id === "customAutoBursts"), false);
});

runTest("dynamic scouting fields surface preview schema fields before submissions are committed", () => {
  const context = loadBrowserContext(["src/season-framework.js", "src/dynamic-scouting-fields.js"]);
  const season = context.SeasonFramework.gameDefinitions[2026];
  const eventModel = {
    ...season,
    season: 2026,
    key: "2026chcmp",
    formulaFieldDefinitions: context.SeasonFramework.formulaFieldDefinitions(season),
  };

  const fields = context.DynamicScoutingFields.buildDynamicScoutingFieldDefinitions({
    eventModel,
    submissions: [],
    schemaFields: [
      {
        id: "customDriverTag",
        label: "Driver Tag",
        type: "string",
        unit: "text",
        aggregate: "",
      },
    ],
  });

  const customField = fields.find((fieldDefinition) => fieldDefinition.id === "customDriverTag");
  assert.equal(customField.label, "Driver Tag");
  assert.equal(customField.type, "string");
  assert.equal(customField.dynamic, true);
});
