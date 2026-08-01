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
  const extraQuerySelectors = options.extraQuerySelectors || {};
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
      querySelector: (selector) => {
        if (selector === "#app") return appElement;
        return extraQuerySelectors[selector] || null;
      },
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
      supportsPersistentLocalFiles: options.supportsPersistentLocalFiles || (() => true),
      pickAttachmentFile: options.pickAttachmentFile || (async () => ({ attachmentId: "", path: "", name: "" })),
      createAttachmentFile: options.createAttachmentFile || (async () => ({ attachmentId: "", path: "", name: "" })),
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
    "src/dynamic-scouting-fields.js",
    "src/metric-engine.js",
    "src/scouting-dependency-diagnostics.js",
    "src/scouting-diagnostics-state.js",
    "src/scouting-json-schema.js",
    "src/scouting-profiles.js",
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
  const fixturePath = path.resolve("tests/fixtures/canonical-scouting-datasets/2026chcmp_profile-v1.json");
  const fixtureText = fs.readFileSync(fixturePath, "utf8");
  const fixturePayload = JSON.parse(fixtureText);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "schema-persistence-"));
  const schemaPath = path.join(tempDir, "2026chcmp_profile-v1.json");
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
    fields: fixturePayload.schema?.expectedScoutingFields || fixturePayload.schema?.fields || [],
    derivedEquations: fixturePayload.profile?.derivedEquations || fixturePayload.profile?.equations || [],
    filters: fixturePayload.profile?.filters || [],
  });

  const target = context.currentProfileEquationList(eventModel).find((equation) => equation?.name === "autoFuelShare");
  assert.ok(target, "Expected autoFuelShare to exist in the loaded profile.");

  context.renameProfileEquation(target.id, "autoFuelShareTest");
  await new Promise((resolve) => setTimeout(resolve, 0));

  const updatedSchema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const equations = updatedSchema.profile?.derivedEquations || updatedSchema.profile?.equations || [];
  const equationNames = equations.map((equation) => equation?.name).filter(Boolean);

  assert.equal(context.detectedScoutingSourceLabel(), "Local CSV file");
  assert.equal(equationNames.includes("autoFuelShareTest"), true);
  assert.equal(equationNames.includes("Auto Fuel Share"), false);
  assert.equal(equations.every((equation) => !("id" in equation) && !("unit" in equation) && !("description" in equation) && !("usage" in equation)), true);
});

await runTest("editing scoutingTotal updates the bound 2025 schema json artifact for CSV-backed scouting attachments", async () => {
  const fixturePath = path.resolve("tests/fixtures/canonical-scouting-datasets/2025chcmp_profile-v1.json");
  const fixtureText = fs.readFileSync(fixturePath, "utf8");
  const fixturePayload = JSON.parse(fixtureText);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "schema-persistence-2025-"));
  const schemaPath = path.join(tempDir, "2025chcmp_profile-v1.json");
  fs.writeFileSync(schemaPath, fixtureText, "utf8");

  const context = loadAppContext({
    eventCatalog: [{
      key: "2025chcmp",
      season: 2025,
      name: "CHCMP",
      seasonLabel: "2025",
      teams: [{ number: 1 }],
      teamNumbers: [1],
      matches: [{ number: 1 }],
      dataSources: [],
      seedPicklists: [],
      seedSortEquations: [],
      formulaFieldDefinitions: [],
      sheet: { recommendedProfileId: "match-current-v2" },
    }],
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
          path: path.join(tempDir, "2025chcmp.csv"),
          schemaPath,
        },
        profileId: "match-current-v2",
        translatorId: "canonical-json-v1",
        autoLoad: true,
      }],
    },
  });
  state.importResult = { summary: { profileId: "match-current-v2" } };
  state.importSchemaJsonText = fixtureText;
  context.registerScoutingProfile(eventModel, {
    id: "match-current-v2",
    label: "Current Match Template",
    fields: fixturePayload.schema?.expectedScoutingFields || fixturePayload.schema?.fields || [],
    derivedEquations: fixturePayload.profile?.derivedEquations || fixturePayload.profile?.equations || [],
    filters: fixturePayload.profile?.filters || [],
  });

  const target = context.currentProfileEquationList(eventModel).find((equation) => equation?.name === "scoutingTotal");
  assert.ok(target, "Expected scoutingTotal to exist in the loaded profile.");

  context.updateProfileEquationFormula(target.id, "auto + coral + algae + climb + 1");
  await new Promise((resolve) => setTimeout(resolve, 0));

  const updatedSchema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const equations = updatedSchema.profile?.derivedEquations || [];
  const scoutingTotal = equations.find((equation) => equation?.name === "scoutingTotal");

  assert.ok(scoutingTotal, "Expected scoutingTotal to remain in the saved schema.");
  assert.equal(scoutingTotal.formula, "auto + coral + algae + climb + 1");
});

await runTest("typing a fuller schema path for the same local file keeps the existing writable attachment binding", async () => {
  const fixturePath = path.resolve("tests/fixtures/canonical-scouting-datasets/2026chcmp_profile-v1.json");
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
          schemaPath: "2026chcmp_profile-v1.json",
        },
        profileId: "canonical-json-v1",
        translatorId: "canonical-json-v1",
        autoLoad: true,
      }],
    },
  });

  await context.applyScoutingSchemaSourceInputChange({
    source: "D:\\FIRST\\Scouting\\Scouting-Analysis\\2026chcmp_profile-v1.json",
    forceReload: true,
  });

  assert.deepEqual(removedAttachmentIds, []);
  assert.equal(
    context.currentScoutingAttachment().location.schemaPath,
    "D:\\FIRST\\Scouting\\Scouting-Analysis\\2026chcmp_profile-v1.json",
  );
});

await runTest("selecting a local schema path switches a sheet-backed attachment to the companion local scouting json source", async () => {
  const context = loadAppContext({
    eventCatalog: [{
      key: "2025chcmp",
      season: 2025,
      name: "CHCMP",
      seasonLabel: "2025",
      teams: [{ number: 1 }],
      teamNumbers: [1],
      matches: [{ number: 1 }],
      dataSources: [],
      seedPicklists: [],
      seedSortEquations: [],
      formulaFieldDefinitions: [],
      sheet: {
        url: "https://docs.google.com/spreadsheets/d/example/edit#gid=0",
        recommendedProfileId: "match-current-v2",
      },
    }],
  });

  const state = context.__scoutingAppState;
  const eventModel = context.eventCatalog[0];
  state.activeEventKey = eventModel.key;
  state.eventWorkspace = context.EventWorkspace.createEventWorkspace(eventModel, {
    activeScoutingAttachmentId: "sheet-attachment",
    sources: {
      scouting: [{
        attachmentId: "sheet-attachment",
        label: "Google Sheet import",
        format: "legacy-sheet-url",
        locationKind: "url",
        location: {
          url: "https://docs.google.com/spreadsheets/d/example/edit#gid=0",
          schemaPath: "",
        },
        profileId: "match-current-v2",
        translatorId: "match-current-v2",
        autoLoad: true,
      }],
    },
  });
  state.importSourceUrl = "https://docs.google.com/spreadsheets/d/example/edit#gid=0";

  await context.applyScoutingSchemaSourceInputChange({
    source: "D:\\FIRST\\Scouting\\Scouting-Analysis\\2025chcmp_profile-v1.json",
    forceReload: true,
  });

  assert.equal(
    context.currentScoutingAttachment().location.path,
    "D:\\FIRST\\Scouting\\Scouting-Analysis\\2025chcmp.json",
  );
  assert.equal(
    context.currentScoutingAttachment().location.schemaPath,
    "D:\\FIRST\\Scouting\\Scouting-Analysis\\2025chcmp_profile-v1.json",
  );
  assert.equal(context.currentScoutingAttachment().locationKind, "path");
  assert.equal(context.currentScoutingAttachment().format, "scouting-json");
  assert.equal(context.currentScoutingSourceInputValue(), "D:\\FIRST\\Scouting\\Scouting-Analysis\\2025chcmp.json");
  assert.equal(context.detectedScoutingSourceLabel(), "Local JSON file");
});

await runTest("selecting a versioned local schema path upgrades an old local entries source to the companion json source", async () => {
  const context = loadAppContext({
    eventCatalog: [{
      key: "2025chcmp",
      season: 2025,
      name: "CHCMP",
      seasonLabel: "2025",
      teams: [{ number: 1 }],
      teamNumbers: [1],
      matches: [{ number: 1 }],
      dataSources: [],
      seedPicklists: [],
      seedSortEquations: [],
      formulaFieldDefinitions: [],
      sheet: { recommendedProfileId: "match-current-v2" },
    }],
  });

  const state = context.__scoutingAppState;
  const eventModel = context.eventCatalog[0];
  state.activeEventKey = eventModel.key;
  state.eventWorkspace = context.EventWorkspace.createEventWorkspace(eventModel, {
    activeScoutingAttachmentId: "json-attachment",
    sources: {
      scouting: [{
        attachmentId: "json-attachment",
        label: "Legacy local JSON import",
        format: "scouting-json",
        locationKind: "path",
        location: {
          path: "D:\\FIRST\\Scouting\\Scouting-Analysis\\2025chcmp.entries.json",
          schemaPath: "D:\\FIRST\\Scouting\\Scouting-Analysis\\2025chcmp_profile-v1.json",
        },
        profileId: "canonical-json-v1",
        translatorId: "canonical-json-v1",
        autoLoad: true,
      }],
    },
  });
  state.importSourceUrl = "D:\\FIRST\\Scouting\\Scouting-Analysis\\2025chcmp.entries.json";

  await context.applyScoutingSchemaSourceInputChange({
    source: "D:\\FIRST\\Scouting\\Scouting-Analysis\\2025chcmp_profile-v1.json",
    forceReload: true,
  });

  assert.equal(
    context.currentScoutingAttachment().location.path,
    "D:\\FIRST\\Scouting\\Scouting-Analysis\\2025chcmp.json",
  );
  assert.equal(
    context.currentScoutingAttachment().location.schemaPath,
    "D:\\FIRST\\Scouting\\Scouting-Analysis\\2025chcmp_profile-v1.json",
  );
  assert.equal(context.currentScoutingAttachment().locationKind, "path");
  assert.equal(context.currentScoutingAttachment().format, "scouting-json");
  assert.equal(context.currentScoutingSourceInputValue(), "D:\\FIRST\\Scouting\\Scouting-Analysis\\2025chcmp.json");
  assert.equal(context.detectedScoutingSourceLabel(), "Local JSON file");
});

await runTest("browsing for a local scouting profile immediately updates the bound schema path", async () => {
  const dataFixturePath = path.resolve("tests/fixtures/canonical-scouting-datasets/2026chcmp.json");
  const schemaFixturePath = path.resolve("tests/fixtures/canonical-scouting-datasets/2026chcmp_profile-v1.json");
  const dataFixtureText = fs.readFileSync(dataFixturePath, "utf8");
  const schemaFixtureText = fs.readFileSync(schemaFixturePath, "utf8");
  const reads = [];
  const pickedPath = "D:\\FIRST\\Scouting\\Scouting-Analysis\\2026chcmp_profile-v1.json";
  const context = loadAppContext({
    pickAttachmentFile: async () => ({
      attachmentId: "json-attachment:schema",
      path: pickedPath,
      name: "2026chcmp_profile-v1.json",
    }),
    readAttachmentText: async (attachmentId) => {
      reads.push(String(attachmentId || ""));
      if (attachmentId === "json-attachment") return dataFixtureText;
      if (attachmentId === "json-attachment:schema") return schemaFixtureText;
      return "";
    },
  });

  const state = context.__scoutingAppState;
  const eventModel = context.eventCatalog[0];
  state.activeEventKey = eventModel.key;
  state.eventWorkspace = context.EventWorkspace.createEventWorkspace(eventModel, {
    activeScoutingAttachmentId: "json-attachment",
    sources: {
      scouting: [{
        attachmentId: "json-attachment",
        label: "JSON + schema",
        format: "scouting-json",
        locationKind: "path",
        location: {
          path: "D:\\FIRST\\Scouting\\Scouting-Analysis\\2026chcmp.json",
          schemaPath: "D:\\FIRST\\Scouting\\Scouting-Analysis\\2026chcmp_profile-v1.json",
        },
        profileId: "canonical-json-v1",
        translatorId: "canonical-json-v1",
        autoLoad: true,
      }],
    },
  });
  state.importSourceUrl = "D:\\FIRST\\Scouting\\Scouting-Analysis\\2026chcmp.json";

  await context.chooseLocalScoutingSchemaFile();

  assert.equal(context.currentScoutingAttachment().location.schemaPath, pickedPath);
  assert.equal(context.currentScoutingSchemaSourceInputValue(), pickedPath);
  assert.equal(reads.includes("json-attachment"), true);
  assert.equal(reads.includes("json-attachment:schema"), true);
});

await runTest("schema reconciliation remaps derived equations from a removed field to the newly imported field", async () => {
  const context = loadAppContext({
    schemaFields: [{ id: "oldField", label: "Old Field", type: "number", unit: "count" }],
  });

  const state = context.__scoutingAppState;
  const eventModel = context.eventCatalog[0];
  state.activeEventKey = eventModel.key;
  state.eventWorkspace = context.EventWorkspace.createEventWorkspace(eventModel, {
    activeScoutingAttachmentId: "json-attachment",
    sources: {
      scouting: [{
        attachmentId: "json-attachment",
        label: "JSON + schema",
        format: "scouting-json",
        locationKind: "path",
        location: {
          path: "2026chcmp.json",
          schemaPath: "2026chcmp_profile-v1.json",
        },
        profileId: "canonical-json-v1",
        translatorId: "canonical-json-v1",
        autoLoad: true,
      }],
    },
  });
  state.scoutingSubmissions = [{
    eventKey: eventModel.key,
    scoutingSchemaSignature: JSON.stringify({
      fields: [{ id: "oldField", label: "Old Field", type: "number", unit: "count" }],
    }),
  }];
  context.registerScoutingProfile(eventModel, {
    id: "canonical-json-v1",
    label: "Canonical JSON",
    fields: [{ id: "oldField", label: "Old Field", type: "number", unit: "count" }],
    derivedEquations: [{ id: "total", name: "total", formula: "sum(scouting.oldField)" }],
  });
  state.importResult = {
    ok: true,
    summary: {
      profileId: "canonical-json-v1",
      profileLabel: "Canonical JSON",
      schemaFields: [{ id: "newField", label: "New Field", type: "number", unit: "count" }],
      profileDefinition: {
        id: "canonical-json-v1",
        label: "Canonical JSON",
        derivedEquations: [{ id: "total", name: "total", formula: "sum(scouting.oldField)" }],
        filters: [],
      },
    },
  };

  context.remapScoutingSchemaField("newField", "oldField");

  const model = context.currentScoutingSchemaReconciliationModel();
  assert.ok(model, "Expected a reconciliation model.");
  assert.equal(model.readyToPersist, true);
  assert.equal(model.draftProfileDefinition.derivedEquations[0].formula, "sum(scouting.newField)");
});

await runTest("current event diagnostics still expose schema reconciliation when drift remains after import", async () => {
  const context = loadAppContext({
    schemaFields: [{ id: "oldField", label: "Old Field", type: "number", unit: "count" }],
  });

  const state = context.__scoutingAppState;
  const eventModel = context.eventCatalog[0];
  state.activeEventKey = eventModel.key;
  state.eventWorkspace = context.EventWorkspace.createEventWorkspace(eventModel, {
    activeScoutingAttachmentId: "json-attachment",
    sources: {
      scouting: [{
        attachmentId: "json-attachment",
        label: "JSON + schema",
        format: "scouting-json",
        locationKind: "path",
        location: {
          path: "2026chcmp.json",
          schemaPath: "2026chcmp_profile-v1.json",
        },
        profileId: "canonical-json-v1",
        translatorId: "canonical-json-v1",
        autoLoad: true,
      }],
    },
  });
  state.scoutingSubmissions = [
    {
      eventKey: eventModel.key,
      scoutingSchemaSignature: JSON.stringify({
        fields: [{ id: "oldField", label: "Old Field", type: "number", unit: "count" }],
      }),
      rawMetrics: { newField: 1 },
    },
  ];
  context.registerScoutingProfile(eventModel, {
    id: "canonical-json-v1",
    label: "Canonical JSON",
    fields: [{ id: "oldField", label: "Old Field", type: "number", unit: "count" }],
    derivedEquations: [{ id: "total", name: "total", formula: "sum(scouting.oldField)" }],
  });
  state.importResult = null;
  const initialModel = context.currentScoutingSchemaReconciliationModel();
  assert.ok(initialModel, "Expected a reconciliation model for current event diagnostics.");
  assert.equal(initialModel.addedCards.some((entry) => entry.fieldDefinition.id === "newField"), true);
  assert.equal(initialModel.removedCards.some((entry) => entry.fieldDefinition.id === "oldField"), true);

  context.remapScoutingSchemaField("newField", "oldField");
  const model = context.currentScoutingSchemaReconciliationModel();

  assert.equal(model.readyToPersist, true);
  assert.equal(model.draftProfileDefinition.derivedEquations[0].formula, "sum(scouting.newField)");
});

await runTest("current event drift still offers remap actions when pending import diagnostics are clean", async () => {
  const context = loadAppContext({
    schemaFields: [{ id: "oldField", label: "Old Field", type: "number", unit: "count" }],
  });

  const state = context.__scoutingAppState;
  const eventModel = context.eventCatalog[0];
  state.activeEventKey = eventModel.key;
  state.eventWorkspace = context.EventWorkspace.createEventWorkspace(eventModel, {
    activeScoutingAttachmentId: "json-attachment",
    sources: {
      scouting: [{
        attachmentId: "json-attachment",
        label: "JSON + schema",
        format: "scouting-json",
        locationKind: "path",
        location: {
          path: "2026chcmp.json",
          schemaPath: "2026chcmp_profile-v1.json",
        },
        profileId: "canonical-json-v1",
        translatorId: "canonical-json-v1",
        autoLoad: true,
      }],
    },
  });
  state.scoutingSubmissions = [
    {
      eventKey: eventModel.key,
      scoutingSchemaSignature: JSON.stringify({
        fields: [{ id: "oldField", label: "Old Field", type: "number", unit: "count" }],
      }),
      rawMetrics: { newField: 1 },
    },
  ];
  context.registerScoutingProfile(eventModel, {
    id: "canonical-json-v1",
    label: "Canonical JSON",
    fields: [{ id: "oldField", label: "Old Field", type: "number", unit: "count" }],
    derivedEquations: [{ id: "total", name: "total", formula: "sum(scouting.oldField)" }],
  });
  state.importResult = {
    ok: true,
    summary: {
      profileId: "canonical-json-v1",
      profileLabel: "Canonical JSON",
      schemaFields: [{ id: "oldField", label: "Old Field", type: "number", unit: "count" }],
      profileDefinition: {
        id: "canonical-json-v1",
        label: "Canonical JSON",
        derivedEquations: [{ id: "total", name: "total", formula: "sum(scouting.oldField)" }],
        filters: [],
      },
    },
  };

  const model = context.currentScoutingSchemaReconciliationModel();
  assert.ok(model, "Expected current-event drift to drive reconciliation when pending diagnostics are clean.");
  assert.equal(model.addedCards.some((entry) => entry.fieldDefinition.id === "newField"), true);
  assert.equal(model.addedCards.some((entry) => entry.removedFieldCandidates.some((candidate) => candidate.id === "oldField")), true);
  assert.equal(model.removedCards.some((entry) => entry.fieldDefinition.id === "oldField"), true);
});

await runTest("removed legacy fields can remap to current scouting fields that already exist in the profile", async () => {
  const context = loadAppContext({
    eventCatalog: [{
      key: "2024mdsev",
      season: 2024,
      name: "MDSEV",
      seasonLabel: "2024",
      teams: [{ number: 1 }],
      teamNumbers: [1],
      matches: [{ number: 1 }],
      dataSources: [],
      seedPicklists: [],
      seedSortEquations: [],
      formulaFieldDefinitions: [],
      sheet: { recommendedProfileId: "match-current-v2" },
    }],
  });

  const state = context.__scoutingAppState;
  const eventModel = context.eventCatalog[0];
  state.activeEventKey = eventModel.key;
  state.eventWorkspace = context.EventWorkspace.createEventWorkspace(eventModel, {
    activeScoutingAttachmentId: "json-attachment",
    sources: {
      scouting: [{
        attachmentId: "json-attachment",
        label: "JSON + schema",
        format: "scouting-json",
        locationKind: "path",
        location: {
          path: "2024mdsev.json",
          schemaPath: "2024mdsev_profile-v1.json",
        },
        profileId: "canonical-json-v1",
        translatorId: "canonical-json-v1",
        autoLoad: true,
      }],
    },
  });
  state.scoutingSubmissions = [{
    eventKey: eventModel.key,
    scoutingSchemaSignature: JSON.stringify({
      fields: [
        { id: "autoSpeakerMiss", label: "Auto Speaker Miss", type: "number" },
        { id: "autoSpeakerMissed", label: "Auto Speaker Missed", type: "number" },
      ],
    }),
    rawMetrics: {
      autoSpeakerMissed: 2,
    },
  }];
  context.registerScoutingProfile(eventModel, {
    id: "canonical-json-v1",
    label: "Canonical JSON",
    fields: [
      { id: "autoSpeakerMiss", label: "Auto Speaker Miss", type: "number", unit: "count" },
      { id: "autoSpeakerMissed", label: "Auto Speaker Missed", type: "number", unit: "count" },
    ],
    derivedEquations: [{ id: "missTotal", name: "missTotal", formula: "sum(scouting.autoSpeakerMiss)" }],
  });
  state.importResult = null;

  const initialModel = context.currentScoutingSchemaReconciliationModel();
  const removedCard = initialModel.removedCards.find((entry) => entry.fieldDefinition.id === "autoSpeakerMiss");
  assert.ok(removedCard, "Expected autoSpeakerMiss to be removable.");
  assert.equal(removedCard.currentFieldCandidates.some((candidate) => candidate.id === "autoSpeakerMissed"), true);

  context.remapRemovedScoutingSchemaField("autoSpeakerMiss", "autoSpeakerMissed");

  const resolvedModel = context.currentScoutingSchemaReconciliationModel();
  assert.equal(resolvedModel.removedCards.some((entry) => entry.fieldDefinition.id === "autoSpeakerMiss"), false);
  assert.equal(resolvedModel.readyToPersist, true);
  assert.equal(resolvedModel.draftProfileDefinition.derivedEquations[0].formula, "sum(scouting.autoSpeakerMissed)");
});

await runTest("claimed remap targets are removed from future mapping options", async () => {
  const context = loadAppContext({
    schemaFields: [
      { id: "oldFieldA", label: "Old Field A", type: "number", unit: "count" },
      { id: "oldFieldB", label: "Old Field B", type: "number", unit: "count" },
    ],
  });

  const state = context.__scoutingAppState;
  const eventModel = context.eventCatalog[0];
  state.activeEventKey = eventModel.key;
  state.eventWorkspace = context.EventWorkspace.createEventWorkspace(eventModel, {
    activeScoutingAttachmentId: "json-attachment",
    sources: {
      scouting: [{
        attachmentId: "json-attachment",
        label: "JSON + schema",
        format: "scouting-json",
        locationKind: "path",
        location: {
          path: "2026chcmp.json",
          schemaPath: "2026chcmp_profile-v1.json",
        },
        profileId: "canonical-json-v1",
        translatorId: "canonical-json-v1",
        autoLoad: true,
      }],
    },
  });
  state.scoutingSubmissions = [{
    eventKey: eventModel.key,
    scoutingSchemaSignature: JSON.stringify({
      fields: [
        { id: "oldFieldA", label: "Old Field A", type: "number", unit: "count" },
        { id: "oldFieldB", label: "Old Field B", type: "number", unit: "count" },
        { id: "newFieldA", label: "New Field A", type: "number", unit: "count" },
        { id: "newFieldB", label: "New Field B", type: "number", unit: "count" },
      ],
    }),
    rawMetrics: {
      newFieldA: 1,
      newFieldB: 2,
    },
  }];
  context.registerScoutingProfile(eventModel, {
    id: "canonical-json-v1",
    label: "Canonical JSON",
    fields: [
      { id: "oldFieldA", label: "Old Field A", type: "number", unit: "count" },
      { id: "oldFieldB", label: "Old Field B", type: "number", unit: "count" },
      { id: "newFieldA", label: "New Field A", type: "number", unit: "count" },
      { id: "newFieldB", label: "New Field B", type: "number", unit: "count" },
    ],
    derivedEquations: [],
  });
  state.importResult = null;

  context.remapRemovedScoutingSchemaField("oldFieldA", "newFieldA");
  const removedModel = context.currentScoutingSchemaReconciliationModel();
  const remainingRemoved = removedModel.removedCards.find((entry) => entry.fieldDefinition.id === "oldFieldB");
  assert.ok(remainingRemoved, "Expected oldFieldB to remain unresolved.");
  assert.equal(remainingRemoved.currentFieldCandidates.some((candidate) => candidate.id === "newFieldA"), false);

  state.scoutingSubmissions = [{
    eventKey: eventModel.key,
    scoutingSchemaSignature: JSON.stringify({
      fields: [
        { id: "oldFieldA", label: "Old Field A", type: "number", unit: "count" },
        { id: "oldFieldB", label: "Old Field B", type: "number", unit: "count" },
      ],
    }),
    rawMetrics: {
      newFieldA: 1,
      newFieldB: 2,
    },
  }];
  state.scoutingSchemaResolutions = { added: {}, removed: {} };
  context.remapScoutingSchemaField("newFieldA", "oldFieldA");
  const addedModel = context.currentScoutingSchemaReconciliationModel();
  const remainingAdded = addedModel.addedCards.find((entry) => entry.fieldDefinition.id === "newFieldB");
  assert.ok(remainingAdded, "Expected newFieldB to remain unresolved.");
  assert.equal(remainingAdded.removedFieldCandidates.some((candidate) => candidate.id === "oldFieldA"), false);
});

await runTest("saving reconciled schema artifacts as new files writes both the schema and sidecar link", async () => {
  const createdFiles = [];
  const writtenFiles = new Map();
  const context = loadAppContext({
    createAttachmentFile: async (options) => {
      const pathValue = String(options.path || options.suggestedName || "");
      createdFiles.push({ attachmentId: options.attachmentId, path: pathValue });
      return {
        attachmentId: options.attachmentId,
        path: pathValue,
        name: path.basename(pathValue),
      };
    },
    writeAttachmentText: async (attachmentId, text) => {
      writtenFiles.set(attachmentId, String(text || ""));
      return true;
    },
    pathBasename: (value) => String(value || "").trim().replace(/\\/g, "/").split("/").pop() || "",
  });

  const state = context.__scoutingAppState;
  const eventModel = context.eventCatalog[0];
  state.activeEventKey = eventModel.key;
  state.eventWorkspace = context.EventWorkspace.createEventWorkspace(eventModel, {
    activeScoutingAttachmentId: "json-attachment",
    sources: {
      scouting: [{
        attachmentId: "json-attachment",
        label: "JSON + schema",
        format: "scouting-json",
        locationKind: "path",
        location: {
          path: "2026chcmp.json",
          schemaPath: "2026chcmp_profile-v1.json",
        },
        profileId: "canonical-json-v1",
        translatorId: "canonical-json-v1",
        autoLoad: true,
      }],
    },
  });
  context.registerScoutingProfile(eventModel, {
    id: "canonical-json-v1",
    label: "Canonical JSON",
    fields: [{ id: "newField", label: "New Field", type: "number", unit: "count" }],
    derivedEquations: [{ id: "total", name: "total", formula: "sum(scouting.newField)" }],
  });

  const result = await context.saveSchemaArtifactAsNewFiles({
    attachment: context.currentScoutingAttachment(),
    scoutingSource: "2026chcmp.json",
    profileDefinition: {
      id: "canonical-json-v1",
      label: "Canonical JSON",
      fields: [{ id: "newField", label: "New Field", type: "number", unit: "count" }],
      derivedEquations: [{ id: "total", name: "total", formula: "sum(scouting.newField)" }],
      filters: [],
    },
    eventModel,
    existingSchemaJsonText: "",
  });

  assert.equal(result.schemaSource, "2026chcmp_profile-v2.json");
  assert.equal(result.schemaLinkSource, "2026chcmp_profile-v2-link.json");
  assert.deepEqual(createdFiles, [
    { attachmentId: "json-attachment:schema", path: "2026chcmp_profile-v2.json" },
    { attachmentId: "json-attachment:schema-link", path: "2026chcmp_profile-v2-link.json" },
  ]);
  assert.ok(writtenFiles.get("json-attachment:schema")?.includes("\"derivedEquations\""));
  assert.equal(
    writtenFiles.get("json-attachment:schema-link"),
    JSON.stringify({
      scoutingFile: "2026chcmp.json",
      schemaFile: "2026chcmp_profile-v2.json",
    }, null, 2),
  );
  assert.equal(context.currentScoutingAttachment().location.schemaPath, "2026chcmp_profile-v2.json");
  assert.equal(context.currentScoutingAttachment().location.schemaLinkPath, "2026chcmp_profile-v2-link.json");
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
    derivedEquations: [
      { id: "tba_rank", name: "TBA Rank", formula: "tba.ranking.rank" },
      { id: "statbotics_total_points", name: "Statbotics Total Points", formula: "statbotics.epa.total_points" },
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

await runTest("provider metric catalogs apply default and schema blacklists without hiding foul performance", async () => {
  const eventCatalog = [{
    key: "2025chcmp",
    season: 2025,
    name: "CHCMP",
    seasonLabel: "2025",
    teams: [{
      number: 111,
      sources: {
        tba: { components: {} },
        statbotics: {
          components: {
            team_name: "Example Team",
            "epa.total_points": 42.7,
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
        red: {
          adjustPoints: 0,
          foulPoints: 8,
          autoReef: {
            topRow: { nodeA: true },
            tba_topRowCount: 1,
          },
        },
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
  const metricDiscovery = {
    blacklist: {
      tba: [
        "scoreBreakdown.autoReef.*.node*",
        "scoreBreakdown.teleopReef.*.node*",
      ],
      statbotics: [],
    },
  };
  state.importSchemaJsonText = JSON.stringify({
    schema: {
      metricDiscovery,
    },
  });
  context.registerScoutingProfile(eventModel, {
    id: "match-current-v2",
    label: "Current Match Template",
    fields: [{
      id: "autoL4Made",
      label: "Auto L4 Made",
      type: "number",
      unit: "count",
    }],
    metricDiscovery,
  });
  state.importSchemaJsonText = "";

  const identifiers = context.currentDerivedAvailableMetrics(eventModel).map((metric) => metric.id);
  assert.equal(identifiers.includes("tba.autoReef.topRow.nodeA"), false);
  assert.equal(identifiers.includes("tba.autoReef.tba_topRowCount"), true);
  assert.equal(identifiers.includes("tba.teleopReef.topRow.nodeD"), false);
  assert.equal(identifiers.includes("tba.adjustPoints"), false);
  assert.equal(identifiers.includes("tba.foulPoints"), true);
  assert.equal(identifiers.includes("statbotics.team_name"), false);
  assert.equal(identifiers.includes("statbotics.epa.total_points"), true);
  assert.equal(
    context.metricTokenLabel({
      kind: "source",
      sourceId: "scouter",
      componentId: "autoL4Made",
      label: "Scouting Auto L4 Made",
    }),
    "scouting.autoL4Made",
  );
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
    derivedEquations: [
      { id: "tba_rank", name: "TBA Rank", formula: "tba.ranking.rank" },
    ],
  });
  state.activeDerivedEquationId = "tba_rank";

  const html = context.renderDerivedBuilder();
  assert.match(html, /42\.7/);
  assert.doesNotMatch(html, />Invalid</);
});

await runTest("formula autocomplete scrolls the keyboard-selected suggestion into view", async () => {
  let scrolledSuggestion = "";
  const popup = {
    hidden: true,
    dataset: {},
    _buttons: [],
    set innerHTML(value) {
      this._innerHTML = value;
      const matches = [...String(value || "").matchAll(/data-formula-suggestion="([^"]+)"/g)];
      const activeIndex = String(value || "").indexOf("formula-autocomplete-item active");
      let runningIndex = -1;
      this._buttons = matches.map((match) => {
        runningIndex += 1;
        const raw = match[1]
          .replaceAll("&quot;", "\"")
          .replaceAll("&lt;", "<")
          .replaceAll("&gt;", ">")
          .replaceAll("&amp;", "&");
        const active = activeIndex >= 0 && activeIndex < match.index;
        return {
          dataset: { formulaSuggestion: raw },
          scrollIntoView: ({ block } = {}) => {
            if (block === "nearest") scrolledSuggestion = raw;
          },
          _activeCandidate: active,
        };
      });
    },
    get innerHTML() {
      return this._innerHTML || "";
    },
    querySelectorAll(selector) {
      if (selector === "[data-formula-suggestion]") return this._buttons;
      return [];
    },
  };

  const context = loadAppContext({
    schemaFields: [{ id: "autoFuelPct", label: "Auto Fuel %", type: "number", unit: "%" }],
    eventCatalog: [{
      key: "2026chcmp",
      season: 2026,
      name: "CHCMP",
      seasonLabel: "2026",
      teams: [{ number: 1 }],
      teamNumbers: [1],
      matches: [{
        number: 1,
        red: [1, 2, 3],
        blue: [4, 5, 6],
        scoreBreakdown: {
          red: {},
          blue: {},
        },
      }],
      dataSources: [],
      seedPicklists: [],
      seedSortEquations: [],
      formulaFieldDefinitions: [{ id: "autoFuelPct", label: "Auto Fuel %", type: "number", unit: "%" }],
      sheet: { recommendedProfileId: "match-current-v2" },
    }],
    extraQuerySelectors: {
      "#derivedFormulaAutocomplete": popup,
    },
  });

  const eventModel = context.eventCatalog[0];
  context.registerScoutingProfile(eventModel, {
    id: "match-current-v2",
    label: "Current",
    fields: [{ id: "autoFuelPct", label: "Auto Fuel %", type: "number", unit: "%" }],
    derivedEquations: [],
  });

  const input = {
    value: "a",
    selectionStart: "a".length,
  };

  const initialResult = context.renderFormulaAutocomplete(input, 0);
  assert.ok(initialResult.candidates.length > 1, "Expected multiple autocomplete candidates.");

  const selectedIndex = Math.min(5, initialResult.candidates.length - 1);
  const result = context.renderFormulaAutocomplete(input, selectedIndex);
  assert.equal(result.selectedIndex, selectedIndex);
  assert.equal(scrolledSuggestion, result.candidates[selectedIndex]);
});

await runTest("escape in the derived equation editor restores the formula that was present when the equation was selected", async () => {
  const context = loadAppContext();
  const eventModel = context.eventCatalog[0];
  const state = context.__scoutingAppState;
  state.activeEventKey = eventModel.key;

  context.registerScoutingProfile(eventModel, {
    id: "match-current-v2",
    label: "Current",
    fields: [],
    derivedEquations: [
      { id: "derived_one", name: "Derived One", formula: "tba.rank" },
    ],
  });
  state.activeDerivedEquationId = "derived_one";
  context.rememberActiveDerivedEquationEditSession(eventModel);

  context.updateProfileEquationFormula("derived_one", "statbotics.epa.total_points");
  assert.equal(context.activeDerivedEquation(eventModel).formula, "statbotics.epa.total_points");

  const reverted = context.revertActiveDerivedEquationFormulaToSelectionOriginal(eventModel);
  assert.equal(reverted, true);
  assert.equal(context.activeDerivedEquation(eventModel).formula, "tba.rank");
});
