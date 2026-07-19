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

runTest("real event model preserves qualification alliance scores and score breakdowns when available", () => {
  const snapshots = {
    events: [
      {
        key: "unit2026",
        year: 2026,
        importProfileId: "match-current-v2",
        sheet: null,
        tbaEventText: JSON.stringify({ name: "Unit Event" }),
        tbaTeamsText: JSON.stringify([
          { team_number: 111, nickname: "Alpha" },
          { team_number: 222, nickname: "Beta" },
          { team_number: 333, nickname: "Gamma" },
          { team_number: 444, nickname: "Delta" },
          { team_number: 555, nickname: "Epsilon" },
          { team_number: 666, nickname: "Zeta" },
        ]),
        tbaMatchesText: JSON.stringify([
          {
            comp_level: "qm",
            match_number: 1,
            set_number: 1,
            winning_alliance: "red",
            alliances: {
              red: { team_keys: ["frc111", "frc222", "frc333"], score: 180 },
              blue: { team_keys: ["frc444", "frc555", "frc666"], score: 140 },
            },
            score_breakdown: {
              red: { auto_points: 30, teleop_points: 110, endgame_points: 40, transition_fuel: 10 },
              blue: { auto_points: 20, teleop_points: 95, endgame_points: 25, transition_fuel: 8 },
            },
          },
          {
            comp_level: "sf",
            match_number: 1,
            set_number: 1,
            winning_alliance: "blue",
            alliances: {
              red: { team_keys: ["frc111", "frc222", "frc333"], score: 0 },
              blue: { team_keys: ["frc444", "frc555", "frc666"], score: 0 },
            },
          },
        ]),
        statboticsEventText: JSON.stringify({ status: "Completed" }),
        statboticsTeamEventsText: JSON.stringify([]),
      },
    ],
  };

  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/event-model-builder.js", "src/real-event-data.js"], {
    realEventSnapshots: snapshots,
  });
  const [catalogEntry] = context.eventCatalog;
  const eventModel = context.RealEventData?.hydrateEventModel
    ? context.RealEventData.hydrateEventModel(catalogEntry)
    : catalogEntry;
  assert.ok(eventModel, "Event model should be created");
  assert.equal(eventModel.matchesComplete, 1);
  assert.equal(eventModel.matches.length, 1);
  assert.equal(Array.isArray(eventModel.scoringMatrixPresets), true);
  assert.equal(eventModel.scoringMatrixPresets.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(eventModel.matches[0])), {
    number: 1,
    red: [111, 222, 333],
    blue: [444, 555, 666],
    redScore: 180,
    blueScore: 140,
    winningAlliance: "red",
    scoreBreakdown: {
      red: { auto_points: 30, teleop_points: 110, endgame_points: 40, transition_fuel: 10 },
      blue: { auto_points: 20, teleop_points: 95, endgame_points: 25, transition_fuel: 8 },
    },
  });
});

runTest("real event model leaves score breakdown null when snapshots only provide alliance scores", () => {
  const snapshots = {
    events: [
      {
        key: "unit2024",
        year: 2024,
        importProfileId: "",
        sheet: null,
        tbaEventText: JSON.stringify({ name: "Unit Event 2024" }),
        tbaTeamsText: JSON.stringify([
          { team_number: 1, nickname: "One" },
          { team_number: 2, nickname: "Two" },
          { team_number: 3, nickname: "Three" },
          { team_number: 4, nickname: "Four" },
          { team_number: 5, nickname: "Five" },
          { team_number: 6, nickname: "Six" },
        ]),
        tbaMatchesText: JSON.stringify([
          {
            comp_level: "qm",
            match_number: 2,
            set_number: 1,
            winning_alliance: "blue",
            alliances: {
              red: { team_keys: ["frc1", "frc2", "frc3"], score: 75 },
              blue: { team_keys: ["frc4", "frc5", "frc6"], score: 81 },
            },
          },
        ]),
        statboticsEventText: JSON.stringify({ status: "Completed" }),
        statboticsTeamEventsText: JSON.stringify([]),
      },
    ],
  };

  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/event-model-builder.js", "src/real-event-data.js"], {
    realEventSnapshots: snapshots,
  });
  const [catalogEntry] = context.eventCatalog;
  const eventModel = context.RealEventData?.hydrateEventModel
    ? context.RealEventData.hydrateEventModel(catalogEntry)
    : catalogEntry;
  assert.equal(eventModel.matches[0].redScore, 75);
  assert.equal(eventModel.matches[0].blueScore, 81);
  assert.equal(eventModel.matches[0].winningAlliance, "blue");
  assert.equal(eventModel.matches[0].scoreBreakdown, null);
});

runTest("real event data does not invent fallback events when no real snapshots are present", () => {
  const context = loadBrowserContext(["src/legacy-scouting-schema-seeds.js", "src/season-framework.js", "src/event-model-builder.js", "src/real-event-data.js"], {
    realEventSnapshots: { events: [] },
  });

  assert.deepEqual(JSON.parse(JSON.stringify(context.eventCatalog || [])), []);
});

runTest("real event data merges framework season metadata when provider season metadata is empty", () => {
  const context = loadBrowserContext([
    "src/provider-season-metadata.js",
    "src/scouting-schema-runtime.js",
    "src/legacy-scouting-schema-seeds.js",
    "src/season-framework.js",
    "src/event-model-builder.js",
    "src/real-event-data.js",
  ], {
    realEventSnapshots: {
      events: [
        {
          key: "2024mdsev",
          year: 2024,
          importProfileId: "",
          sheet: null,
          tbaEventText: JSON.stringify({ name: "2024 CHS District Severn MD Event" }),
          tbaTeamsText: JSON.stringify([{ team_number: 1719, nickname: "Alpha" }]),
          tbaMatchesText: JSON.stringify([]),
          statboticsEventText: JSON.stringify({ status: "Completed" }),
          statboticsTeamEventsText: JSON.stringify([]),
        },
      ],
    },
  });

  const [eventModel] = context.eventCatalog;
  assert.equal(eventModel.season, 2024);
  assert.equal(eventModel.seasonLabel, "Crescendo");
  assert.deepEqual(JSON.parse(JSON.stringify(eventModel.scoringComponents.map((component) => component.id))), ["auto", "speaker", "amp", "trap"]);
  assert.equal(context.SeasonFramework.formulaFieldDefinitions(eventModel).length > 0, true);
});
