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
    JSON,
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: sourcePath });
  return context[exportName];
}

const scoutingProfiles = loadBrowserScript("src/scouting-profiles.js", "ScoutingProfiles");

runTest("buildProfileVersionKey is stable for equivalent profiles and changes when schema changes", () => {
  const left = scoutingProfiles.buildProfileVersionKey({
    id: "match-current-v2",
    fields: [
      { id: "autoSpeakerMade", label: "Auto Speaker Made", type: "number", unit: "count" },
      { id: "teleAmpMade", label: "Tele Amp Made", type: "number", unit: "count" },
    ],
    derivedEquations: [{ id: "speakerTotal", name: "Speaker Total", formula: "sum(scouting.autoSpeakerMade)" }],
  });
  const right = scoutingProfiles.buildProfileVersionKey({
    id: "match-current-v2",
    fields: [
      { label: "Auto Speaker Made", id: "autoSpeakerMade", unit: "count", type: "number" },
      { unit: "count", type: "number", id: "teleAmpMade", label: "Tele Amp Made" },
    ],
    derivedEquations: [{ name: "Speaker Total", formula: "sum(scouting.autoSpeakerMade)", id: "speakerTotal" }],
  });
  const changed = scoutingProfiles.buildProfileVersionKey({
    id: "match-current-v2",
    fields: [
      { id: "autoSpeakerMade", label: "Auto Speaker Made", type: "number", unit: "count" },
      { id: "teleAmpMissed", label: "Tele Amp Missed", type: "number", unit: "count" },
    ],
    derivedEquations: [{ id: "speakerTotal", name: "Speaker Total", formula: "sum(scouting.autoSpeakerMade)" }],
  });

  assert.equal(left, right);
  assert.notEqual(left, changed);
});

runTest("materializeEventScopedProfileCatalog projects legacy season profiles onto event keys without overwriting explicit event profiles", () => {
  const materialized = scoutingProfiles.materializeEventScopedProfileCatalog(
    {
      "2025": [
        { id: "match-current-v2", label: "Season Seed" },
      ],
      "2025demo-b": [
        { id: "match-current-v2", label: "Explicit Event Profile" },
      ],
    },
    [
      { key: "2025demo-a", season: 2025 },
      { key: "2025demo-b", season: 2025 },
      { key: "2026demo-a", season: 2026 },
    ],
  );

  assert.deepEqual(JSON.parse(JSON.stringify(materialized)), {
    "2025": [
      { id: "match-current-v2", label: "Season Seed" },
    ],
    "2025demo-b": [
      { id: "match-current-v2", label: "Explicit Event Profile" },
    ],
    "2025demo-a": [
      { id: "match-current-v2", label: "Season Seed" },
    ],
  });
});
