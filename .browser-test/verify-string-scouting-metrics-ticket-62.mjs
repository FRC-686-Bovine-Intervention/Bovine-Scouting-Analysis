import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "./node_modules/playwright/index.mjs";

const appUrl = "file:///D:/FIRST/Scouting/Scouting-Analysis/index.html";
const fixture = JSON.parse(fs.readFileSync(
  "D:/FIRST/Scouting/Scouting-Analysis/tests/fixtures/canonical-scouting-datasets/2026chcmp.json",
  "utf8",
));
const schema = JSON.parse(fs.readFileSync(
  "D:/FIRST/Scouting/Scouting-Analysis/tests/fixtures/canonical-scouting-datasets/2026chcmp_profile-v1.json",
  "utf8",
));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(appUrl);
  await page.waitForLoadState("load");
  await page.locator("#existingUser").selectOption("Avery");
  await page.locator("#loginButton").click();
  await page.locator('[data-view="admin"]').click();
  await page.locator("#adminEventCodeInput").fill("2026chcmp");
  await page.locator("#adminEventCodeInput").press("Enter");
  await page.waitForTimeout(500);

  await page.evaluate(({ fixturePayload, schemaPayload }) => {
    const eventModel = currentEvent();
    const preview = ScoutingJsonImport.previewScoutingJsonImport({
      jsonText: JSON.stringify(fixturePayload),
      schemaJsonText: JSON.stringify(schemaPayload),
      eventModel,
      activeEventKey: eventModel.key,
      existingSubmissions: [],
    });
    if (!preview.ok) throw new Error((preview.errors || []).join("; "));
    registerScoutingProfile(eventModel, {
      ...preview.summary.profileDefinition,
      fields: preview.summary.schemaFields,
    });
    __scoutingAppState.scoutingSubmissions = preview.summary.submissions;
  }, { fixturePayload: fixture, schemaPayload: schema });

  await page.locator('[data-view="derivedBuilder"]').click();
  await page.locator('[data-derived-preview-metric="scouting.autoPrimaryRole"]').click();
  const values = await page.locator('[data-derived-scroll="result"] .derived-grid-cell').allTextContents();
  assert.ok(values.includes("Score"), "Derived Equation Builder should render the imported string value.");
  assert.ok(!values.includes("0"), "Derived Equation Builder should not coerce the imported string value to zero.");
  console.log("PASS Derived Equation Builder renders 2026chcmp string scouting metrics");
} finally {
  await browser.close();
}
