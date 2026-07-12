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
    String,
    JSON,
    Object,
    Array,
    Math,
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

runTest("buildExternalSourceSnapshot captures provider-specific event slices", () => {
  const context = loadBrowserContext(["src/external-source-snapshots.js"]);
  const eventModel = {
    key: "2026test",
    teamNumbers: [1, 2],
    scoringComponents: [{ id: "auto" }, { id: "teleop" }],
    matches: [{ number: 1, key: "qm1", red: [1, 2, 3], blue: [4, 5, 6], scoreBreakdown: { red: { totalPoints: 10 } } }],
    teams: [
      {
        number: 1,
        sources: {
          epa: { total: 12, components: { auto: 4, teleop: 8 }, trend: [10, 12] },
          pridge: { total: 11, components: { auto: 3, teleop: 8 }, trend: [9, 11] },
        },
      },
    ],
  };

  const tba = context.ExternalSourceSnapshots.buildExternalSourceSnapshot("tba", eventModel);
  const statbotics = context.ExternalSourceSnapshots.buildExternalSourceSnapshot("statbotics", eventModel);
  const pridge = context.ExternalSourceSnapshots.buildExternalSourceSnapshot("pridge", eventModel);

  assert.equal(tba.matches[0].key, "qm1");
  assert.equal(tba.matches[0].redScore, null);
  assert.equal(tba.matches[0].blueScore, null);
  assert.equal(statbotics.teams[0].total, 12);
  assert.equal(statbotics.teams[0].components.auto, 4);
  assert.equal(pridge.teams[0].total, 11);
  assert.equal(pridge.teams[0].components.teleop, 8);
});

runTest("buildExternalSourceSnapshot includes TBA alliance scores and winner in the fingerprint payload", () => {
  const context = loadBrowserContext(["src/external-source-snapshots.js"]);
  const eventModel = {
    key: "2026scores",
    teamNumbers: [1, 2],
    scoringComponents: [],
    matches: [
      {
        number: 3,
        key: "qm3",
        red: [1, 2, 3],
        blue: [4, 5, 6],
        redScore: 142,
        blueScore: 138,
        winningAlliance: "red",
        scoreBreakdown: null,
      },
    ],
    teams: [],
  };

  const snapshot = context.ExternalSourceSnapshots.buildExternalSourceSnapshot("tba", eventModel);

  assert.equal(snapshot.matches[0].redScore, 142);
  assert.equal(snapshot.matches[0].blueScore, 138);
  assert.equal(snapshot.matches[0].winningAlliance, "red");
});

runTest("seedExternalSourceFingerprints fills missing external baselines without overwriting existing ones", () => {
  const context = loadBrowserContext(["src/external-source-snapshots.js"]);
  const eventModel = {
    key: "2026test",
    teamNumbers: [1],
    scoringComponents: [{ id: "auto" }],
    matches: [],
    teams: [{ number: 1, sources: { epa: { total: 12, components: { auto: 4 }, trend: [] }, pridge: { total: 11, components: { auto: 3 }, trend: [] } } }],
  };
  const workspace = {
    sources: {
      tba: { sourceId: "tba", sourceFingerprint: "" },
      statbotics: { sourceId: "statbotics", sourceFingerprint: "keep-me" },
      pridge: { sourceId: "pridge", sourceFingerprint: "" },
    },
  };

  const seeded = context.ExternalSourceSnapshots.seedExternalSourceFingerprints(workspace, eventModel);

  assert.ok(seeded.sources.tba.sourceFingerprint.startsWith("fnv1a:"));
  assert.equal(seeded.sources.statbotics.sourceFingerprint, "keep-me");
  assert.ok(seeded.sources.pridge.sourceFingerprint.startsWith("fnv1a:"));
  assert.notEqual(seeded, workspace);
});

runTest("buildSnapshotFingerprint is stable for unchanged provider snapshots", () => {
  const context = loadBrowserContext(["src/external-source-snapshots.js"]);
  const snapshot = {
    eventKey: "2026test",
    teams: [{ number: 1, total: 12 }],
  };

  const first = context.ExternalSourceSnapshots.buildSnapshotFingerprint(snapshot);
  const second = context.ExternalSourceSnapshots.buildSnapshotFingerprint(snapshot);

  assert.equal(first, second);
});
