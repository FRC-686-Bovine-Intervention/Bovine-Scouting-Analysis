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
const appUrl = "http://localhost:4173";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
});
const context = await browser.newContext();
await context.addInitScript(() => {
  localStorage.clear();
  localStorage.setItem("frc-scouting-user", "Avery");
  localStorage.setItem("frc-scouting-users", JSON.stringify(["Avery"]));
});
const page = await context.newPage();

try {
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#firebaseLoginButton");

  const login = await page.locator(".login-panel").evaluate((panel) => ({
    heading: panel.querySelector("h1")?.textContent?.trim(),
    googleButton: panel.querySelector("#firebaseLoginButton")?.textContent?.trim(),
    themeToggle: Boolean(panel.querySelector("#themeToggle")),
    legacyControls: ["#existingUser", "#loginButton", "#newUser", "#createUserButton"]
      .filter((selector) => panel.querySelector(selector)),
  }));
  assert(login.heading === "Bovine Scouting Analysis", "The login screen should show the website name.");
  assert(login.googleButton === "Sign in with Google", "The Google sign-in button is missing or mislabeled.");
  assert(login.themeToggle, "The login screen should include the theme control.");
  assert(login.legacyControls.length === 0, `Legacy user-entry controls remain: ${login.legacyControls.join(", ")}`);
  assert(await page.evaluate(() => !localStorage.getItem("frc-scouting-user") && !localStorage.getItem("frc-scouting-users")), "Legacy local-user storage was not removed during bootstrap.");

  const initialTheme = await page.locator("html").getAttribute("data-theme");
  await page.locator("#themeToggle").click();
  assert(await page.locator("html").getAttribute("data-theme") !== initialTheme, "The theme control did not switch themes.");

  await page.evaluate(() => {
    globalThis.__ticket70SignInCalls = 0;
    globalThis.firebaseAuthApi = {
      signIn: async () => {
        globalThis.__ticket70SignInCalls += 1;
        globalThis.dispatchEvent(new CustomEvent("firebase-auth-state-changed", {
          detail: { user: { email: "member@example.org" }, role: "member" },
        }));
      },
    };
  });
  await page.locator("#firebaseLoginButton").click();
  assert(await page.evaluate(() => globalThis.__ticket70SignInCalls) === 1, "The Google sign-in button did not call Firebase authentication.");
  await page.waitForSelector("#logoutButton");
  assert((await page.locator("body").innerText()).includes("member@example.org"), "Firebase authentication did not transition into the signed-in app.");
} finally {
  await browser.close();
}

console.log("PASS Login screen contains only Google authentication and theme controls.");
