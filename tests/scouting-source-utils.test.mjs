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
    Boolean,
    Object,
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

runTest("googleSheetInfo derives csv export urls", () => {
  const context = loadBrowserContext(["src/scouting-source-utils.js"]);
  const info = context.ScoutingSourceUtils.googleSheetInfo("https://docs.google.com/spreadsheets/d/abc123/edit?gid=42#gid=42");

  assert.equal(info.id, "abc123");
  assert.equal(info.gid, "42");
  assert.equal(info.csvUrl, "https://docs.google.com/spreadsheets/d/abc123/export?format=csv&gid=42");
});

runTest("sourceUrlMatchesEventSheet matches equivalent google sheet urls", () => {
  const context = loadBrowserContext(["src/scouting-source-utils.js"]);
  const eventModel = {
    sheet: {
      url: "https://docs.google.com/spreadsheets/d/abc123/edit?gid=10#gid=10",
    },
  };

  assert.equal(
    context.ScoutingSourceUtils.sourceUrlMatchesEventSheet(
      "https://docs.google.com/spreadsheets/d/abc123/export?format=csv&gid=99",
      eventModel,
    ),
    true,
  );
  assert.equal(
    context.ScoutingSourceUtils.sourceUrlMatchesEventSheet(
      "https://docs.google.com/spreadsheets/d/different/export?format=csv&gid=99",
      eventModel,
    ),
    false,
  );
});

runTest("shouldFallbackToEventSheetSample only falls back for the event sheet when sample data exists", () => {
  const context = loadBrowserContext(["src/scouting-source-utils.js"]);
  const eventModel = {
    sheet: {
      url: "https://docs.google.com/spreadsheets/d/abc123/edit?gid=10#gid=10",
      sampleCsvText: "Team,Match\n1,1\n",
    },
  };

  assert.equal(
    context.ScoutingSourceUtils.shouldFallbackToEventSheetSample(
      "https://docs.google.com/spreadsheets/d/abc123/export?format=csv&gid=99",
      eventModel,
    ),
    true,
  );
  assert.equal(
    context.ScoutingSourceUtils.shouldFallbackToEventSheetSample(
      "https://example.com/custom-scouting.csv",
      eventModel,
    ),
    false,
  );
  assert.equal(
    context.ScoutingSourceUtils.shouldFallbackToEventSheetSample(
      "https://docs.google.com/spreadsheets/d/abc123/export?format=csv&gid=99",
      { sheet: { url: eventModel.sheet.url, sampleCsvText: "" } },
    ),
    false,
  );
});

runTest("assessDuplicateSubmissions flags incoming duplicate groups by event, match, and team", () => {
  const context = loadBrowserContext(["src/scouting-source-utils.js"]);
  const existingSubmissions = [
    {
      id: "existing-1",
      eventKey: "2026chcmp",
      matchNumber: 10,
      teamNumber: 686,
      validity: "valid",
      confidenceTier: "high",
      confidenceReasons: [],
    },
  ];
  const incomingSubmissions = [
    {
      id: "incoming-1",
      eventKey: "2026chcmp",
      matchNumber: 10,
      teamNumber: 686,
      validity: "valid",
      confidenceTier: "high",
      confidenceReasons: [],
    },
    {
      id: "incoming-2",
      eventKey: "2026chcmp",
      matchNumber: 11,
      teamNumber: 686,
      validity: "valid",
      confidenceTier: "high",
      confidenceReasons: [],
    },
  ];

  const assessment = context.ScoutingSourceUtils.assessDuplicateSubmissions(existingSubmissions, incomingSubmissions);

  assert.deepEqual(JSON.parse(JSON.stringify(assessment.impactedTeams)), [686]);
  assert.equal(assessment.duplicateGroups.length, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(assessment.duplicateGroups[0])),
    {
      key: "2026chcmp:10:686",
      eventKey: "2026chcmp",
      matchNumber: 10,
      teamNumber: 686,
      submissionIds: ["existing-1", "incoming-1"],
      count: 2,
    },
  );
  assert.equal(incomingSubmissions[0].validity, "flagged");
  assert.equal(incomingSubmissions[0].confidenceTier, "low");
  assert.deepEqual(incomingSubmissions[0].confidenceReasons, ["duplicate_submission"]);
  assert.equal(incomingSubmissions[1].validity, "valid");
});
