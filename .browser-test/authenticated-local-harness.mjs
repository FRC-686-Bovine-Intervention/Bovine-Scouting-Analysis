import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectId = process.env.FIREBASE_PROJECT_ID || "bovine-scouting-analysis";
const appUrl = process.env.SCOUTING_APP_URL || "http://localhost:4173/index.html";
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const email = process.env.FIREBASE_LOCAL_ADMIN_EMAIL || "admin@example.test";
const password = process.env.FIREBASE_LOCAL_ADMIN_PASSWORD || "local-admin-password";
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || "C:/Users/rich/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe";

class HarnessError extends Error {
  constructor(code, message) {
    super(`[${code}] ${message}`);
    this.name = "AuthenticatedLocalHarnessError";
    this.code = code;
  }
}

function endpoint(host, pathName) {
  return `http://${host}${pathName}`;
}

async function requireService(name, url, remedy) {
  try {
    await fetch(url);
  } catch (error) {
    throw new HarnessError("EMULATOR_UNAVAILABLE", `${name} is not reachable at ${url} (${error.message}). ${remedy}`);
  }
}

async function loadPlaywright() {
  const candidates = [
    path.resolve(".browser-test/node_modules/playwright/index.mjs"),
    path.resolve("node_modules/playwright/index.mjs"),
    "C:/Users/rich/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
  ];
  const candidate = candidates.find((entry) => fs.existsSync(entry));
  if (!candidate) throw new HarnessError("PLAYWRIGHT_UNAVAILABLE", `Playwright was not found. Install the .browser-test dependencies before running this harness: ${candidates.join(", ")}`);
  return import(pathToFileURL(candidate).href);
}

function bodyText(page) {
  return page.locator("body").innerText().catch(() => "");
}

async function waitForSelector(page, selector, failure) {
  try {
    await page.waitForSelector(selector, { state: "visible", timeout: 10000 });
  } catch {
    throw new HarnessError(failure.code, `${failure.message} Body: ${(await bodyText(page)).replace(/\s+/g, " ").slice(0, 500)}`);
  }
}

function assertAuthorization(condition, message) {
  if (!condition) throw new HarnessError("AUTHORIZATION_FAILED", message);
}

await requireService(
  "Firebase Auth emulator",
  endpoint(authHost, `/emulator/v1/projects/${projectId}/config`),
  "Run .\\scripts\\start-localhost.ps1, or start `firebase emulators:start --only auth,firestore` and seed with `node scripts/seed-firebase-emulators.mjs`.",
);
await requireService(
  "Firestore emulator",
  endpoint(firestoreHost, "/"),
  "Run .\\scripts\\start-localhost.ps1, or start `firebase emulators:start --only auth,firestore` and seed with `node scripts/seed-firebase-emulators.mjs`.",
);

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(executablePath) ? executablePath : undefined });
const context = await browser.newContext();
await context.addInitScript(() => localStorage.clear());
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));

try {
  try {
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  } catch (error) {
    throw new HarnessError("APP_UNAVAILABLE", `The local app could not be loaded at ${appUrl}: ${error.message}. Start .\\scripts\\start-localhost.ps1 first.`);
  }

  await waitForSelector(page, "#firebaseLoginButton", {
    code: "AUTHENTICATION_UNAVAILABLE",
    message: "The Firebase login controls did not render. Check the browser console for Firebase module/configuration errors.",
  });
  await page.fill("#firebaseEmailInput", email);
  await page.fill("#firebasePasswordInput", password);
  await page.click("#firebaseLoginButton");

  try {
    await page.waitForSelector(".app-shell", { state: "visible", timeout: 15000 });
  } catch {
    const status = await page.locator("#firebaseAuthStatus").textContent().catch(() => "");
    throw new HarnessError("AUTHENTICATION_FAILED", `Firebase emulator sign-in failed for ${email}. ${status?.trim() || "Check that the seeded email/password match FIREBASE_LOCAL_ADMIN_EMAIL and FIREBASE_LOCAL_ADMIN_PASSWORD."}`);
  }

  await waitForSelector(page, '[data-view="teams"]', {
    code: "MAIN_PAGE_UNAVAILABLE",
    message: "Authentication succeeded, but the main Teams page did not render.",
  });
  assertAuthorization(await page.locator('[data-view="admin"]').count() > 0, "Authentication succeeded, but Admin navigation is missing. Confirm the seeded users/<uid> or allowlist/<email> document has role=admin.");
  await page.click('[data-view="admin"]');
  await waitForSelector(page, "#adminEventCodeInput", {
    code: "ADMIN_PAGE_UNAVAILABLE",
    message: "Admin navigation was present, but the Admin page did not render its admin-only event control. Confirm the signed-in user has role=admin.",
  });
  const adminPageReached = await page.locator("#adminEventCodeInput").count() > 0;

  assertAuthorization(await page.locator('[data-view="derivedBuilder"]').count() > 0, "Admin access was authenticated, but Derived Equation Builder navigation is missing. Confirm the seeded admin role was loaded from Firestore.");
  await page.click('[data-view="derivedBuilder"]');
  await waitForSelector(page, "#derivedEquationFormulaInput", {
    code: "DERIVED_BUILDER_UNAVAILABLE",
    message: "Derived Equation Builder navigation was present, but its real page did not render.",
  });

  if (pageErrors.length) throw new HarnessError("PAGE_ERROR", `The authenticated app emitted browser errors: ${pageErrors.join(" | ")}`);
  console.log(JSON.stringify({
    pass: true,
    appUrl,
    email,
    pages: ["main", "admin", "derivedBuilder"],
    adminPageReached,
  }, null, 2));
} finally {
  await browser.close();
}
