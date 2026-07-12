import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

async function runTest(name, fn) {
  try {
    await fn();
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
    Date,
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

function createFetchStub(routes) {
  return async function fetchStub(url) {
    if (!(url in routes)) {
      return {
        ok: false,
        status: 404,
        json: async () => ({}),
      };
    }
    const value = routes[url];
    if (value instanceof Error) throw value;
    if (value && value.error) throw value.error;
    return {
      ok: true,
      status: 200,
      json: async () => value,
    };
  };
}

async function main() {
await runTest("loadEventByCode builds an event model and ready provider states from live payloads", async () => {
  const baseUrls = {
    tba: "https://tba.test/api",
    statbotics: "https://statbotics.test/api",
  };
  const context = loadBrowserContext([
    "src/season-framework.js",
    "src/prior-ridge.js",
    "src/event-model-builder.js",
    "src/external-source-snapshots.js",
    "src/external-event-loader.js",
  ]);
  const fetchImpl = createFetchStub({
    [`${baseUrls.tba}/event/2026test`]: { key: "2026test", year: 2026, name: "Unit Test Event" },
    [`${baseUrls.tba}/event/2026test/teams`]: [
      { team_number: 111, nickname: "Alpha" },
      { team_number: 222, nickname: "Beta" },
      { team_number: 333, nickname: "Gamma" },
      { team_number: 444, nickname: "Delta" },
      { team_number: 555, nickname: "Epsilon" },
      { team_number: 666, nickname: "Zeta" },
    ],
    [`${baseUrls.tba}/event/2026test/matches`]: [
      {
        comp_level: "qm",
        match_number: 1,
        set_number: 1,
        winning_alliance: "red",
        alliances: {
          red: { team_keys: ["frc111", "frc222", "frc333"], score: 180 },
          blue: { team_keys: ["frc444", "frc555", "frc666"], score: 150 },
        },
      },
    ],
    [`${baseUrls.statbotics}/event/2026test`]: { year: 2026, status: "In Progress" },
    [`${baseUrls.statbotics}/team_events/event/2026test`]: [
      {
        team: 111,
        epa: {
          total_points: 42.5,
          breakdown: { auto_points: 10, teleop_points: 20, endgame_points: 12.5 },
          stats: { mean: 41, start: 39, pre_elim: 43, max: 48 },
        },
        record: { qual: { count: 12, rank: 4, rps_per_match: 2.8 } },
      },
      {
        team: 222,
        epa: {
          total_points: 38.2,
          breakdown: { auto_points: 9, teleop_points: 18, endgame_points: 11.2 },
          stats: { mean: 37, start: 35, pre_elim: 39, max: 43 },
        },
        record: { qual: { count: 12, rank: 10, rps_per_match: 2.1 } },
      },
      {
        team: 333,
        epa: {
          total_points: 36.8,
          breakdown: { auto_points: 8, teleop_points: 17, endgame_points: 11.8 },
          stats: { mean: 36, start: 34, pre_elim: 37, max: 40 },
        },
        record: { qual: { count: 12, rank: 12, rps_per_match: 2.0 } },
      },
      {
        team: 444,
        epa: {
          total_points: 31.5,
          breakdown: { auto_points: 7, teleop_points: 15, endgame_points: 9.5 },
          stats: { mean: 31, start: 30, pre_elim: 32, max: 34 },
        },
        record: { qual: { count: 12, rank: 18, rps_per_match: 1.8 } },
      },
      {
        team: 555,
        epa: {
          total_points: 28.1,
          breakdown: { auto_points: 6, teleop_points: 13, endgame_points: 9.1 },
          stats: { mean: 28, start: 27, pre_elim: 29, max: 31 },
        },
        record: { qual: { count: 12, rank: 22, rps_per_match: 1.6 } },
      },
      {
        team: 666,
        epa: {
          total_points: 26.9,
          breakdown: { auto_points: 5, teleop_points: 13, endgame_points: 8.9 },
          stats: { mean: 27, start: 26, pre_elim: 27.5, max: 29 },
        },
        record: { qual: { count: 12, rank: 24, rps_per_match: 1.5 } },
      },
    ],
  });

  const result = await context.ExternalEventLoader.loadEventByCode("2026test", {
    fetchImpl,
    tbaAuthKey: "unit-test-key",
    tbaBaseUrl: baseUrls.tba,
    statboticsBaseUrl: baseUrls.statbotics,
    timestamp: "2026-07-12T13:00:00Z",
  });

  assert.equal(result.eventModel.key, "2026test");
  assert.equal(result.eventModel.catalogSource, "dynamic-external");
  assert.equal(result.eventModel.matches.length, 1);
  assert.equal(result.eventModel.teams.length, 6);
  assert.equal(result.sourceStates.tba.status, "ready");
  assert.equal(result.sourceStates.tba.lastSuccessfulAt, "2026-07-12T13:00:00Z");
  assert.equal(result.sourceStates.statbotics.status, "ready");
  assert.equal(result.sourceStates.pridge.status, "ready");
  assert.equal(result.sourceStates.pridge.provenance.mode, "native-compute");
  assert.equal(result.sourceStates.pridge.provenance.eventKey, "2026test");
  assert.equal(result.sourceStates.pridge.provenance.generatedAt, "2026-07-12T13:00:00Z");
  assert.ok(String(result.sourceStates.pridge.provenance.inputFingerprints?.tba || "").startsWith("fnv1a:"));
  assert.ok(String(result.sourceStates.pridge.provenance.inputFingerprints?.statbotics || "").startsWith("fnv1a:"));
  assert.equal(Number.isFinite(result.eventModel.teams[0].sources.pridge.total), true);
  assert.equal(result.warnings.length, 0);
});

await runTest("loadEventByCode keeps the event loadable when Statbotics fails", async () => {
  const baseUrls = {
    tba: "https://tba.test/api",
    statbotics: "https://statbotics.test/api",
  };
  const context = loadBrowserContext([
    "src/season-framework.js",
    "src/prior-ridge.js",
    "src/event-model-builder.js",
    "src/external-source-snapshots.js",
    "src/external-event-loader.js",
  ]);
  const fetchImpl = createFetchStub({
    [`${baseUrls.tba}/event/2026fallback`]: { key: "2026fallback", year: 2026, name: "Fallback Event" },
    [`${baseUrls.tba}/event/2026fallback/teams`]: [
      { team_number: 1, nickname: "One" },
      { team_number: 2, nickname: "Two" },
      { team_number: 3, nickname: "Three" },
      { team_number: 4, nickname: "Four" },
      { team_number: 5, nickname: "Five" },
      { team_number: 6, nickname: "Six" },
    ],
    [`${baseUrls.tba}/event/2026fallback/matches`]: [
      {
        comp_level: "qm",
        match_number: 3,
        set_number: 1,
        winning_alliance: "blue",
        alliances: {
          red: { team_keys: ["frc1", "frc2", "frc3"], score: 80 },
          blue: { team_keys: ["frc4", "frc5", "frc6"], score: 81 },
        },
      },
    ],
    [`${baseUrls.statbotics}/event/2026fallback`]: { error: new Error("Statbotics down") },
    [`${baseUrls.statbotics}/team_events/event/2026fallback`]: { error: new Error("Statbotics down") },
  });

  const result = await context.ExternalEventLoader.loadEventByCode("2026fallback", {
    fetchImpl,
    tbaAuthKey: "unit-test-key",
    tbaBaseUrl: baseUrls.tba,
    statboticsBaseUrl: baseUrls.statbotics,
    timestamp: "2026-07-12T13:05:00Z",
  });

  assert.equal(result.eventModel.key, "2026fallback");
  assert.equal(result.eventModel.matches.length, 1);
  assert.equal(result.sourceStates.tba.status, "ready");
  assert.equal(result.sourceStates.statbotics.status, "error");
  assert.equal(result.sourceStates.pridge.status, "manual");
  assert.equal(result.sourceStates.pridge.provenance.mode, "native-compute");
  assert.equal(result.sourceStates.pridge.provenance.eventKey, "2026fallback");
  assert.equal(result.sourceStates.pridge.provenance.generatedAt, "2026-07-12T13:05:00Z");
  assert.ok(String(result.sourceStates.pridge.provenance.inputFingerprints?.tba || "").startsWith("fnv1a:"));
  assert.equal(result.sourceStates.pridge.provenance.inputFingerprints?.statbotics, undefined);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Statbotics/i);
});

await runTest("loadEventByCode requires a TBA auth key for live lookups", async () => {
  const context = loadBrowserContext([
    "src/season-framework.js",
    "src/prior-ridge.js",
    "src/event-model-builder.js",
    "src/external-source-snapshots.js",
    "src/external-event-loader.js",
  ]);

  await assert.rejects(
    () =>
      context.ExternalEventLoader.loadEventByCode("2026missing", {
        fetchImpl: createFetchStub({}),
      }),
    /Missing TBA auth key/i,
  );
});
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
