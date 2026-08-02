import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

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
const appUrl = "file:///D:/FIRST/Scouting/Bovine-Scouting-Analysis/index.html";
const sourceProfilePath = path.resolve("tests/fixtures/canonical-scouting-datasets/2026chcmp_profile-v1.json");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "profile-browse-visibility-"));
const profilePath = path.join(tempDir, "2026chcmp_profile-v99.json");
fs.copyFileSync(sourceProfilePath, profilePath);

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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
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

try {
  await page.goto(appUrl);
  await waitForApp(page);
  await login(page);
  await openAdmin(page);
  await resetBenchPersistence(page);
  await switchEvent(page, "2026chcmp");

  const before = await page.evaluate(() => ({
    schemaInput: document.querySelector("#importSchemaSourceUrl")?.value || "",
    schemaPath: currentScoutingAttachment()?.location?.schemaPath || "",
  }));

  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator("#chooseLocalScoutingSchemaFileButton").click(),
  ]);
  await chooser.setFiles(profilePath);

  await page.waitForTimeout(1500);

  const after = await page.evaluate(() => {
    const diagnosticsCard = [...document.querySelectorAll(".card")]
      .find((card) => card.querySelector("h2")?.textContent?.trim() === "Schema Diagnostics");
    return {
      schemaInput: document.querySelector("#importSchemaSourceUrl")?.value || "",
      schemaPath: currentScoutingAttachment()?.location?.schemaPath || "",
      diagnosticsText: diagnosticsCard?.querySelector("p.muted")?.textContent?.trim() || "",
      importErrors: globalThis.__scoutingAppState?.importResult?.errors || [],
      sourceLabel: detectedScoutingSourceLabel(),
      sourceInput: document.querySelector("#importSourceUrl")?.value || "",
      activity: globalThis.__scoutingAppState?.activityLog?.slice(0, 5).map((entry) => entry?.message || "") || [],
    };
  });

  assert(after.schemaInput === "2026chcmp_profile-v99.json", `Expected Scouting Profile input to show selected filename. Before=${JSON.stringify(before)} After=${JSON.stringify(after)}`);
  assert(after.schemaPath === "2026chcmp_profile-v99.json", `Expected active attachment schemaPath to show selected filename. After=${JSON.stringify(after)}`);
  assert(after.diagnosticsText === "Scouting Profile Filename: 2026chcmp_profile-v99.json", `Expected diagnostics text to show current profile filename. After=${JSON.stringify(after)}`);
  assert(after.importErrors.length === 0, `Expected schema browse not to raise an import error before local scouting data is authorized. After=${JSON.stringify(after)}`);

  console.log(JSON.stringify({ before, after, pageErrors }, null, 2));
} finally {
  await browser.close();
}
