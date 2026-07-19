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

const scoutingProfileSeeds = loadBrowserScript("src/scouting-profile-seeds.js", "ScoutingProfileSeeds");

runTest("seeded profile equations expose scoutingTotal without the legacy scouting.total helper", () => {
  ["2024", "2025", "2026"].forEach((seasonKey) => {
    const seededProfile = scoutingProfileSeeds.seasons[seasonKey].find((profile) => profile.id === "match-current-v2");
    const scoutingTotal = seededProfile?.equations?.find((definition) => definition.id === "scoutingTotal");
    assert.ok(scoutingTotal, `Season ${seasonKey} should seed scoutingTotal`);
    assert.equal(scoutingTotal.formula.includes("scouting.total"), false);
  });
});
