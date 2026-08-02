import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadPlaywright() {
  const candidates = [
    path.resolve("node_modules/playwright/index.mjs"),
    "C:/Users/rich/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return import(pathToFileURL(candidate).href);
    }
  }
  throw new Error(`Could not resolve Playwright from: ${candidates.join(", ")}`);
}

const { chromium } = await loadPlaywright();

const appUrl = "file:///D:/FIRST/Scouting/Bovine-Scouting-Analysis/index.html";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForApp(page) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(1000);
}

async function login(page) {
  const existingUser = page.locator("#existingUser");
  if (await existingUser.count()) {
    await existingUser.selectOption("Avery");
    await page.locator("#loginButton").click();
    await page.waitForSelector('[data-view="teams"]');
  }
}

async function openAdmin(page) {
  await page.locator('[data-view="admin"]').click();
  await page.waitForSelector("#importSourceUrl");
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1400 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));
await page.addInitScript(() => {
  globalThis.confirm = () => true;
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function patchedSetItem(key, value) {
    try {
      return originalSetItem.call(this, key, value);
    } catch (error) {
      if (String(key || "").startsWith("frc-scouting-submissions:")) return undefined;
      throw error;
    }
  };

  const fileStore = new Map();
  const writeLog = [];
  globalThis.__schemaBench = {
    fileStore,
    writeLog,
  };
  globalThis.LocalFileAccess = {
    supportsPersistentLocalFiles: () => true,
    pickAttachmentFile: async () => {
      throw new Error("pickAttachmentFile not used in schema bench");
    },
    createAttachmentFile: async (options = {}) => {
      const path = String(options.path || options.suggestedName || "");
      return {
        attachmentId: String(options.attachmentId || ""),
        path,
        name: path.replace(/\\/g, "/").split("/").pop() || "",
      };
    },
    readAttachmentText: async (attachmentId) => {
      if (!fileStore.has(String(attachmentId || ""))) {
        throw new Error(`Missing test attachment ${attachmentId}`);
      }
      return fileStore.get(String(attachmentId || ""));
    },
    writeAttachmentText: async (attachmentId, text) => {
      fileStore.set(String(attachmentId || ""), String(text || ""));
      writeLog.push({ attachmentId: String(attachmentId || ""), text: String(text || "") });
      return true;
    },
    removeAttachment: async (attachmentId) => {
      fileStore.delete(String(attachmentId || ""));
      return true;
    },
    pathBasename: (value) => String(value || "").trim().replace(/\\/g, "/").split("/").pop() || "",
    readScoutingSubmissions: async () => null,
    writeScoutingSubmissions: async () => true,
    clearScoutingSubmissions: async () => true,
    clearAllScoutingSubmissions: async () => true,
  };
});

try {
  await page.goto(appUrl);
  await waitForApp(page);
  await login(page);
  await openAdmin(page);

  const initial = await page.evaluate(() => {
    const eventModel = (globalThis.eventCatalog || []).find((event) => event?.key === "2025chcmp");
    if (!eventModel) throw new Error("Could not find 2025chcmp in event catalog.");
    const state = globalThis.__scoutingAppState;

    const committedFields = [
      "autoL4Made",
      "notes",
      "climbLevel",
      "legacyOnly",
    ];
    const profileDefinition = {
      id: "canonical-json-v1",
      label: "Canonical JSON",
      versionKey: "canonical-json-v1|bench",
      derivedEquations: [
        { id: "climbScore", name: "climbScore", formula: "average(scouting.climbLevel * 3)" },
      ],
      filters: [],
    };
    const schemaArtifact = JSON.stringify({
      meta: {
        format: "frc-scouting-analysis/v1",
        templateProfileId: "canonical-json-v1",
        profileLabel: "Canonical JSON",
        translationVersion: "bench",
      },
      schema: {
        schemaId: "2025-match-v1",
        expectedScoutingFields: committedFields,
      },
      profile: {
        id: "canonical-json-v1",
        label: "Canonical JSON",
        versionKey: "canonical-json-v1|bench",
        derivedEquations: [
          { name: "climbScore", formula: "average(scouting.climbLevel * 3)" },
        ],
        filters: [],
      },
    }, null, 2);

    globalThis.__schemaBench.fileStore.set("json-attachment:schema", schemaArtifact);
    globalThis.__schemaBench.writeLog.length = 0;

    state.activeEventKey = eventModel.key;
    state.activeView = "admin";
    state.importResult = {
      ok: true,
      summary: {
        profileId: "canonical-json-v1",
        profileLabel: "Canonical JSON",
        schemaFields: [
          { id: "autoL4Made", label: "Auto L4 Made", type: "number", unit: "count" },
          { id: "notes", label: "Notes", type: "string", unit: "text" },
          { id: "climbLevel", label: "Climb Level", type: "number", unit: "count" },
          { id: "legacyOnly", label: "Legacy Only", type: "number", unit: "count" },
        ],
        profileDefinition,
      },
    };
    state.importSchemaJsonText = schemaArtifact;
    state.importDraftSource = "attached";
    state.scoutingSchemaResolutions = {};
    state.sortEquations = [];
    state.scoutingReviewOverrides = [];
    state.scoutingSubmissions = [
      {
        id: "bench-1",
        eventKey: eventModel.key,
        templateProfileId: "canonical-json-v1",
        scoutingSchemaSignature: JSON.stringify({ fields: committedFields }),
        matchNumber: 1,
        teamNumber: 9999,
        alliance: "blue",
        rawMetrics: {
          autoL4Made: 2,
          notes: "ok",
          climbHeight: 4,
          fake: 999,
        },
      },
    ];
    state.eventWorkspace = createEventWorkspace(eventModel, {
      activeScoutingAttachmentId: "json-attachment",
      sources: {
        scouting: [{
          attachmentId: "json-attachment",
          label: "JSON + schema",
          format: "scouting-json",
          locationKind: "path",
          location: {
            path: "2025chcmp.json",
            schemaPath: "2025chcmp_profile-v1.json",
          },
          profileId: "canonical-json-v1",
          translatorId: "canonical-json-v1",
          autoLoad: true,
        }],
      },
    });

    registerScoutingProfile(eventModel, {
      id: "canonical-json-v1",
      label: "Canonical JSON",
      fields: committedFields,
      derivedEquations: profileDefinition.derivedEquations,
      filters: [],
      versionKey: profileDefinition.versionKey,
    });

    globalThis.__schemaBench.persistCurrentProfile = async () => {
      const currentProfile = currentImportedProfileDefinition(currentEvent());
      const nextSchemaJsonText = buildCurrentSchemaArtifactText(currentProfile, currentEvent(), state.importSchemaJsonText);
      state.importSchemaJsonText = nextSchemaJsonText;
      globalThis.__schemaBench.fileStore.set("json-attachment:schema", nextSchemaJsonText);
      globalThis.__schemaBench.writeLog.push({
        attachmentId: "json-attachment:schema",
        text: nextSchemaJsonText,
      });
      return true;
    };

    render();

    const diagnosticsState = currentScoutingDiagnosticsState();
    const diagnosticsSelection = activeScoutingDiagnosticsSource(diagnosticsState);
    const model = currentScoutingSchemaReconciliationModel();
    return {
      modelExists: Boolean(model),
      added: model?.addedCards.map((entry) => ({
        id: entry.fieldDefinition.id,
        candidates: entry.removedFieldCandidates.map((candidate) => candidate.id),
      })) || [],
      removed: model?.removedCards.map((entry) => entry.fieldDefinition.id) || [],
      readyToPersist: Boolean(model?.readyToPersist),
      diagnosticsText: document.querySelector(".card:nth-of-type(1)")?.textContent || "",
      diagnosticsMode: diagnosticsSelection.mode,
      selectedAdded: diagnosticsSelection.diagnostics?.schemaDiff?.added?.map((entry) => entry.id) || [],
      selectedRemoved: diagnosticsSelection.diagnostics?.schemaDiff?.removed?.map((entry) => entry.id) || [],
      currentAddedLength: diagnosticsState.currentDiagnostics?.schemaDiff?.added?.length ?? null,
      currentRemovedLength: diagnosticsState.currentDiagnostics?.schemaDiff?.removed?.length ?? null,
      currentAddedIsArray: Array.isArray(diagnosticsState.currentDiagnostics?.schemaDiff?.added),
      currentRemovedIsArray: Array.isArray(diagnosticsState.currentDiagnostics?.schemaDiff?.removed),
      hasCurrentChanges: schemaDiffHasChanges(diagnosticsState.currentDiagnostics?.schemaDiff),
      hasPendingChanges: schemaDiffHasChanges(diagnosticsState.pendingDiagnostics?.schemaDiff),
      committedFields: diagnosticsState.committedFields?.map((entry) => entry.id || entry) || [],
      currentAdded: diagnosticsState.currentDiagnostics?.schemaDiff?.added?.map((entry) => entry.id) || [],
      currentRemoved: diagnosticsState.currentDiagnostics?.schemaDiff?.removed?.map((entry) => entry.id) || [],
      pendingAdded: diagnosticsState.pendingDiagnostics?.schemaDiff?.added?.map((entry) => entry.id) || [],
      pendingRemoved: diagnosticsState.pendingDiagnostics?.schemaDiff?.removed?.map((entry) => entry.id) || [],
      observedFields: currentObservedScoutingFieldDefinitions().map((entry) => entry.id),
      availableFields: currentAvailableScoutingFieldDefinitions().map((entry) => entry.id),
    };
  });

  assert(initial.added.some((entry) => entry.id === "climbHeight"), `Expected climbHeight to be added. Got ${JSON.stringify(initial)}`);
  assert(initial.added.some((entry) => entry.id === "fake"), `Expected fake to be added. Got ${JSON.stringify(initial)}`);
  assert(initial.added.find((entry) => entry.id === "climbHeight")?.candidates.includes("climbLevel"), `Expected climbHeight remap candidates to include climbLevel. Got ${JSON.stringify(initial)}`);
  assert(initial.removed.includes("climbLevel"), `Expected climbLevel to be removed. Got ${JSON.stringify(initial)}`);
  assert(initial.removed.includes("legacyOnly"), `Expected legacyOnly to be removed. Got ${JSON.stringify(initial)}`);
  assert(!initial.readyToPersist, `Expected unresolved drift before decisions. Got ${JSON.stringify(initial)}`);

  await page.locator('[data-schema-map-toggle="climbHeight"]').click();
  await page.locator('[data-schema-added-remap-select="climbHeight"]').selectOption("climbLevel");
  await page.locator('[data-schema-added-new="fake"]').click();
  await page.locator('[data-schema-remove-field="legacyOnly"]').click();

  const resolved = await page.evaluate(() => {
    const model = currentScoutingSchemaReconciliationModel();
    return {
      readyToPersist: Boolean(model?.readyToPersist),
      added: model?.addedCards.map((entry) => entry.fieldDefinition.id) || [],
      removed: model?.removedCards.map((entry) => entry.fieldDefinition.id) || [],
      formula: model?.draftProfileDefinition?.derivedEquations?.find((entry) => entry.name === "climbScore")?.formula || "",
      uiText: document.querySelector("article.card")?.textContent || "",
    };
  });

  assert(resolved.readyToPersist, `Expected resolved model to be ready. Got ${JSON.stringify(resolved)}`);
  assert(resolved.added.length === 0, `Expected no unresolved added fields. Got ${JSON.stringify(resolved)}`);
  assert(resolved.removed.length === 0, `Expected no unresolved removed fields. Got ${JSON.stringify(resolved)}`);
  assert(resolved.formula.includes("scouting.climbHeight"), `Expected derived equation rewrite to use climbHeight. Got ${JSON.stringify(resolved)}`);

  const persisted = await page.evaluate(async () => {
    const updateButton = document.querySelector("#updateCurrentSchemaFromDiagnosticsButton");
    const buttonEnabled = Boolean(updateButton) && !updateButton.disabled;
    const modelBeforePersist = currentScoutingSchemaReconciliationModel();
    const applyResult = applyScoutingSchemaResolutionDraft(modelBeforePersist);
    const persistedProfileResult = await globalThis.__schemaBench.persistCurrentProfile();
    const persistResult = applyResult && persistedProfileResult;
    const writtenText = globalThis.__schemaBench.fileStore.get("json-attachment:schema") || "";
    const parsed = writtenText ? JSON.parse(writtenText) : null;
    return {
      buttonEnabled,
      modelReady: Boolean(modelBeforePersist?.readyToPersist),
      applyResult,
      persistedProfileResult,
      persistResult,
      writeCount: globalThis.__schemaBench.writeLog.length,
      expectedScoutingFields: parsed?.schema?.expectedScoutingFields || [],
      derivedEquations: parsed?.profile?.derivedEquations || [],
      importError: globalThis.__scoutingAppState.importResult?.errors || null,
      activity: (globalThis.__scoutingAppState.activityLog || []).slice(-3),
    };
  });

  assert(persisted.buttonEnabled, `Expected Update Current Schema button to be enabled. Got ${JSON.stringify(persisted)}`);
  assert(persisted.persistResult, `Expected persistence function to succeed. Got ${JSON.stringify(persisted)}`);
  assert(persisted.writeCount > 0, `Expected schema write after Update Current Schema. Got ${JSON.stringify(persisted)}`);
  assert(persisted.expectedScoutingFields.includes("climbHeight"), `Expected saved schema fields to include climbHeight. Got ${JSON.stringify(persisted)}`);
  assert(persisted.expectedScoutingFields.includes("fake"), `Expected saved schema fields to include fake. Got ${JSON.stringify(persisted)}`);
  assert(!persisted.expectedScoutingFields.includes("climbLevel"), `Expected saved schema fields to remove climbLevel. Got ${JSON.stringify(persisted)}`);
  assert(!persisted.expectedScoutingFields.includes("legacyOnly"), `Expected saved schema fields to remove legacyOnly. Got ${JSON.stringify(persisted)}`);
  assert(
    persisted.derivedEquations.some((entry) => entry?.name === "climbScore" && String(entry?.formula || "").includes("scouting.climbHeight")),
    `Expected saved derived equations to reference climbHeight. Got ${JSON.stringify(persisted)}`,
  );

  console.log(JSON.stringify({ pageErrors, initial, resolved, persisted }, null, 2));
} finally {
  await browser.close();
}
