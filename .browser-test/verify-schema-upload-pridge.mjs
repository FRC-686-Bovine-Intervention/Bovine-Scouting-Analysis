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
  console.log(JSON.stringify({ pass: true, pageErrors, result }, null, 2));
} finally {
  await browser.close();
}
