import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadPlaywright() {
  const candidates = [
    path.resolve(".browser-test/node_modules/playwright/index.mjs"),
    "C:/Users/rich/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
  ];
  const candidate = candidates.find((entry) => fs.existsSync(entry));
  if (!candidate) throw new Error(`Playwright not found: ${candidates.join(", ")}`);
  return import(pathToFileURL(candidate).href);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const { chromium } = await loadPlaywright();
const root = path.resolve(".");
const fixtureDataPath = path.join(root, "tests/fixtures/canonical-scouting-datasets/2026chcmp.json");
const fixtureSchemaPath = path.join(root, "tests/fixtures/canonical-scouting-datasets/2017chcmp_schema-baseline(2).json");
const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "schema-upload-pridge-"));
const dataPath = path.join(tempDirectory, "2026local.json");
const schemaPath = path.join(tempDirectory, "2026local_schema.json");
const dataPayload = JSON.parse(fs.readFileSync(fixtureDataPath, "utf8"));
const schemaPayload = JSON.parse(fs.readFileSync(fixtureSchemaPath, "utf8"));
dataPayload.meta.eventKey = "2026local";
schemaPayload.meta.eventKey = "2026local";
schemaPayload.meta.season = 2026;
fs.writeFileSync(dataPath, JSON.stringify(dataPayload, null, 2), "utf8");
fs.writeFileSync(schemaPath, JSON.stringify(schemaPayload, null, 2), "utf8");

const executablePath = "C:/Users/rich/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe";
const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(executablePath) ? executablePath : undefined });
const context = await browser.newContext();
await context.addInitScript(() => { globalThis.confirm = () => true; });
await context.addInitScript(() => {
  globalThis.showOpenFilePicker = undefined;
  globalThis.showSaveFilePicker = undefined;
});
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));

async function resetPersistence() {
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    for (const name of ["frc-scouting-analysis-local-files", "frc-scouting-analysis-event-data"]) {
      await new Promise((resolve) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      });
    }
  });
}

try {
  await page.goto("http://localhost:4173/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  if (await page.locator("#firebaseLoginButton").count()) {
    await page.fill("#firebaseEmailInput", "admin@example.test");
    await page.fill("#firebasePasswordInput", "local-admin-password");
    await page.click("#firebaseLoginButton");
    await page.waitForSelector('[data-view="teams"]', { timeout: 15000 });
  }
  await resetPersistence();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  if (await page.locator("#firebaseLoginButton").count()) {
    await page.fill("#firebaseEmailInput", "admin@example.test");
    await page.fill("#firebasePasswordInput", "local-admin-password");
    await page.click("#firebaseLoginButton");
    await page.waitForSelector('[data-view="teams"]', { timeout: 15000 });
  }
  await page.locator('[data-view="adminEventControl"]').click();
  await page.waitForSelector("#chooseLocalScoutingFileButton");
  if (!(await page.locator("#chooseLocalScoutingFileButton").isEnabled())) {
    throw new Error(`Local scouting data Browse is disabled. Body: ${(await page.locator("body").innerText()).replace(/\\s+/g, " ").slice(0, 1200)}`);
  }

  const dataChooser = page.waitForEvent("filechooser");
  await page.locator("#chooseLocalScoutingFileButton").click();
  await (await dataChooser).setFiles(dataPath);
  await page.waitForTimeout(700);

  const schemaChooser = page.waitForEvent("filechooser");
  await page.locator("#chooseLocalScoutingSchemaFileButton").click();
  await (await schemaChooser).setFiles(schemaPath);
  await page.waitForTimeout(1000);
  await page.locator('[data-view="adminDataQuality"]').first().click();
  await page.getByRole("heading", { name: "Schema Diagnostics" }).waitFor();

  const result = await page.evaluate(async () => {
    const attachment = currentScoutingAttachment();
    const expected = {
      tbaTotalAutoPoints: "tba.autoPoints",
      tbaTotalTeleopPoints: "tba.teleopPoints",
      tbaTotalEndgamePoints: "0",
    };
    const definitions = currentPridgeResponseDefinitions().map((definition) => ({ id: definition.id, formula: definition.formula }));
    const diagnostics = currentScoutingDiagnosticsState().pridgeDiagnostics.entries.map((entry) => ({
      id: entry.id,
      formula: entry.formula,
      failures: entry.failures,
    }));
    const cachedText = attachment?.attachmentId
      ? await LocalFileAccess.readAttachmentText(`${attachment.attachmentId}:schema`)
      : "";
    const cached = cachedText ? JSON.parse(cachedText) : null;
    return {
      attachmentId: attachment?.attachmentId || "",
      sourcePath: attachment?.location?.path || "",
      schemaPath: attachment?.location?.schemaPath || "",
      importedRows: currentScoutingSubmissions().length,
      definitions,
      cachedDefinitions: cached?.schema?.pridgeResponseDefinitions || [],
      diagnostics,
      renderedDiagnostics: document.querySelector("h2")?.closest("article")?.innerText || document.body.innerText,
    };
  });

  const expected = {
    tbaTotalAutoPoints: "tba.autoPoints",
    tbaTotalTeleopPoints: "tba.teleopPoints",
    tbaTotalEndgamePoints: "0",
  };
  for (const [id, formula] of Object.entries(expected)) {
    assert(result.definitions.some((definition) => definition.id === id && definition.formula === formula), `Active definition mismatch for ${id}: ${JSON.stringify(result)}`);
    assert(result.cachedDefinitions.some((definition) => definition.id === id && definition.formula === formula), `Cached definition mismatch for ${id}: ${JSON.stringify(result)}`);
  }
  const missingFailures = result.diagnostics.flatMap((entry) => entry.failures).filter((failure) => /Missing schema definition tbaTotal/i.test(failure));
  assert(missingFailures.length === 0, `Schema Diagnostics still reports missing tbaTotal definitions: ${JSON.stringify(result)}`);
  assert(!/Missing schema definition tbaTotal/i.test(result.renderedDiagnostics), `Rendered Schema Diagnostics still reports missing tbaTotal definitions: ${JSON.stringify(result)}`);
  assert(result.importedRows > 0, `Expected imported scouting rows: ${JSON.stringify(result)}`);

  const exportedBaseline = await page.evaluate(() => {
    __scoutingAppState.picklists = [{ id: "cached-main", name: "Cached Main", teams: [686] }];
    __scoutingAppState.sortEquations = [{ id: "cached-sort", name: "Cached Sort", terms: [{ metric: "tbaTotalAutoPoints", direction: "desc" }] }];
    __scoutingAppState.activePicklist = "cached-main";
    __scoutingAppState.activeSortEquation = "cached-sort";
    registerScoutingProfile(currentEvent(), {
      ...(currentImportedProfileDefinition(currentEvent()) || {}),
      derivedEquations: [{ id: "cachedEquation", name: "cachedEquation", formula: "sum(scouting.autoFuelPct)" }],
    });
    saveState();
    return true;
  });
  assert(exportedBaseline, "Unable to seed cached schema state for baseline export.");
  const baselineDownloadPromise = page.waitForEvent("download");
  await page.locator('[data-view="adminEventControl"]').first().click();
  await page.getByRole("button", { name: "Download" }).click();
  const baselineDownload = await baselineDownloadPromise;
  const downloadedBaseline = JSON.parse(fs.readFileSync(await baselineDownload.path(), "utf8"));
  assert(downloadedBaseline.profile.derivedEquations.some((equation) => equation.name === "cachedEquation"), `Downloaded baseline omitted cached derived equations: ${JSON.stringify(downloadedBaseline)}`);
  assert(downloadedBaseline.workspace.picklists.some((picklist) => picklist.id === "cached-main"), `Downloaded baseline omitted cached picklists: ${JSON.stringify(downloadedBaseline)}`);
  assert(!("sortEquations" in downloadedBaseline.workspace), `Downloaded baseline leaked transient sort equations: ${JSON.stringify(downloadedBaseline)}`);
  assert(!("activePicklist" in downloadedBaseline.workspace), `Downloaded baseline leaked transient picklist selection: ${JSON.stringify(downloadedBaseline)}`);
  assert(downloadedBaseline.schema.pridgeResponseDefinitions.length === 3, `Downloaded baseline did not complete missing pRidge definitions: ${JSON.stringify(downloadedBaseline)}`);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.locator('[data-view="adminDataQuality"]').first().click();
  await page.getByRole("heading", { name: "Schema Diagnostics" }).waitFor();
  const afterReload = await page.evaluate(async () => {
    const attachment = currentScoutingAttachment();
    const diagnostics = currentScoutingDiagnosticsState();
    const definitions = currentPridgeResponseDefinitions().map((definition) => ({ id: definition.id, formula: definition.formula }));
    const cachedText = attachment?.attachmentId ? await LocalFileAccess.readAttachmentText(`${attachment.attachmentId}:schema`) : "";
    const cached = cachedText ? JSON.parse(cachedText) : null;
    return {
      definitions,
      cachedDefinitions: cached?.schema?.pridgeResponseDefinitions || [],
      missingFailures: diagnostics.pridgeDiagnostics.entries.flatMap((entry) => entry.failures).filter((failure) => /Missing schema definition tbaTotal/i.test(failure)),
      renderedDiagnostics: document.querySelector("h2")?.closest("article")?.innerText || document.body.innerText,
    };
  });
  assert(afterReload.missingFailures.length === 0, `Reloaded Schema Diagnostics reports missing tbaTotal definitions: ${JSON.stringify(afterReload)}`);
  assert(!/Missing schema definition tbaTotal/i.test(afterReload.renderedDiagnostics), `Reloaded rendered diagnostics reports missing tbaTotal definitions: ${JSON.stringify(afterReload)}`);
  for (const [id, formula] of Object.entries(expected)) {
    assert(afterReload.definitions.some((definition) => definition.id === id && definition.formula === formula), `Reloaded active definition mismatch for ${id}: ${JSON.stringify(afterReload)}`);
    assert(afterReload.cachedDefinitions.some((definition) => definition.id === id && definition.formula === formula), `Reloaded cached definition mismatch for ${id}: ${JSON.stringify(afterReload)}`);
  }

  await page.locator('[data-view="adminEventControl"]').first().click();
  await page.locator("#clearCurrentEventScoutingDataButton").click();
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.locator('[data-view="adminDataQuality"]').first().click();
  await page.getByRole("heading", { name: "Schema Diagnostics" }).waitFor();
  const afterClearReload = await page.evaluate(async () => {
    const attachment = currentScoutingAttachment();
    const diagnostics = currentScoutingDiagnosticsState();
    const definitions = currentPridgeResponseDefinitions().map((definition) => ({ id: definition.id, formula: definition.formula }));
    const cachedText = attachment?.attachmentId ? await LocalFileAccess.readAttachmentText(`${attachment.attachmentId}:schema`) : "";
    const cached = cachedText ? JSON.parse(cachedText) : null;
    return {
      definitions,
      cachedDefinitions: cached?.schema?.pridgeResponseDefinitions || [],
      missingFailures: diagnostics.pridgeDiagnostics.entries.flatMap((entry) => entry.failures).filter((failure) => /Missing schema definition tbaTotal/i.test(failure)),
      renderedDiagnostics: document.querySelector("h2")?.closest("article")?.innerText || document.body.innerText,
    };
  });
  assert(afterClearReload.missingFailures.length === 0, `Schema-only reload reports missing tbaTotal definitions: ${JSON.stringify(afterClearReload)}`);
  assert(!/Missing schema definition tbaTotal/i.test(afterClearReload.renderedDiagnostics), `Schema-only rendered diagnostics reports missing tbaTotal definitions: ${JSON.stringify(afterClearReload)}`);
  for (const [id, formula] of Object.entries(expected)) {
    assert(afterClearReload.definitions.some((definition) => definition.id === id && definition.formula === formula), `Schema-only active definition mismatch for ${id}: ${JSON.stringify(afterClearReload)}`);
    assert(afterClearReload.cachedDefinitions.some((definition) => definition.id === id && definition.formula === formula), `Schema-only cached definition mismatch for ${id}: ${JSON.stringify(afterClearReload)}`);
  }
  console.log(JSON.stringify({ pass: true, pageErrors, result, afterReload, afterClearReload }, null, 2));
} finally {
  await browser.close();
}
