import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

async function loadPlaywright() {
  const candidates = [
    path.resolve("node_modules/playwright/index.mjs"),
    "C:/Users/rich/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return import(pathToFileURL(candidate).href);
  }
  throw new Error(`Could not resolve Playwright from: ${candidates.join(", ")}`);
}

const { chromium } = await loadPlaywright();

const appUrl = "file:///D:/FIRST/Scouting/Scouting-Analysis/index.html";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const sourceDataPath = path.join(repoRoot, "tests/fixtures/canonical-scouting-datasets/2025chcmp.json");
const sourceProfilePath = path.join(repoRoot, "tests/fixtures/canonical-scouting-datasets/2025chcmp_profile-v1.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createTempBenchFiles() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "schema-real-files-"));
  const dataPath = path.join(dir, "2025chcmp.json");
  const profilePath = path.join(dir, "2025chcmp_profile-v1.json");

  const dataPayload = JSON.parse(fs.readFileSync(sourceDataPath, "utf8"));
  const profilePayload = JSON.parse(fs.readFileSync(sourceProfilePath, "utf8"));

  const rawMetricsList = Array.isArray(dataPayload.entries) ? dataPayload.entries.map((entry) => entry?.rawMetrics || {}) : [];
  rawMetricsList.forEach((rawMetrics, index) => {
    if (Object.prototype.hasOwnProperty.call(rawMetrics, "climbLevel")) {
      rawMetrics.climbHeight = rawMetrics.climbLevel;
      delete rawMetrics.climbLevel;
    }
    if (!Object.prototype.hasOwnProperty.call(rawMetrics, "fake")) {
      rawMetrics.fake = 900 + (index % 10);
    }
  });

  const expectedFields = Array.isArray(profilePayload?.schema?.expectedScoutingFields)
    ? [...profilePayload.schema.expectedScoutingFields]
    : [];
  if (!expectedFields.includes("legacyOnly")) expectedFields.push("legacyOnly");
  profilePayload.schema.expectedScoutingFields = expectedFields;

  fs.writeFileSync(dataPath, JSON.stringify(dataPayload, null, 2), "utf8");
  fs.writeFileSync(profilePath, JSON.stringify(profilePayload, null, 2), "utf8");

  return { dir, dataPath, profilePath };
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
  await page.waitForSelector("#adminEventCodeInput");
}

async function resetBenchPersistence(page) {
  await page.evaluate(async () => {
    const deleteDatabase = (name) => new Promise((resolve) => {
      try {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
        request.onblocked = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
    localStorage.clear();
    sessionStorage.clear();
    await deleteDatabase("frc-scouting-analysis-local-files");
    await deleteDatabase("frc-scouting-analysis-event-data");
  });
}

async function switchEvent(page, eventKey) {
  await page.fill("#adminEventCodeInput", eventKey);
  await page.locator("#adminEventCodeInput").press("Enter");
  await page.waitForFunction((expectedEventKey) => globalThis.__scoutingAppState?.activeEventKey === expectedEventKey, eventKey);
  await page.waitForTimeout(500);
}

async function pickLocalScoutingData(page, dataPath) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator("#chooseLocalScoutingFileButton").click(),
  ]);
  await chooser.setFiles(dataPath);
  await page.waitForFunction(
    () => Boolean(currentScoutingAttachment()?.location?.path) && currentScoutingSubmissions().length > 0,
  );
}

async function pickLocalScoutingProfile(page, profilePath) {
  const previousFingerprint = await page.evaluate(() => currentScoutingAttachment()?.sourceFingerprint || "");
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator("#chooseLocalScoutingSchemaFileButton").click(),
  ]);
  await chooser.setFiles(profilePath);
  await page.waitForFunction(
    (expectedPreviousFingerprint) => {
      const attachment = currentScoutingAttachment();
      const diagnostics = currentScoutingDiagnosticsState();
      return (
        Boolean(attachment?.location?.schemaPath)
        && diagnostics.committedFields.length > 0
        && (attachment?.sourceFingerprint || "") !== expectedPreviousFingerprint
      );
    },
    previousFingerprint,
  );
  await page.waitForTimeout(300);
}

async function readUiSnapshot(page) {
  return page.evaluate(() => {
    const model = currentScoutingSchemaReconciliationModel();
    const attachment = currentScoutingAttachment();
    const diagnostics = currentScoutingDiagnosticsState();
    return {
      sourcePath: attachment?.location?.path || "",
      schemaPath: attachment?.location?.schemaPath || "",
      sourceInput: document.querySelector("#importSourceUrl")?.value || "",
      schemaInput: document.querySelector("#importSchemaSourceUrl")?.value || "",
      added: model?.addedCards.map((entry) => ({
        id: entry.fieldDefinition.id,
        candidates: entry.removedFieldCandidates.map((candidate) => candidate.id),
      })) || [],
      removed: model?.removedCards.map((entry) => entry.fieldDefinition.id) || [],
      readyToPersist: Boolean(model?.readyToPersist),
      importErrors: globalThis.__scoutingAppState?.importResult?.errors || [],
      importWarnings: globalThis.__scoutingAppState?.importResult?.warnings || [],
      importedRows: currentScoutingSubmissions().length,
      committedFields: diagnostics.committedFields.map((entry) => entry.id || entry),
      currentAdded: diagnostics.currentDiagnostics?.schemaDiff?.added?.map((entry) => entry.id) || [],
      currentRemoved: diagnostics.currentDiagnostics?.schemaDiff?.removed?.map((entry) => entry.id) || [],
    };
  });
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
});

const tempFiles = createTempBenchFiles();

try {
  await page.goto(appUrl);
  await waitForApp(page);
  await login(page);
  await openAdmin(page);
  await resetBenchPersistence(page);
  await switchEvent(page, "2025chcmp");

  await pickLocalScoutingData(page, tempFiles.dataPath);
  await pickLocalScoutingProfile(page, tempFiles.profilePath);

  const initial = await readUiSnapshot(page);
  assert(initial.importedRows > 0, `Expected imported scouting rows after loading local files. Got ${JSON.stringify(initial)}`);
  assert(String(initial.sourcePath).toLowerCase().endsWith("2025chcmp.json"), `Expected local scouting data path to end with 2025chcmp.json. Got ${JSON.stringify(initial)}`);
  assert(String(initial.schemaPath).toLowerCase().endsWith("2025chcmp_profile-v1.json"), `Expected local scouting profile path to end with 2025chcmp_profile-v1.json. Got ${JSON.stringify(initial)}`);
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
    const diagnosticsSelection = activeScoutingDiagnosticsSource(currentScoutingDiagnosticsState());
    return {
      mode: diagnosticsSelection?.mode || "",
      readyToPersist: Boolean(model?.readyToPersist),
      added: model?.addedCards.map((entry) => entry.fieldDefinition.id) || [],
      removed: model?.removedCards.map((entry) => entry.fieldDefinition.id) || [],
      draftFields: model?.draftProfileDefinition?.fields?.map((entry) => entry.id || entry) || [],
      typeChanged: model?.unresolvedTypeChanged?.map((entry) => ({
        id: entry.id,
        previousType: entry.previousType,
        currentType: entry.currentType,
      })) || [],
      formula: model?.draftProfileDefinition?.derivedEquations?.find((entry) => entry.name === "climb")?.formula || "",
      updateButtonEnabled: !document.querySelector("#updateCurrentSchemaFromDiagnosticsButton")?.disabled,
    };
  });
  assert(resolved.readyToPersist, `Expected resolved model to be ready. Got ${JSON.stringify(resolved)}`);
  assert(resolved.added.length === 0, `Expected no unresolved added fields. Got ${JSON.stringify(resolved)}`);
  assert(resolved.removed.length === 0, `Expected no unresolved removed fields. Got ${JSON.stringify(resolved)}`);
  assert(resolved.updateButtonEnabled, `Expected Update Current Schema button to be enabled. Got ${JSON.stringify(resolved)}`);

  await page.locator("#updateCurrentSchemaFromDiagnosticsButton").click();
  await page.waitForTimeout(500);

  const postClickState = await page.evaluate(() => {
    const profile = currentImportedProfileDefinition(currentEvent());
    return {
      importErrors: globalThis.__scoutingAppState?.importResult?.errors || [],
      profileFields: Array.isArray(profile?.fields) ? profile.fields.map((entry) => entry.id || entry) : [],
      attachmentSchemaSignature: currentScoutingAttachment()?.schemaSignature || "",
    };
  });

  const persistedProfile = await page.evaluate(async () => {
    const attachmentId = currentScoutingAttachment()?.attachmentId || "";
    const schemaText = attachmentId ? await LocalFileAccess.readAttachmentText(`${attachmentId}:schema`) : "";
    return schemaText ? JSON.parse(schemaText) : null;
  });
  const persistedFields = persistedProfile?.schema?.expectedScoutingFields || [];
  const derivedEquations = persistedProfile?.profile?.derivedEquations || [];
  assert(persistedFields.includes("climbHeight"), `Expected saved schema fields to include climbHeight. Got ${JSON.stringify({ persistedFields, resolved, postClickState })}`);
  assert(persistedFields.includes("fake"), `Expected saved schema fields to include fake. Got ${JSON.stringify({ persistedFields, resolved, postClickState })}`);
  assert(!persistedFields.includes("climbLevel"), `Expected saved schema fields to remove climbLevel. Got ${JSON.stringify({ persistedFields, resolved, postClickState })}`);
  assert(!persistedFields.includes("legacyOnly"), `Expected saved schema fields to remove legacyOnly. Got ${JSON.stringify({ persistedFields, resolved, postClickState })}`);
  assert(
    derivedEquations.some((entry) => entry?.name === "climb" && String(entry?.formula || "").includes("scouting.climbHeight")),
    `Expected saved derived equations to reference climbHeight. Got ${JSON.stringify(derivedEquations)}`,
  );

  console.log(JSON.stringify({
    pageErrors,
    tempFiles,
    initial,
    resolved,
    postClickState,
    persistedFields,
  }, null, 2));
} finally {
  await browser.close();
}
