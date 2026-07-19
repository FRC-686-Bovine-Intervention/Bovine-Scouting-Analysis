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
    "src/legacy-scouting-schema-seeds.js",
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
    [`${baseUrls.tba}/event/2026test/rankings`]: {
      rankings: [
        { team_key: "frc111", rank: 1, sort_orders: [3.2], record: { wins: 8, losses: 1, ties: 0 }, dq: 0, matches_played: 9, extra_stats: [], qual_average: null },
        { team_key: "frc222", rank: 2, sort_orders: [2.9], record: { wins: 7, losses: 2, ties: 0 }, dq: 0, matches_played: 9, extra_stats: [], qual_average: null },
      ],
      sort_order_info: [],
      extra_stats_info: [],
    },
    [`${baseUrls.tba}/event/2026test/oprs`]: {
      oprs: { frc111: 51.2, frc222: 47.7, frc333: 46.1, frc444: 40.4, frc555: 38.9, frc666: 35.5 },
      dprs: { frc111: 9.8, frc222: 11.1, frc333: 12.4, frc444: 14.7, frc555: 15.5, frc666: 16.2 },
      ccwms: { frc111: 41.4, frc222: 36.6, frc333: 33.7, frc444: 25.7, frc555: 23.4, frc666: 19.3 },
    },
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
  assert.deepEqual(JSON.parse(JSON.stringify(result.eventModel.scouterMetricDefinitions || [])), []);
  assert.deepEqual(JSON.parse(JSON.stringify(result.eventModel.formulaFieldDefinitions || [])), []);
  assert.equal(result.eventModel.matches.length, 1);
  assert.equal(result.eventModel.teams.length, 6);
  assert.equal(result.eventModel.teams[0].eventRank, 1);
  assert.equal(result.eventModel.teams[0].record.qual.wins, 8);
  assert.equal(result.eventModel.teams[0].sources.opr.total, 51.2);
  assert.equal(result.eventModel.teams[0].sources.tba.components["opr.total"], 51.2);
  assert.equal(result.eventModel.teams[0].sources.tba.components["dpr.total"], 9.8);
  assert.equal(result.eventModel.teams[0].sources.tba.components["ccwm.total"], 41.4);
  assert.equal(result.eventModel.teams[0].sources.tba.components.rank, 1);
  assert.equal(result.eventModel.teams[0].sources.tba.components["record.wins"], 8);
  assert.equal(result.eventModel.teams[0].sources.tba.components["sort_orders.0"], 3.2);
  assert.equal(result.eventModel.teams[0].sources.epa.components["epa.total_points"], 42.5);
  assert.equal(result.eventModel.teams[0].sources.epa.components["epa.breakdown.auto_points"], 10);
  assert.equal(result.eventModel.teams[0].sources.epa.components["epa.stats.pre_elim"], 43);
  assert.equal(result.eventModel.teams[0].sources.epa.components["record.qual.rank"], 4);
  assert.equal(Array.isArray(result.eventModel.teams[0].sources.epa.trend), true);
  assert.equal(result.eventModel.teams[0].sources.epa.trend.length, 0);
  assert.equal(Array.isArray(result.eventModel.teams[0].sources.opr.trend), true);
  assert.equal(result.eventModel.teams[0].sources.opr.trend.length, 0);
  assert.equal(result.eventModel.seedPicklists[1].name, "Backup / Live Sources");
  assert.equal(Array.isArray(result.eventModel.scoringMatrixPresets), true);
  assert.equal(result.eventModel.scoringMatrixPresets.length, 0);
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

await runTest("loadEventByCode falls back to a generic season shell for unknown years while preserving provider metrics", async () => {
  const baseUrls = {
    tba: "https://tba.test/api",
    statbotics: "https://statbotics.test/api",
  };
  const context = loadBrowserContext([
    "src/legacy-scouting-schema-seeds.js",
    "src/season-framework.js",
    "src/prior-ridge.js",
    "src/event-model-builder.js",
    "src/external-source-snapshots.js",
    "src/external-event-loader.js",
  ]);
  const fetchImpl = createFetchStub({
    [`${baseUrls.tba}/event/2023generic`]: { key: "2023generic", year: 2023, name: "Generic 2023 Event" },
    [`${baseUrls.tba}/event/2023generic/teams`]: [
      { team_number: 1, nickname: "One" },
      { team_number: 2, nickname: "Two" },
      { team_number: 3, nickname: "Three" },
      { team_number: 4, nickname: "Four" },
      { team_number: 5, nickname: "Five" },
      { team_number: 6, nickname: "Six" },
    ],
    [`${baseUrls.tba}/event/2023generic/matches`]: [
      {
        comp_level: "qm",
        match_number: 1,
        set_number: 1,
        winning_alliance: "red",
        alliances: {
          red: { team_keys: ["frc1", "frc2", "frc3"], score: 101 },
          blue: { team_keys: ["frc4", "frc5", "frc6"], score: 99 },
        },
        score_breakdown: {
          red: { mobilityPoints: 9, autoGamePieceCount: 3 },
          blue: { mobilityPoints: 6, autoGamePieceCount: 2 },
        },
      },
    ],
    [`${baseUrls.tba}/event/2023generic/rankings`]: { rankings: [], sort_order_info: [], extra_stats_info: [] },
    [`${baseUrls.tba}/event/2023generic/oprs`]: { oprs: {}, dprs: {}, ccwms: {} },
    [`${baseUrls.statbotics}/event/2023generic`]: { year: 2023, status: "Completed" },
    [`${baseUrls.statbotics}/team_events/event/2023generic`]: [
      { team: 1, epa: { total_points: 55.5, breakdown: { auto_points: 12 }, stats: { mean: 54 } }, record: { qual: { rank: 3 } } },
      { team: 2, epa: { total_points: 44.2, breakdown: { auto_points: 10 }, stats: { mean: 43 } }, record: { qual: { rank: 8 } } },
      { team: 3, epa: { total_points: 41.3, breakdown: { auto_points: 9 }, stats: { mean: 40 } }, record: { qual: { rank: 10 } } },
      { team: 4, epa: { total_points: 38.7, breakdown: { auto_points: 8 }, stats: { mean: 39 } }, record: { qual: { rank: 14 } } },
      { team: 5, epa: { total_points: 35.1, breakdown: { auto_points: 7 }, stats: { mean: 35 } }, record: { qual: { rank: 19 } } },
      { team: 6, epa: { total_points: 31.9, breakdown: { auto_points: 6 }, stats: { mean: 32 } }, record: { qual: { rank: 25 } } },
    ],
  });

  const result = await context.ExternalEventLoader.loadEventByCode("2023generic", {
    fetchImpl,
    tbaAuthKey: "unit-test-key",
    tbaBaseUrl: baseUrls.tba,
    statboticsBaseUrl: baseUrls.statbotics,
    timestamp: "2026-07-17T12:00:00Z",
  });

  assert.equal(result.eventModel.season, 2023);
  assert.equal(result.eventModel.seasonLabel, "2023 Season");
  assert.deepEqual(JSON.parse(JSON.stringify(result.eventModel.scoringComponents || [])), []);
  assert.equal(result.eventModel.teams[0].sources.tba.components["record.wins"], undefined);
  assert.equal(result.eventModel.teams[0].sources.epa.components["epa.total_points"], 55.5);
  assert.equal(result.eventModel.teams[0].sources.epa.components["epa.breakdown.auto_points"], 12);
  assert.equal(result.eventModel.teams[0].sources.epa.components["record.qual.rank"], 3);
  assert.equal(result.eventModel.matches[0].scoreBreakdown.red.mobilityPoints, 9);
});

await runTest("loadEventByCode keeps the event loadable when Statbotics fails", async () => {
  const baseUrls = {
    tba: "https://tba.test/api",
    statbotics: "https://statbotics.test/api",
  };
  const context = loadBrowserContext([
    "src/legacy-scouting-schema-seeds.js",
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
    [`${baseUrls.tba}/event/2026fallback/rankings`]: {
      rankings: [
        { team_key: "frc1", rank: 1, sort_orders: [2.5], record: { wins: 3, losses: 0, ties: 0 }, dq: 0, matches_played: 3, extra_stats: [], qual_average: null },
      ],
      sort_order_info: [],
      extra_stats_info: [],
    },
    [`${baseUrls.tba}/event/2026fallback/oprs`]: {
      oprs: { frc1: 20.5, frc2: 19.1, frc3: 18.4, frc4: 17.9, frc5: 17.4, frc6: 16.8 },
      dprs: { frc1: 8.1, frc2: 8.4, frc3: 8.8, frc4: 9.2, frc5: 9.5, frc6: 9.9 },
      ccwms: { frc1: 12.4, frc2: 10.7, frc3: 9.6, frc4: 8.7, frc5: 7.9, frc6: 6.9 },
    },
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
  assert.equal(result.sourceStates.pridge.status, "error");
  assert.equal(result.sourceStates.pridge.freshness, "stale");
  assert.equal(result.sourceStates.pridge.provenance.mode, "native-compute");
  assert.equal(result.sourceStates.pridge.provenance.eventKey, "2026fallback");
  assert.equal(result.sourceStates.pridge.provenance.generatedAt, "2026-07-12T13:05:00Z");
  assert.ok(String(result.sourceStates.pridge.provenance.inputFingerprints?.tba || "").startsWith("fnv1a:"));
  assert.equal(result.sourceStates.pridge.provenance.inputFingerprints?.statbotics, undefined);
  assert.match(result.sourceStates.pridge.error, /Statbotics start EPA priors/i);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Statbotics/i);
});

await runTest("loadEventByCode marks pRidge as error when no usable qualification matches remain", async () => {
  const baseUrls = {
    tba: "https://tba.test/api",
    statbotics: "https://statbotics.test/api",
  };
  const context = loadBrowserContext([
    "src/legacy-scouting-schema-seeds.js",
    "src/season-framework.js",
    "src/prior-ridge.js",
    "src/event-model-builder.js",
    "src/external-source-snapshots.js",
    "src/external-event-loader.js",
  ]);
  const fetchImpl = createFetchStub({
    [`${baseUrls.tba}/event/2026nomatches`]: { key: "2026nomatches", year: 2026, name: "No Matches Event" },
    [`${baseUrls.tba}/event/2026nomatches/teams`]: [
      { team_number: 1, nickname: "One" },
      { team_number: 2, nickname: "Two" },
      { team_number: 3, nickname: "Three" },
      { team_number: 4, nickname: "Four" },
      { team_number: 5, nickname: "Five" },
      { team_number: 6, nickname: "Six" },
    ],
    [`${baseUrls.tba}/event/2026nomatches/matches`]: [
      {
        comp_level: "qm",
        match_number: 3,
        set_number: 1,
        winning_alliance: "",
        alliances: {
          red: { team_keys: ["frc1", "frc2"], score: -1 },
          blue: { team_keys: ["frc4", "frc5", "frc6"], score: 81 },
        },
      },
    ],
    [`${baseUrls.tba}/event/2026nomatches/rankings`]: {
      rankings: [],
      sort_order_info: [],
      extra_stats_info: [],
    },
    [`${baseUrls.tba}/event/2026nomatches/oprs`]: {
      oprs: { frc1: 11, frc2: 12, frc3: 13, frc4: 14, frc5: 15, frc6: 16 },
      dprs: {},
      ccwms: {},
    },
    [`${baseUrls.statbotics}/event/2026nomatches`]: { year: 2026, status: "In Progress" },
    [`${baseUrls.statbotics}/team_events/event/2026nomatches`]: [
      { team: 1, epa: { stats: { start: 10 } } },
      { team: 2, epa: { stats: { start: 11 } } },
      { team: 3, epa: { stats: { start: 12 } } },
      { team: 4, epa: { stats: { start: 13 } } },
      { team: 5, epa: { stats: { start: 14 } } },
      { team: 6, epa: { stats: { start: 15 } } },
    ],
  });

  const result = await context.ExternalEventLoader.loadEventByCode("2026nomatches", {
    fetchImpl,
    tbaAuthKey: "unit-test-key",
    tbaBaseUrl: baseUrls.tba,
    statboticsBaseUrl: baseUrls.statbotics,
    timestamp: "2026-07-12T13:06:00Z",
  });

  assert.equal(result.sourceStates.tba.status, "ready");
  assert.equal(result.sourceStates.statbotics.status, "ready");
  assert.equal(result.sourceStates.pridge.status, "error");
  assert.equal(result.sourceStates.pridge.freshness, "stale");
  assert.match(result.sourceStates.pridge.error, /no usable qualification match rows/i);
  assert.ok(String(result.sourceStates.pridge.provenance.inputFingerprints?.tba || "").startsWith("fnv1a:"));
  assert.ok(String(result.sourceStates.pridge.provenance.inputFingerprints?.statbotics || "").startsWith("fnv1a:"));
});

await runTest("loadEventByCode requires a TBA auth key for live lookups", async () => {
  const context = loadBrowserContext([
    "src/legacy-scouting-schema-seeds.js",
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
