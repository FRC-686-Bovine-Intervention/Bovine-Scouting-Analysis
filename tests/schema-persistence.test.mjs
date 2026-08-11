import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

const appSourceForSchemaLoadAssertion = fs.readFileSync(path.resolve("src/app.js"), "utf8");
assert.match(appSourceForSchemaLoadAssertion, /loadPreparedScoutingSheet\(csvText, profileId, \{[\s\S]*schemaJsonText,[\s\S]*importDraftSource: "attached"/);
assert.match(appSourceForSchemaLoadAssertion, /const schemaJsonText = await readAttachedScoutingSchemaText\(attachment, attachmentLoad, sourceUrl\)\.catch\(\(\) => ""\);[\s\S]*cacheActiveRawScoutingSource\(csvText, requestUrl,[\s\S]*schemaJsonText,[\s\S]*schemaSource: attachmentLoad\.schemaPath \|\| attachmentLoad\.schemaUrl/);
assert.match(appSourceForSchemaLoadAssertion, /async function cacheScoutingSchemaArtifacts\(schemaJsonText,[\s\S]*sourceId: "scouting-schema"[\s\S]*api\.saveEventSourceCache/);
assert.match(appSourceForSchemaLoadAssertion, /state\.importSchemaJsonText = schemaJsonText;[\s\S]*cacheScoutingSchemaArtifacts\(schemaJsonText, schemaPath \|\| schemaUrl/);
assert.match(appSourceForSchemaLoadAssertion, /state\.importSchemaJsonText = schemaArtifactText;[\s\S]*cacheScoutingSchemaArtifacts\([\s\S]*selectedSchema\.path[\s\S]*selectedLink\.path/);
assert.match(appSourceForSchemaLoadAssertion, /const selectedProfileDefinitions = currentImportedProfileDefinition\(eventModel\)\?\.pridgeResponseDefinitions;[\s\S]*const profileDefinitions = Array\.isArray\(selectedProfileDefinitions\)/);
assert.match(appSourceForSchemaLoadAssertion, /const importedPridgeResponseDefinitions = currentPridgeResponseDefinitions\(currentEvent\(\)\);[\s\S]*pridgeResponseDefinitions: importedPridgeResponseDefinitions/);
assert.match(appSourceForSchemaLoadAssertion, /const pridgeResponseDefinitions = Array\.isArray\(profile\?\.pridgeResponseDefinitions\)[\s\S]*pridgeResponseDefinitions \}/);
assert.match(appSourceForSchemaLoadAssertion, /const localById = new Map\(localProfiles\.map\(\(profile\) => \[profile\.id, profile\]\)\);[\s\S]*localProfile\.pridgeResponseDefinitions/);
assert.match(appSourceForSchemaLoadAssertion, /eventScopedProfiles\(eventModel\)\.find\(\(profile\) => Array\.isArray\(profile\?\.pridgeResponseDefinitions\)/);

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
  const eventCatalog = Object.hasOwn(options, "eventCatalog")
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
  const storedValues = new Map(Object.entries(options.storedValues || {}));
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
    ExternalEventLoader: options.ExternalEventLoader || {},
    localStorage: {
      getItem: (key) => storedValues.has(String(key)) ? storedValues.get(String(key)) : null,
      setItem: (key, value) => storedValues.set(String(key), String(value)),
      removeItem: (key) => storedValues.delete(String(key)),
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
    fetch: async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => "" }),
    LocalFileAccess: {
      supportsPersistentLocalFiles: options.supportsPersistentLocalFiles || (() => true),
      pickAttachmentFile: options.pickAttachmentFile || (async () => ({ attachmentId: "", path: "", name: "" })),
      createAttachmentFile: options.createAttachmentFile || (async () => ({ attachmentId: "", path: "", name: "" })),
      writeAttachmentText: options.writeAttachmentText || (async () => true),
      readAttachmentText: options.readAttachmentText || (async () => ""),
      readAttachmentTextByPath: options.readAttachmentTextByPath || (async () => ""),
      adoptAttachmentForPath: options.adoptAttachmentForPath || (async () => false),
      removeAttachment: options.removeAttachment || (async () => true),
      downloadTextFile: options.downloadTextFile || (() => ""),
      pathBasename:
        options.pathBasename
        || ((value) => String(value || "").trim().replace(/\\/g, "/").split("/").pop() || ""),
    },
  };
  context.window = context;
  context.globalThis = context;

  const appSource = fs.readFileSync(path.join(workspaceRoot, "src/app.js"), "utf8")
    .replace(/installGlobalRecoveryGuards\(\);/, "")
    .replace(/\nbootstrapApp\(\);\s*/, "\n")
    + "\nglobalThis.__activeEventTestApi = { applyAdminEventCodeDraft, applyScoutingSchemaSourceInputChange, clearCurrentEventScoutingData, createSchemaBaselineFile, currentDataSources, loadArbitraryEventCode, loadAttachedSchemaForDiagnostics, openSharedCachedEvent, persistScoutingSubmissions, refreshDataSource, restoreSharedCachedActiveEvent, setCurrentScoutingSchemaSourceUrl, setCurrentScoutingSourceUrl, startSharedActiveEventSync, switchActiveEvent, syncSharedSubmissionsForEvent };\n";

  [
    "src/dynamic-scouting-fields.js",
    "src/metric-engine.js",
    "src/scouting-dependency-diagnostics.js",
    "src/scouting-diagnostics-state.js",
    "src/scouting-source-utils.js",
    "src/scouting-json-schema.js",
    "src/scouting-json-import.js",
    "src/scouting-profiles.js",
    "src/event-workspace.js",
    "src/frc-season-metadata.js",
  ].forEach((relativePath) => {
    const source = fs.readFileSync(path.join(workspaceRoot, relativePath), "utf8");
    vm.runInNewContext(source, context, { filename: path.join(workspaceRoot, relativePath) });
  });
  vm.runInNewContext(appSource, context, { filename: path.join(workspaceRoot, "src/app.js") });
  context.__renderForTest = context.render;
  context.render = noop;
  return context;
}

await runTest("schema baseline downloads the cached profile, workspace, and complete pRidge definitions", async () => {
  let downloadedText = "";
  const context = loadAppContext({
    downloadTextFile: (text) => {
      downloadedText = text;
      return "2026chcmp_schema-baseline.json";
    },
  });
  const eventModel = context.eventCatalog[0];
  const state = context.__scoutingAppState;
  state.activeEventKey = eventModel.key;
  context.registerScoutingProfile(eventModel, {
    id: "match-current-v2",
    label: "Current",
    fields: [{ id: "fuel", label: "Fuel", type: "number", unit: "count" }],
    derivedEquations: [{ id: "scoutingTotal", name: "scoutingTotal", formula: "sum(scouting.fuel)" }],
    filters: [{ name: "usable", formula: "scouting.fuel > 0" }],
    pridgeResponseDefinitions: [{ id: "tbaTotalAutoPoints", formula: "tba.autoPoints" }],
  });
  state.picklists = [{ id: "main", name: "Main", teams: [1] }];
  state.sortEquations = [{ id: "sort-main", name: "Sort Main", terms: [{ metric: "scoutingTotal", direction: "desc" }] }];
  state.activePicklist = "main";
  state.activeSortEquation = "sort-main";

  await context.__activeEventTestApi.createSchemaBaselineFile();
  const artifact = JSON.parse(downloadedText);
  assert.deepEqual(artifact.schema.expectedScoutingFields, ["fuel"]);
  assert.equal(artifact.profile.derivedEquations[0].name, "scoutingTotal");
  assert.equal("filters" in artifact.profile, false);
  assert.deepEqual(artifact.workspace.picklists, state.picklists);
  assert.equal("sortEquations" in artifact.workspace, false);
  assert.equal("activePicklist" in artifact.workspace, false);
  assert.equal("activeSortEquation" in artifact.workspace, false);
  assert.equal(artifact.schema.pridgeResponseDefinitions.find((definition) => definition.id === "tbaTotalAutoPoints").formula, "tba.autoPoints");
  assert.equal(artifact.schema.pridgeResponseDefinitions.length, 3);
});

await runTest("the scouting source card removes event trademark and sponsorship decoration", () => {
  const eventModel = {
    key: "2026chcmp",
    season: 2026,
    seasonLabel: "2026 Rebuilt™ Presented By Haas",
    name: "FIRST Chesapeake District Championship presented by C-CAM, VSU, Go Tec, and NASA",
    teams: [],
    teamNumbers: [],
    matches: [],
    dataSources: [],
    seedPicklists: [],
    seedSortEquations: [],
    formulaFieldDefinitions: [],
    sheet: null,
  };
  const context = loadAppContext({ eventCatalog: [eventModel] });
  context.__scoutingAppState.activeEventKey = eventModel.key;
  context.hydrateEventState(eventModel.key);

  const scoutingSource = context.__activeEventTestApi.currentDataSources().find((source) => source.sourceId === "scouting");
  assert.equal(
    scoutingSource.name,
    "FIRST Chesapeake District Championship Scouting",
    JSON.stringify({ event: context.currentEvent(), attachment: context.currentScoutingAttachment() }),
  );
  assert.doesNotMatch(scoutingSource.name, /presented by|sponsored by|[™®℠]/i);
});

await runTest("schema profile updates preserve every stored profile entry", () => {
  const context = loadAppContext();
  const eventModel = context.eventCatalog[0];
  const state = context.__scoutingAppState;
  state.activeEventKey = eventModel.key;
  context.registerScoutingProfile(eventModel, {
    id: "match-current-v2",
    label: "Current",
    fields: [{ id: "fuel", label: "Fuel", type: "number", unit: "count" }],
    derivedEquations: [{ id: "scoutingTotal", name: "scoutingTotal", formula: "sum(scouting.fuel)" }],
    metricPresentation: { blacklist: { tba: ["scoreBreakdown.rp"] } },
    pridgeResponseDefinitions: [{ id: "tbaTotalAutoPoints", formula: "tba.autoPoints" }],
    versionKey: "uploaded-schema-v7",
  });

  // A later schema load/update supplies fields and metadata but may omit the
  // equation property. It must merge with the normalized profile already saved.
  context.registerScoutingProfile(eventModel, {
    id: "match-current-v2",
    fields: [{ id: "fuel", label: "Fuel", type: "number", unit: "count" }],
    metricPresentation: { blacklist: { tba: ["scoreBreakdown.rp"] } },
    pridgeResponseDefinitions: [{ id: "tbaTotalAutoPoints", formula: "tba.autoPoints" }],
  });

  const profile = state.scoutingProfileCatalog[eventModel.key][0];
  assert.equal(profile.derivedEquations.length, 1);
  assert.equal(profile.derivedEquations[0].name, "scoutingTotal");
  assert.equal(profile.versionKey, "uploaded-schema-v7");
  assert.equal(JSON.stringify(profile.fields), JSON.stringify([{ id: "fuel", label: "Fuel", type: "number", unit: "count" }]));
  assert.equal(JSON.stringify(profile.metricPresentation), JSON.stringify({ blacklist: { tba: ["scoreBreakdown.rp"] } }));
  assert.equal(JSON.stringify(profile.pridgeResponseDefinitions), JSON.stringify([{ id: "tbaTotalAutoPoints", formula: "tba.autoPoints" }]));
});

await runTest("reloading a schema preserves field type and unit metadata", async () => {
  const schemaText = JSON.stringify({
    schema: {
      expectedScoutingFields: [{ id: "fuel", label: "Fuel", type: "number", unit: "count" }],
    },
    profile: { id: "match-current-v2", derivedEquations: [] },
  });
  const context = loadAppContext({
    readAttachmentText: async (attachmentId) => attachmentId.endsWith(":schema") ? schemaText : "",
  });
  const eventModel = context.eventCatalog[0];
  const state = context.__scoutingAppState;
  state.activeEventKey = eventModel.key;
  state.eventWorkspace = context.EventWorkspace.createEventWorkspace(eventModel, {
    activeScoutingAttachmentId: "scouting-schema-test",
    sources: {
      scouting: [{
        attachmentId: "scouting-schema-test",
        locationKind: "path",
        location: { path: "scouting.csv", schemaPath: "schema.json" },
        autoLoad: false,
      }],
    },
  });

  assert.equal(await context.__activeEventTestApi.loadAttachedSchemaForDiagnostics(), true);
  const profile = state.scoutingProfileCatalog[eventModel.key][0];
  assert.equal(JSON.stringify(profile.fields), JSON.stringify([{ id: "fuel", label: "Fuel", type: "number", unit: "count" }]));
});

await runTest("schema diagnostics ignore HTML response artifacts while preserving real added fields", () => {
  const context = loadAppContext({ schemaFields: [{ id: "autoFuelPct", label: "Auto Fuel %", type: "number", unit: "%" }] });
  const eventModel = context.eventCatalog[0];
  const state = context.__scoutingAppState;
  state.activeEventKey = eventModel.key;
  context.registerScoutingProfile(eventModel, {
    id: "match-current-v2",
    label: "Current",
    fields: [{ id: "autoFuelPct", label: "Auto Fuel %", type: "number", unit: "%" }],
  });
  state.scoutingSubmissions = [{
    eventKey: eventModel.key,
    matchNumber: 1,
    teamNumber: 1,
    alliance: "red",
    rawMetrics: {
      autoFuelPct: 50,
      robotStatus: "Good",
      doctypeHtmlHtmlLangEnUsHeadScriptNonceExampleWindowPpConfigProductName26981: "unexpected",
    },
  }];

  const diagnostics = context.currentScoutingDiagnosticsState().currentDiagnostics.schemaDiff;
  assert.equal(diagnostics.added.some((field) => field.id === "robotStatus"), true);
  assert.equal(diagnostics.added.some((field) => field.id.includes("doctypeHtml")), false);
});

await runTest("a clean catalog exposes only shared cached events instead of a packaged fallback", () => {
  const context = loadAppContext({
    eventCatalog: [],
    storedValues: { "frc-scouting-active-event": "2025cache" },
  });
  context.__scoutingAppState.user = "member@example.com";
  context.__scoutingAppState.sharedCachedEvents = [{
    key: "2025cache",
    season: 2025,
    name: "Cached Championship",
    seasonLabel: "Reefscape",
  }];

  context.__renderForTest();

  assert.match(context.document.querySelector("#app").innerHTML, /No event loaded/i);
  assert.match(context.document.querySelector("#app").innerHTML, /2025cache \| 2025 Cached Championship/i);
  assert.doesNotMatch(context.document.querySelector("#app").innerHTML, /2026chcmp/i);
});

await runTest("a persisted shared cached event restores without a packaged catalog entry", async () => {
  const context = loadAppContext({ eventCatalog: [] });
  const cachedEvent = { key: "2025cache", season: 2025, name: "Cached Championship", seasonLabel: "Reefscape" };
  context.__scoutingAppState.activeEventKey = cachedEvent.key;
  context.__scoutingAppState.sharedCachedEvents = [cachedEvent];
  context.firebaseEventSourceCacheApi = {
    loadEventSourceCache: async () => {
      throw new Error("No cached source is available for this event.");
    },
  };
  context.CachedEventLoader = {
    rebuildCachedEvent: async () => ({
      eventModel: {
        ...cachedEvent,
        seasonLabel: "",
        teams: [{ number: 1, name: "Cached Team", flags: [], matches: [], sources: {}, derived: {} }],
        teamNumbers: [1],
        matches: [{ number: 1, red: [1], blue: [], redScore: 0, blueScore: 0, winningAlliance: "", scoreBreakdown: null }],
        matchesComplete: 1,
        scoringComponents: [],
        metrics: [],
        seedPicklists: [],
        seedSortEquations: [],
        formulaFieldDefinitions: [],
        dataSources: [],
      },
      sourceStates: {},
      warnings: [],
      cacheFreshness: "fresh",
    }),
  };

  assert.equal(await context.__activeEventTestApi.restoreSharedCachedActiveEvent(), true);
  assert.equal(context.__scoutingAppState.activeEventKey, cachedEvent.key);
  assert.equal(context.eventCatalog.length, 1);
  assert.equal(context.eventCatalog[0].catalogSource, "shared-cache");
});

await runTest("an older cached-event failure cannot overwrite a newer successful open", async () => {
  const context = loadAppContext({ eventCatalog: [] });
  const cachedEvent = { key: "2025race", season: 2025, name: "Cached Race", seasonLabel: "Reefscape" };
  const eventModel = {
    ...cachedEvent,
    seasonLabel: "",
    teams: [{ number: 1, name: "Cached Team", flags: [], matches: [], sources: {}, derived: {} }],
    teamNumbers: [1],
    matches: [{ number: 1, red: [1], blue: [], redScore: 0, blueScore: 0, winningAlliance: "", scoreBreakdown: null }],
    matchesComplete: 1,
    scoringComponents: [],
    metrics: [],
    seedPicklists: [],
    seedSortEquations: [],
    formulaFieldDefinitions: [],
    dataSources: [],
  };
  context.__scoutingAppState.sharedCachedEvents = [cachedEvent];
  context.firebaseEventSourceCacheApi = { loadEventSourceCache: async () => { throw new Error("No cached source is available for this event."); } };
  let rebuildCount = 0;
  context.CachedEventLoader = {
    rebuildCachedEvent: async () => {
      rebuildCount += 1;
      if (rebuildCount === 1) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        throw new Error("older open failed");
      }
      await new Promise((resolve) => setTimeout(resolve, 1));
      return { eventModel, sourceStates: {}, warnings: [], cacheFreshness: "fresh" };
    },
  };

  const olderOpen = context.__activeEventTestApi.openSharedCachedEvent(cachedEvent.key);
  await new Promise((resolve) => setTimeout(resolve, 2));
  const newerOpen = context.__activeEventTestApi.openSharedCachedEvent(cachedEvent.key);
  assert.equal(await newerOpen, true);
  assert.equal(await olderOpen, false);
  assert.equal(context.__scoutingAppState.eventLookupResult.kind, "success");
  assert.match(context.__scoutingAppState.eventLookupResult.message, /opened from the shared Firestore cache/i);
});

await runTest("a cached event with missing TBA artifacts falls back to a live load", async () => {
  const cachedEvent = { key: "2024mdsev", season: 2024, name: "Cached Severn", seasonLabel: "2024" };
  const eventModel = {
    ...cachedEvent,
    seasonLabel: "",
    teams: [{ number: 1, name: "Live Team", flags: [], matches: [], sources: {}, derived: {} }],
    teamNumbers: [1],
    matches: [],
    matchesComplete: 0,
    scoringComponents: [],
    metrics: [],
    seedPicklists: [],
    seedSortEquations: [],
    formulaFieldDefinitions: [],
    dataSources: [],
  };
  const context = loadAppContext({
    eventCatalog: [],
    ExternalEventLoader: {
      loadEventByCode: async () => ({ eventModel, sourceStates: {}, warnings: [], rawSourceArtifacts: [] }),
      normalizeEventCode: (value) => String(value || "").trim().toLowerCase(),
    },
  });
  context.__scoutingAppState.sharedCachedEvents = [cachedEvent];
  context.__scoutingAppState.tbaAuthKey = "configured";
  context.firebaseEventSourceCacheApi = {
    loadEventSourceCache: async () => { throw new Error("Cached tba-event data is unavailable: No cached source is available for this event."); },
  };
  context.CachedEventLoader = {
    rebuildCachedEvent: async () => { throw new Error("Cached tba-event data is unavailable: No cached source is available for this event."); },
  };

  assert.equal(await context.__activeEventTestApi.applyAdminEventCodeDraft(cachedEvent.key), true);
  assert.equal(context.__scoutingAppState.activeEventKey, cachedEvent.key);
  assert.equal(context.__scoutingAppState.eventLookupResult.kind, "success");
  assert.match(context.__scoutingAppState.eventLookupResult.message, /loaded from external providers/i);
});

await runTest("duplicate event-code submissions do not start overlapping cached loads", async () => {
  const cachedEvent = { key: "2024mdsev", season: 2024, name: "Cached Severn", seasonLabel: "2024" };
  const eventModel = {
    ...cachedEvent,
    seasonLabel: "",
    teams: [{ number: 1, name: "Cached Team", flags: [], matches: [], sources: {}, derived: {} }],
    teamNumbers: [1],
    matches: [],
    matchesComplete: 0,
    scoringComponents: [],
    metrics: [],
    seedPicklists: [],
    seedSortEquations: [],
    formulaFieldDefinitions: [],
    dataSources: [],
  };
  const context = loadAppContext({ eventCatalog: [], });
  context.__scoutingAppState.sharedCachedEvents = [cachedEvent];
  let rebuildCount = 0;
  context.firebaseEventSourceCacheApi = { loadEventSourceCache: async () => { throw new Error("No cached source is available for this event."); } };
  context.CachedEventLoader = {
    rebuildCachedEvent: async () => {
      rebuildCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return { eventModel, sourceStates: {}, warnings: [], cacheFreshness: "fresh" };
    },
  };

  const first = context.__activeEventTestApi.applyAdminEventCodeDraft(cachedEvent.key);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const second = context.__activeEventTestApi.applyAdminEventCodeDraft(cachedEvent.key);
  assert.equal(await second, false);
  assert.equal(await first, true);
  assert.equal(rebuildCount, 1);
});

await runTest("an older live event load cannot switch back after a newer load wins", async () => {
  const makeEvent = (key) => ({
    key,
    season: Number(key.slice(0, 4)),
    name: key,
    seasonLabel: "",
    teams: [{ number: 1, name: "Live Team", flags: [], matches: [], sources: {}, derived: {} }],
    teamNumbers: [1],
    matches: [],
    matchesComplete: 0,
    scoringComponents: [],
    metrics: [],
    seedPicklists: [],
    seedSortEquations: [],
    formulaFieldDefinitions: [],
    dataSources: [],
  });
  const context = loadAppContext({
    eventCatalog: [],
    ExternalEventLoader: {
      loadEventByCode: async (eventCode) => {
        await new Promise((resolve) => setTimeout(resolve, eventCode === "2026chcmp" ? 25 : 1));
        return { eventModel: makeEvent(eventCode), sourceStates: {}, warnings: [], rawSourceArtifacts: [] };
      },
      normalizeEventCode: (value) => String(value || "").trim().toLowerCase(),
    },
  });

  const olderLoad = context.__activeEventTestApi.applyAdminEventCodeDraft("2026chcmp");
  await new Promise((resolve) => setTimeout(resolve, 2));
  const newerLoad = context.__activeEventTestApi.applyAdminEventCodeDraft("2025chcmp");
  assert.equal(await newerLoad, true);
  assert.equal(await olderLoad, false);
  assert.equal(context.__scoutingAppState.activeEventKey, "2025chcmp");
});

await runTest("a background refresh cannot switch away from a newer user selection", async () => {
  const makeEvent = (key) => ({
    key,
    season: Number(key.slice(0, 4)),
    name: key,
    seasonLabel: "",
    catalogSource: "dynamic-external",
    teams: [{ number: 1, name: "Live Team", flags: [], matches: [], sources: {}, derived: {} }],
    teamNumbers: [1],
    matches: [],
    matchesComplete: 0,
    scoringComponents: [],
    metrics: [],
    seedPicklists: [],
    seedSortEquations: [],
    formulaFieldDefinitions: [],
    dataSources: [],
  });
  const context = loadAppContext({
    eventCatalog: [makeEvent("2026chcmp")],
    ExternalEventLoader: {
      loadEventByCode: async (eventCode) => {
        await new Promise((resolve) => setTimeout(resolve, eventCode === "2026chcmp" ? 25 : 1));
        return { eventModel: makeEvent(eventCode), sourceStates: {}, warnings: [], rawSourceArtifacts: [] };
      },
      normalizeEventCode: (value) => String(value || "").trim().toLowerCase(),
    },
  });
  context.__scoutingAppState.requestedEventKey = "2026chcmp";
  const refresh = context.__activeEventTestApi.refreshDataSource("tba", { trigger: "poll" });
  await new Promise((resolve) => setTimeout(resolve, 2));
  const selection = context.__activeEventTestApi.applyAdminEventCodeDraft("2025chcmp");
  assert.equal(await selection, true);
  assert.equal(await refresh, false);
  assert.equal(context.__scoutingAppState.activeEventKey, "2025chcmp");
});

await runTest("admin event changes are shared and members adopt the shared event without writing it", async () => {
  let sharedEventListener = null;
  const savedEventKeys = [];
  const context = loadAppContext({
    eventCatalog: [
      { key: "2024mdsev", season: 2024, name: "MDS Event", seasonLabel: "2024", teams: [{ number: 1 }], teamNumbers: [1], matches: [{ number: 1 }], dataSources: [], seedPicklists: [], seedSortEquations: [], formulaFieldDefinitions: [], sheet: {} },
      { key: "2026chcmp", season: 2026, name: "CHCMP", seasonLabel: "2026", teams: [{ number: 1 }], teamNumbers: [1], matches: [{ number: 1 }], dataSources: [], seedPicklists: [], seedSortEquations: [], formulaFieldDefinitions: [], sheet: {} },
    ],
  });
  const state = context.__scoutingAppState;
  context.firebaseCurrentUser = { uid: "admin" };
  context.firebaseUserRole = "admin";
  context.firebaseEventStateApi = {
    subscribeActiveEvent: (listener) => {
      sharedEventListener = listener;
      return () => {};
    },
    saveActiveEvent: async (eventKey) => savedEventKeys.push(eventKey),
  };

  context.__activeEventTestApi.startSharedActiveEventSync();
  sharedEventListener("2026chcmp");
  assert.equal(state.activeEventKey, "2026chcmp");
  assert.deepEqual(savedEventKeys, []);

  context.__activeEventTestApi.switchActiveEvent("2024mdsev");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(savedEventKeys, ["2024mdsev"]);
  sharedEventListener("2026chcmp");
  assert.equal(state.activeEventKey, "2024mdsev");
  await new Promise((resolve) => setTimeout(resolve, 5100));
  sharedEventListener("2026chcmp");
  assert.equal(state.activeEventKey, "2024mdsev");

  context.firebaseUserRole = "member";
  sharedEventListener("2026chcmp");
  assert.equal(state.activeEventKey, "2026chcmp");
  assert.deepEqual(savedEventKeys, ["2024mdsev"]);
});

await runTest("shared active-event writes skip superseded selections", async () => {
  const savedEventKeys = [];
  const context = loadAppContext({
    eventCatalog: [
      { key: "2024mdsev", season: 2024, name: "MDS Event", seasonLabel: "2024", teams: [{ number: 1 }], teamNumbers: [1], matches: [{ number: 1 }], dataSources: [], seedPicklists: [], seedSortEquations: [], formulaFieldDefinitions: [], sheet: {} },
      { key: "2026chcmp", season: 2026, name: "CHCMP", seasonLabel: "2026", teams: [{ number: 1 }], teamNumbers: [1], matches: [{ number: 1 }], dataSources: [], seedPicklists: [], seedSortEquations: [], formulaFieldDefinitions: [], sheet: {} },
    ],
  });
  context.firebaseCurrentUser = { uid: "admin" };
  context.firebaseUserRole = "admin";
  context.firebaseEventStateApi = {
    saveActiveEvent: async (eventKey) => {
      await new Promise((resolve) => setTimeout(resolve, eventKey === "2026chcmp" ? 25 : 1));
      savedEventKeys.push(eventKey);
    },
  };

  context.__activeEventTestApi.switchActiveEvent("2026chcmp");
  context.__activeEventTestApi.switchActiveEvent("2024mdsev");
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.deepEqual(savedEventKeys, ["2024mdsev"]);
});

await runTest("event-scoped scouting input drafts survive recent-event switches before their change event", () => {
  const eventCatalog = [
    { key: "2024mdsev", season: 2024, name: "MDS Event", seasonLabel: "2024", teams: [{ number: 1 }], teamNumbers: [1], matches: [{ number: 1 }], dataSources: [], seedPicklists: [], seedSortEquations: [], formulaFieldDefinitions: [], sheet: {} },
    { key: "2026chcmp", season: 2026, name: "CHCMP", seasonLabel: "2026", teams: [{ number: 1 }], teamNumbers: [1], matches: [{ number: 1 }], dataSources: [], seedPicklists: [], seedSortEquations: [], formulaFieldDefinitions: [], sheet: {} },
  ];
  const context = loadAppContext({ eventCatalog });
  const state = context.__scoutingAppState;
  const api = context.__activeEventTestApi;

  state.activeEventKey = "2024mdsev";
  context.hydrateEventState("2024mdsev");
  api.setCurrentScoutingSourceUrl("https://example.test/2026chcmp.csv", { applyToAttachment: false, persistAttachment: true });
  api.setCurrentScoutingSchemaSourceUrl("https://example.test/2026chcmp_profile.json", { applyToAttachment: false, persistAttachment: true });
  api.switchActiveEvent("2026chcmp");
  api.setCurrentScoutingSourceUrl("https://example.test/2024mdsev.csv", { applyToAttachment: false, persistAttachment: true });
  api.setCurrentScoutingSchemaSourceUrl("https://example.test/2024mdsev_profile.json", { applyToAttachment: false, persistAttachment: true });
  api.switchActiveEvent("2024mdsev");

  assert.equal(context.currentScoutingSourceInputValue(), "https://example.test/2026chcmp.csv");
  assert.equal(context.currentScoutingSchemaSourceInputValue(), "https://example.test/2026chcmp_profile.json");

  api.setCurrentScoutingSourceUrl("https://example.test/2024mdsev.csv", { applyToAttachment: false, persistAttachment: true });
  api.setCurrentScoutingSchemaSourceUrl("https://example.test/2024mdsev_profile.json", { applyToAttachment: false, persistAttachment: true });
  api.switchActiveEvent("2026chcmp");
  assert.equal(context.currentScoutingSourceInputValue(), "https://example.test/2024mdsev.csv");
  assert.equal(context.currentScoutingSchemaSourceInputValue(), "https://example.test/2024mdsev_profile.json");
});

await runTest("changing a local scouting profile uses its saved sidecar link to reattach and load the linked data file", async () => {
  const reads = [];
  const adopted = [];
  const context = loadAppContext({
    readAttachmentText: async (attachmentId) => {
      reads.push(attachmentId);
      if (attachmentId === "scouting-2026chcmp-default:schema-link") {
        return JSON.stringify({ scoutingFile: "2026chcmp.json", schemaFile: "2026chcmp_profile-v2.json" });
      }
      if (attachmentId === "scouting-2026chcmp-default") return "{\"entries\":[]}";
      return "";
    },
    readAttachmentTextByPath: async (sourcePath) => {
      reads.push(`path:${sourcePath}`);
      return sourcePath === "2026chcmp_profile-v2-link.json"
        ? JSON.stringify({ scoutingFile: "2026chcmp.json", schemaFile: "2026chcmp_profile-v2.json" })
        : "";
    },
    adoptAttachmentForPath: async (attachmentId, sourcePath) => {
      adopted.push([attachmentId, sourcePath]);
      return sourcePath === "2026chcmp.json";
    },
  });
  const state = context.__scoutingAppState;
  const eventModel = context.eventCatalog[0];
  state.activeEventKey = eventModel.key;
  state.eventWorkspace = context.EventWorkspace.createEventWorkspace(eventModel, {
    sources: {
      scouting: [{
        attachmentId: "scouting-2026chcmp-default",
        format: "scouting-json",
        locationKind: "path",
        location: {
          path: "old-data.json",
          schemaPath: "2026chcmp_profile-v1.json",
          schemaLinkPath: "2026chcmp_profile-v1-link.json",
        },
        autoLoad: true,
      }],
    },
  });

  await context.__activeEventTestApi.applyScoutingSchemaSourceInputChange({
    source: "2026chcmp_profile-v2.json",
    forceReload: true,
  });

  assert.equal(context.currentScoutingAttachment().location.path, "2026chcmp.json");
  assert.equal(context.currentScoutingAttachment().location.schemaPath, "2026chcmp_profile-v2.json");
  assert.equal(context.currentScoutingAttachment().location.schemaLinkPath, "2026chcmp_profile-v2-link.json");
  assert.deepEqual(adopted, [["scouting-2026chcmp-default", "2026chcmp.json"]]);
  assert.ok(reads.includes("path:2026chcmp_profile-v2-link.json"));
  assert.ok(reads.includes("scouting-2026chcmp-default"));
});

await runTest("members read shared submissions without writing, while admins can save, clear, and seed them", async () => {
  const calls = { clear: 0, load: 0, save: 0 };
  const context = loadAppContext();
  const state = context.__scoutingAppState;
  context.firebaseCurrentUser = { uid: "member" };
  context.firebaseUserRole = "member";
  context.firebaseSubmissionApi = {
    clearEventSubmissions: async () => { calls.clear += 1; },
    loadEventSubmissions: async () => {
      calls.load += 1;
      return [];
    },
    saveEventSubmissions: async () => { calls.save += 1; },
  };

  context.__activeEventTestApi.persistScoutingSubmissions("2026chcmp", [{ id: "member-row", eventKey: "2026chcmp" }]);
  await context.__activeEventTestApi.syncSharedSubmissionsForEvent("2026chcmp");
  context.__activeEventTestApi.clearCurrentEventScoutingData();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls, { clear: 0, load: 1, save: 0 });

  context.firebaseUserRole = "admin";
  context.__activeEventTestApi.persistScoutingSubmissions("2026chcmp", [{ id: "admin-row", eventKey: "2026chcmp" }]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  context.__activeEventTestApi.clearCurrentEventScoutingData();
  state.scoutingSubmissions = [{ id: "seed-row", eventKey: "2026chcmp" }];
  await context.__activeEventTestApi.syncSharedSubmissionsForEvent("2026chcmp");
  assert.deepEqual(calls, { clear: 1, load: 2, save: 2 });
});

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
    source: "D:\\FIRST\\Scouting\\Bovine-Scouting-Analysis\\2026chcmp_profile-v1.json",
    forceReload: true,
  });

  assert.deepEqual(removedAttachmentIds, []);
  assert.equal(
    context.currentScoutingAttachment().location.schemaPath,
    "D:\\FIRST\\Scouting\\Bovine-Scouting-Analysis\\2026chcmp_profile-v1.json",
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
    source: "D:\\FIRST\\Scouting\\Bovine-Scouting-Analysis\\2025chcmp_profile-v1.json",
    forceReload: true,
  });

  assert.equal(
    context.currentScoutingAttachment().location.path,
    "D:\\FIRST\\Scouting\\Bovine-Scouting-Analysis\\2025chcmp.json",
  );
  assert.equal(
    context.currentScoutingAttachment().location.schemaPath,
    "D:\\FIRST\\Scouting\\Bovine-Scouting-Analysis\\2025chcmp_profile-v1.json",
  );
  assert.equal(context.currentScoutingAttachment().locationKind, "path");
  assert.equal(context.currentScoutingAttachment().format, "scouting-json");
  assert.equal(context.currentScoutingSourceInputValue(), "D:\\FIRST\\Scouting\\Bovine-Scouting-Analysis\\2025chcmp.json");
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
          path: "D:\\FIRST\\Scouting\\Bovine-Scouting-Analysis\\2025chcmp.entries.json",
          schemaPath: "D:\\FIRST\\Scouting\\Bovine-Scouting-Analysis\\2025chcmp_profile-v1.json",
        },
        profileId: "canonical-json-v1",
        translatorId: "canonical-json-v1",
        autoLoad: true,
      }],
    },
  });
  state.importSourceUrl = "D:\\FIRST\\Scouting\\Bovine-Scouting-Analysis\\2025chcmp.entries.json";

  await context.applyScoutingSchemaSourceInputChange({
    source: "D:\\FIRST\\Scouting\\Bovine-Scouting-Analysis\\2025chcmp_profile-v1.json",
    forceReload: true,
  });

  assert.equal(
    context.currentScoutingAttachment().location.path,
    "D:\\FIRST\\Scouting\\Bovine-Scouting-Analysis\\2025chcmp.json",
  );
  assert.equal(
    context.currentScoutingAttachment().location.schemaPath,
    "D:\\FIRST\\Scouting\\Bovine-Scouting-Analysis\\2025chcmp_profile-v1.json",
  );
  assert.equal(context.currentScoutingAttachment().locationKind, "path");
  assert.equal(context.currentScoutingAttachment().format, "scouting-json");
  assert.equal(context.currentScoutingSourceInputValue(), "D:\\FIRST\\Scouting\\Bovine-Scouting-Analysis\\2025chcmp.json");
  assert.equal(context.detectedScoutingSourceLabel(), "Local JSON file");
});

await runTest("browsing for a local scouting profile immediately updates the bound schema path", async () => {
  const dataFixturePath = path.resolve("tests/fixtures/canonical-scouting-datasets/2026chcmp.json");
  const schemaFixturePath = path.resolve("tests/fixtures/canonical-scouting-datasets/2026chcmp_profile-v1.json");
  const dataFixtureText = fs.readFileSync(dataFixturePath, "utf8");
  const schemaFixtureText = fs.readFileSync(schemaFixturePath, "utf8");
  const reads = [];
  const pickedPath = "D:\\FIRST\\Scouting\\Bovine-Scouting-Analysis\\2026chcmp_profile-v1.json";
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
          path: "D:\\FIRST\\Scouting\\Bovine-Scouting-Analysis\\2026chcmp.json",
          schemaPath: "D:\\FIRST\\Scouting\\Bovine-Scouting-Analysis\\2026chcmp_profile-v1.json",
        },
        profileId: "canonical-json-v1",
        translatorId: "canonical-json-v1",
        autoLoad: true,
      }],
    },
  });
  state.importSourceUrl = "D:\\FIRST\\Scouting\\Bovine-Scouting-Analysis\\2026chcmp.json";

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
  const metricPresentation = {
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
      metricPresentation,
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
    metricPresentation,
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
    identifiers.filter((identifier) => identifier === "statbotics.epa.total_points").length,
    1,
  );
  assert.equal(context.metricTokenLabel({ kind: "source", sourceId: "pridge", componentId: "epa.breakdown.auto_points" }), "pridge.epa.breakdown.auto_points");
  assert.equal(context.metricTokenLabel({ kind: "source", sourceId: "pridge", componentId: "tbaTotalAutoPoints" }), "pridge.epa.breakdown.auto_points");
  assert.equal(identifiers.includes("pridge.epa.total_points"), true);
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

await runTest("scoped min and max formulas reduce real group and event values", async () => {
  const eventCatalog = [{
    key: "2026minmax",
    season: 2026,
    name: "Min Max Test",
    seasonLabel: "2026",
    teams: [
      { number: 111, sources: { statbotics: { components: { epa: { total_points: 10 } } } } },
      { number: 222, sources: { statbotics: { components: { epa: { total_points: 20 } } } } },
      { number: 333, sources: { statbotics: { components: { epa: { total_points: 35 } } } } },
    ],
    teamNumbers: [111, 222, 333],
    matches: [{ number: 1, red: [111, 222, 333], blue: [] }],
    dataSources: [],
    seedPicklists: [],
    seedSortEquations: [],
    formulaFieldDefinitions: [],
    sheet: { recommendedProfileId: "match-current-v2" },
  }];
  const context = loadAppContext({ eventCatalog });
  const eventModel = context.eventCatalog[0];
  context.__scoutingAppState.activeEventKey = eventModel.key;
  context.registerScoutingProfile(eventModel, {
    id: "match-current-v2",
    label: "Current",
    fields: [],
    derivedEquations: [
      { id: "event_min", name: "event_min", formula: "eventMin(statbotics.epa.total_points)" },
      { id: "event_max_filtered", name: "event_max_filtered", formula: "eventMax(statbotics.epa.total_points, statbotics.epa.total_points < 30)" },
    ],
  });

  assert.equal(context.aggregateGroupValues("groupmin", [12, "invalid", 4, undefined]), 4);
  assert.equal(context.aggregateGroupValues("groupmax", [12, "invalid", 4, undefined]), 12);
  assert.ok(Number.isNaN(context.aggregateGroupValues("groupmin", ["invalid", undefined])));
  assert.equal(context.evaluateEquationForTeam(111, "event_min", { eventModel }).result.value, 10);
  assert.equal(context.evaluateEquationForTeam(111, "event_max_filtered", { eventModel }).result.value, 20);
});

await runTest("formula autocomplete Tab completion stops at the shared prefix until a suggestion is selected", () => {
  const context = loadAppContext();
  const candidates = ["scouting.autoFuel", "scouting.teleOpFuel"];

  assert.equal(
    context.formulaAutocompleteTabReplacement("scout", candidates),
    "scouting.",
  );
  assert.equal(
    context.formulaAutocompleteTabReplacement("scout", candidates, "scouting.teleOpFuel"),
    "scouting.teleOpFuel",
  );
  assert.equal(
    context.formulaAutocompleteTabReplacement("scouting.autoF", ["scouting.autoFuel"]),
    "scouting.autoFuel",
  );
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

await runTest("Derived Equation Builder preserves 2026chcmp string scouting metrics for match rows", async () => {
  const fixturePayload = JSON.parse(fs.readFileSync(
    path.resolve("tests/fixtures/canonical-scouting-datasets/2026chcmp.json"),
    "utf8",
  ));
  const schemaPayload = JSON.parse(fs.readFileSync(
    path.resolve("tests/fixtures/canonical-scouting-datasets/2026chcmp_profile-v1.json"),
    "utf8",
  ));

  const context = loadAppContext();
  const eventModel = context.eventCatalog[0];
  const preview = context.ScoutingJsonImport.previewScoutingJsonImport({
    jsonText: JSON.stringify(fixturePayload),
    schemaJsonText: JSON.stringify(schemaPayload),
    eventModel,
    activeEventKey: eventModel.key,
    existingSubmissions: [],
  });
  assert.equal(preview.ok, true, (preview.errors || []).join("; "));
  const submission = preview.summary.submissions.find((entry) => entry.rawMetrics?.autoPrimaryRole === "Score");
  assert.ok(submission, "The imported 2026chcmp fixture should retain a Score auto primary role.");
  assert.equal(
    context.rawScoutingMetricValue({
      scouting: {
        components: { autoPrimaryRole: 0 },
        selectedSubmission: submission,
      },
    }, "autoPrimaryRole"),
    "Score",
    "Imported raw strings must take priority over legacy numeric component fallbacks.",
  );
  const staleSchemaContext = loadAppContext({
    schemaFields: [{ id: "autoSecondaryRole", type: "number" }],
  });
  assert.equal(
    staleSchemaContext.canonicalizeRawMetrics({ autoSecondaryRole: "Score" }).autoSecondaryRole,
    "Score",
    "A stale numeric schema must not erase an imported string scouting value during storage normalization.",
  );
  const match = context.buildFormulaScoutingMatches(
    [submission],
    [],
    ["autoPrimaryRole"],
  )[0];

  assert.equal(
    context.rawScoutingMetricValue({ scouting: match }, "autoPrimaryRole"),
    "Score",
    "The builder should display the imported string rather than a numeric fallback.",
  );
});
