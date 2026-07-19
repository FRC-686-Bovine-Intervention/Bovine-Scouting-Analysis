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

const providerSeasonMetadata = loadBrowserScript("src/provider-season-metadata.js", "ProviderSeasonMetadata");

runTest("provider season metadata keeps only provider-facing season context", () => {
  const metadata2025 = providerSeasonMetadata.seasons[2025];

  assert.equal(metadata2025.label, "Reefscape");
  assert.deepEqual(
    JSON.parse(JSON.stringify(metadata2025.scoringComponents.map((component) => component.id))),
    ["auto", "coral", "algae", "climb"],
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(Object.keys(metadata2025.breakdownMap))),
    ["auto", "coral", "algae", "climb"],
  );
  assert.equal("scouterMetrics" in metadata2025, false);
  assert.equal("formulaFields" in metadata2025, false);
  assert.equal("derivedMetrics" in metadata2025, false);
  assert.equal("scoringMatrixPresets" in metadata2025, false);
});
