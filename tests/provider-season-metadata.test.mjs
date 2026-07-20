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

runTest("provider season metadata can remain empty so provider-backed years stay generic", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(providerSeasonMetadata.seasons)), {});
});
