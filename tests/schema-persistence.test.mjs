import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
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

function loadAppContext(options = {}) {
  const noop = () => {};
  const workspaceRoot = path.resolve(".");
  const schemaFields = Array.isArray(options.schemaFields) ? options.schemaFields : [];
  const eventCatalog = Array.isArray(options.eventCatalog) && options.eventCatalog.length
    ? options.eventCatalog
    : [{
      key: "2026chcmp",
      season: 2026,
      name: "CHCMP",
      seasonLabel: "2026",
      teams: [{ number: 1 }],
      teamNumbers: [1],
      matches: [{ number: 1 }],
      dataSources: [],
      seedPicklists: [],
      seedSortEquations: [],
      formulaFieldDefinitions: schemaFields,
      sheet: { recommendedProfileId: "match-current-v2" },
    }];
  const appElement = {
    innerHTML: "",
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: noop,
  };
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
    RegExp,
    URL,
    URLSearchParams,
    eventCatalog,
    localStorage: {
      getItem: () => null,
      setItem: noop,
      removeItem: noop,
    },
    document: {
      querySelector: (selector) => (selector === "#app" ? appElement : null),
      querySelectorAll: () => [],
      createElement: () => ({ addEventListener: noop, style: {}, click: noop }),
      body: { appendChild: noop, removeChild: noop },
      addEventListener: noop,
      documentElement: { dataset: {} },
    },
    navigator: { userAgent: "node" },
    location: { protocol: "file:" },
    requestAnimationFrame: noop,
    cancelAnimationFrame: noop,
    setTimeout,
    clearTimeout,
    confirm: () => true,
    alert: noop,
    fetch: async () => ({ ok: false, json: async () => ({}), text: async () => "" }),
    LocalFileAccess: {
      writeAttachmentText: options.writeAttachmentText || (async () => true),
      readAttachmentText: options.readAttachmentText || (async () => ""),
      removeAttachment: options.removeAttachment || (async () => true),
      pathBasename:
        options.pathBasename
        || ((value) => String(value || "").trim().replace(/\\/g, "/").split("/").pop() || ""),
    },
  };
  context.window = context;
  context.globalThis = context;

  const appSource = fs.readFileSync(path.join(workspaceRoot, "src/app.js"), "utf8")
    .replace(/installGlobalRecoveryGuards\(\);/, "")
    .replace(/bootstrapApp\(\);\s*$/, "");

  [
    "src/metric-engine.js",
    "src/scouting-json-schema.js",
    "src/event-workspace.js",
  ].forEach((relativePath) => {
    const source = fs.readFileSync(path.join(workspaceRoot, relativePath), "utf8");
    vm.runInNewContext(source, context, { filename: path.join(workspaceRoot, relativePath) });
  });
  vm.runInNewContext(appSource, context, { filename: path.join(workspaceRoot, "src/app.js") });
  context.render = noop;
  return context;
}

await runTest("renaming a derived equation updates the bound local schema json artifact for CSV-backed scouting attachments", async () => {
  const fixturePath = path.resolve("tests/fixtures/canonical-scouting-datasets/2026chcmp.schema.json");
  const fixtureText = fs.readFileSync(fixturePath, "utf8");
  const fixturePayload = JSON.parse(fixtureText);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "schema-persistence-"));
  const schemaPath = path.join(tempDir, "2026chcmp.schema.json");
  fs.writeFileSync(schemaPath, fixtureText, "utf8");

  const context = loadAppContext({
    schemaFields: fixturePayload.schema?.fields || [],
    readAttachmentText: async () => fs.readFileSync(schemaPath, "utf8"),
    writeAttachmentText: async (_attachmentId, text) => {
      fs.writeFileSync(schemaPath, String(text || ""), "utf8");
      return true;
    },
  });

  const state = context.__scoutingAppState;
  const eventModel = context.eventCatalog[0];
  state.activeEventKey = eventModel.key;
  state.eventWorkspace = context.EventWorkspace.createEventWorkspace(eventModel, {
    activeScoutingAttachmentId: "csv-attachment",
    sources: {
      scouting: [{
        attachmentId: "csv-attachment",
        label: "CSV + schema",
        format: "legacy-sheet-csv",
        locationKind: "path",
        location: {
          path: path.join(tempDir, "2026chcmp.csv"),
          schemaPath,
        },
        profileId: "canonical-json-v1",
        translatorId: "canonical-json-v1",
        autoLoad: true,
      }],
    },
  });
  state.importResult = { summary: { profileId: "canonical-json-v1" } };
  state.importSchemaJsonText = fixtureText;
  context.registerScoutingProfile(eventModel, {
    id: "canonical-json-v1",
    label: "Canonical JSON",
    fields: fixturePayload.schema?.fields || [],
    equations: fixturePayload.profile?.equations || [],
  });

  const target = context.currentProfileEquationList(eventModel).find((equation) => equation?.name === "Auto Fuel Share");
  assert.ok(target, "Expected Auto Fuel Share to exist in the loaded profile.");

  context.renameProfileEquation(target.id, "autoFuelShareTest");
  await new Promise((resolve) => setTimeout(resolve, 0));

  const updatedSchema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const equationNames = (updatedSchema.profile?.equations || []).map((equation) => equation?.name).filter(Boolean);

  assert.equal(context.detectedScoutingSourceLabel(), "Local CSV file");
  assert.equal(equationNames.includes("autoFuelShareTest"), true);
  assert.equal(equationNames.includes("Auto Fuel Share"), false);
});

await runTest("typing a fuller schema path for the same local file keeps the existing writable attachment binding", async () => {
  const fixturePath = path.resolve("tests/fixtures/canonical-scouting-datasets/2026chcmp.schema.json");
  const fixtureText = fs.readFileSync(fixturePath, "utf8");
  const fixturePayload = JSON.parse(fixtureText);
  const removedAttachmentIds = [];
  const context = loadAppContext({
    schemaFields: fixturePayload.schema?.fields || [],
    removeAttachment: async (attachmentId) => {
      removedAttachmentIds.push(attachmentId);
      return true;
    },
  });

  const state = context.__scoutingAppState;
  const eventModel = context.eventCatalog[0];
  state.activeEventKey = eventModel.key;
  state.eventWorkspace = context.EventWorkspace.createEventWorkspace(eventModel, {
    activeScoutingAttachmentId: "csv-attachment",
    sources: {
      scouting: [{
        attachmentId: "csv-attachment",
        label: "CSV + schema",
        format: "legacy-sheet-csv",
        locationKind: "path",
        location: {
          path: "2026chcmp.csv",
          schemaPath: "2026chcmp.schema.json",
        },
        profileId: "canonical-json-v1",
        translatorId: "canonical-json-v1",
        autoLoad: true,
      }],
    },
  });

  await context.applyScoutingSchemaSourceInputChange({
    source: "D:\\FIRST\\Scouting\\Scouting-Analysis\\2026chcmp.schema.json",
    forceReload: true,
  });

  assert.deepEqual(removedAttachmentIds, []);
  assert.equal(
    context.currentScoutingAttachment().location.schemaPath,
    "D:\\FIRST\\Scouting\\Scouting-Analysis\\2026chcmp.schema.json",
  );
});

await runTest("provider-backed derived equations resolve TBA and Statbotics identifiers from live team sources", async () => {
  const eventCatalog = [{
    key: "2023chcmp",
    season: 2023,
    name: "CHCMP",
    seasonLabel: "2023",
    teams: [{
      number: 111,
      sources: {
        tba: {
          components: {
            ranking: {
              rank: 5,
            },
          },
        },
        statbotics: {
          components: {
            epa: {
              total_points: 42.7,
            },
          },
        },
      },
    }],
    teamNumbers: [111],
    matches: [{
      number: 1,
      red: [111],
      blue: [222, 333, 444],
      scoreBreakdown: {
        red: {},
        blue: {},
      },
    }],
    dataSources: [],
    seedPicklists: [],
    seedSortEquations: [],
    formulaFieldDefinitions: [],
    sheet: { recommendedProfileId: "match-current-v2" },
  }];

  const context = loadAppContext({ eventCatalog });
  const state = context.__scoutingAppState;
  const eventModel = context.eventCatalog[0];
  state.activeEventKey = eventModel.key;

  context.registerScoutingProfile(eventModel, {
    id: "match-current-v2",
    label: "Current",
    fields: [],
    equations: [
      { id: "tba_rank", name: "TBA Rank", formula: "tba.ranking.rank", sourceOrder: 1 },
      { id: "statbotics_total_points", name: "Statbotics Total Points", formula: "statbotics.epa.total_points", sourceOrder: 2 },
    ],
  });

  const tbaEvaluation = context.evaluateEquationForTeam(111, "tba_rank", { eventModel });
  const statboticsEvaluation = context.evaluateEquationForTeam(111, "statbotics_total_points", { eventModel });

  assert.equal(tbaEvaluation.result.kind, "scalar");
  assert.equal(tbaEvaluation.result.granularity, "event");
  assert.equal(tbaEvaluation.result.value, 5);

  assert.equal(statboticsEvaluation.result.kind, "scalar");
  assert.equal(statboticsEvaluation.result.granularity, "event");
  assert.equal(statboticsEvaluation.result.value, 42.7);
});

await runTest("available metrics preview resolves metrics that are not already referenced by the active equation", async () => {
  const eventCatalog = [{
    key: "2023chcmp",
    season: 2023,
    name: "CHCMP",
    seasonLabel: "2023",
    teams: [{
      number: 111,
      sources: {
        tba: {
          components: {
            ranking: {
              rank: 5,
            },
          },
        },
        statbotics: {
          components: {
            epa: {
              total_points: 42.7,
            },
          },
        },
      },
    }],
    teamNumbers: [111],
    matches: [{
      number: 1,
      red: [111],
      blue: [222, 333, 444],
      scoreBreakdown: {
        red: {},
        blue: {},
      },
    }],
    dataSources: [],
    seedPicklists: [],
    seedSortEquations: [],
    formulaFieldDefinitions: [{
      id: "autoFuelPct",
      label: "Auto Fuel %",
      type: "number",
      unit: "%",
    }],
    sheet: { recommendedProfileId: "match-current-v2" },
  }];

  const context = loadAppContext({ eventCatalog, schemaFields: eventCatalog[0].formulaFieldDefinitions });
  const state = context.__scoutingAppState;
  const eventModel = context.eventCatalog[0];
  state.activeEventKey = eventModel.key;
  state.activeView = "derivedBuilder";
  state.activeDerivedPreviewMetricId = "statbotics.epa.total_points";

  context.registerScoutingProfile(eventModel, {
    id: "match-current-v2",
    label: "Current",
    fields: eventCatalog[0].formulaFieldDefinitions,
    equations: [
      { id: "tba_rank", name: "TBA Rank", formula: "tba.ranking.rank", sourceOrder: 1 },
    ],
  });
  state.activeDerivedEquationId = "tba_rank";

  const html = context.renderDerivedBuilder();
  assert.match(html, /42\.7/);
  assert.doesNotMatch(html, />Invalid</);
});
