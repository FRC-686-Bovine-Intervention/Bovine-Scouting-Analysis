import fs from "node:fs";
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
const appUrl = "file:///D:/FIRST/Scouting/Scouting-Analysis/index.html";
const dataPath = path.resolve("tests/fixtures/canonical-scouting-datasets/2024mdsev.json");
const profilePath = path.resolve("tests/fixtures/canonical-scouting-datasets/2024mdsev_profile-v1.json");

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

async function pickLocalScoutingData(page, localPath) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator("#chooseLocalScoutingFileButton").click(),
  ]);
  await chooser.setFiles(localPath);
  await page.waitForFunction(
    () => Boolean(currentScoutingAttachment()?.location?.path) && currentScoutingSubmissions().length > 0,
  );
}

async function pickLocalScoutingProfile(page, localPath) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator("#chooseLocalScoutingSchemaFileButton").click(),
  ]);
  await chooser.setFiles(localPath);
  await page.waitForTimeout(800);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1600 } });
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
  await switchEvent(page, "2024mdsev");
  await pickLocalScoutingData(page, dataPath);
  await pickLocalScoutingProfile(page, profilePath);

  const snapshot = await page.evaluate(() => {
    const model = currentScoutingSchemaReconciliationModel();
    const removedCard = model?.removedCards?.find((entry) => entry.fieldDefinition.id === "autoSpeakerMiss") || null;
    return {
      removedCard: removedCard
        ? {
            fieldId: removedCard.fieldDefinition.id,
            currentFieldCandidates: removedCard.currentFieldCandidates.map((candidate) => candidate.id),
          }
        : null,
      hasMapButton: Boolean(document.querySelector('[data-schema-removed-map-toggle="autoSpeakerMiss"]')),
    };
  });

  assert(snapshot.removedCard, `Expected autoSpeakerMiss removed card. Got ${JSON.stringify(snapshot)}`);
  assert(snapshot.removedCard.currentFieldCandidates.includes("autoSpeakerMissed"), `Expected autoSpeakerMissed as a removed-field map candidate. Got ${JSON.stringify(snapshot)}`);
  assert(snapshot.hasMapButton, `Expected a Map button for removed autoSpeakerMiss. Got ${JSON.stringify(snapshot)}`);

  console.log(JSON.stringify({ snapshot, pageErrors }, null, 2));
} finally {
  await browser.close();
}
