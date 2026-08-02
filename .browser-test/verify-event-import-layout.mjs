import { chromium } from "playwright";

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
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

try {
  await page.goto(appUrl);
  await waitForApp(page);
  await login(page);
  await openAdmin(page);

  const metrics = await page.evaluate(() => {
    function measure(inputSelector, buttonSelector) {
      const input = document.querySelector(inputSelector);
      const button = document.querySelector(buttonSelector);
      const row = input?.closest(".admin-field-row");
      const card = input?.closest(".card");
      if (!input || !button || !row || !card) return null;
      const inputRect = input.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      return {
        inputSelector,
        buttonSelector,
        inputLeft: inputRect.left,
        inputRight: inputRect.right,
        buttonLeft: buttonRect.left,
        buttonRight: buttonRect.right,
        rowRight: rowRect.right,
        cardRight: cardRect.right,
      };
    }

    return {
      scoutingData: measure("#importSourceUrl", "#chooseLocalScoutingFileButton"),
      pageWidth: window.innerWidth,
    };
  });

  const row = metrics.scoutingData;
  assert(row, "Could not measure the Event Imports scouting data row.");
  assert(row.inputRight <= row.rowRight + 1, `Input overflowed row: ${JSON.stringify(row)}`);
  assert(row.buttonRight <= row.rowRight + 1, `Button overflowed row: ${JSON.stringify(row)}`);
  assert(row.buttonRight <= row.cardRight + 1, `Button overflowed card: ${JSON.stringify(row)}`);
  assert(row.buttonLeft > row.inputLeft, `Button was not positioned to the right of the input: ${JSON.stringify(row)}`);

  console.log(JSON.stringify(metrics, null, 2));
} finally {
  await browser.close();
}
