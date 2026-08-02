import path from "node:path";
import { chromium } from "playwright";

const appUrl = "file:///D:/FIRST/Scouting/Bovine-Scouting-Analysis/index.html";
const jsonFixturePath = path.resolve("tests/fixtures/canonical-scouting-datasets/2024mdsev.json");

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

async function switchEvent(page, eventKey) {
  await page.fill("#adminEventCodeInput", eventKey);
  await page.locator("#adminEventCodeInput").press("Enter");
  await page.waitForFunction((expectedEventKey) => globalThis.__scoutingAppState?.activeEventKey === expectedEventKey, eventKey);
  await page.waitForTimeout(400);
}

async function readAttachmentState(page) {
  return page.evaluate(() => {
    const attachment = currentScoutingAttachment();
    return {
      format: attachment?.format || "",
      translatorId: attachment?.translatorId || "",
      sourcePath: attachment?.location?.path || "",
      sourceInput: document.querySelector("#importSourceUrl")?.value || "",
      warnings: globalThis.__scoutingAppState?.importResult?.warnings || [],
      importedRows: currentScoutingSubmissions().length,
    };
  });
}

async function verifyBoundJsonState(page, label) {
  const state = await readAttachmentState(page);
  assert(state.format === "scouting-json", `${label}: expected scouting-json, got ${JSON.stringify(state)}`);
  assert(state.translatorId === "canonical-json-v1", `${label}: expected canonical-json-v1, got ${JSON.stringify(state)}`);
  assert(String(state.sourcePath || state.sourceInput).toLowerCase().endsWith(".json"), `${label}: expected .json path, got ${JSON.stringify(state)}`);
  assert(state.importedRows === 421, `${label}: expected 421 imported scouting rows after browse, got ${JSON.stringify(state)}`);
}

async function runLocalFileInputScenario(browser) {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto(appUrl);
  await waitForApp(page);
  await login(page);
  await openAdmin(page);
  await switchEvent(page, "2024mdsev");
  const pickerCapabilities = await page.evaluate(() => ({
    protocol: globalThis.location?.protocol || "",
    isSecureContext: Boolean(globalThis.isSecureContext),
    supportsPersistentLocalFiles: Boolean(globalThis.LocalFileAccess?.supportsPersistentLocalFiles?.()),
  }));
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator("#chooseLocalScoutingFileButton").click(),
  ]);
  await chooser.setFiles(jsonFixturePath);
  await page.waitForFunction(() => document.querySelector("#importSourceUrl")?.value.toLowerCase().endsWith(".json") && currentScoutingSubmissions().length > 0);
  await verifyBoundJsonState(page, "local file browse");
  await page.close();
  return { pageErrors, pickerCapabilities };
}

const browser = await chromium.launch({ headless: true });
const result = {};

try {
  result.localFileInput = await runLocalFileInputScenario(browser);
} finally {
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
