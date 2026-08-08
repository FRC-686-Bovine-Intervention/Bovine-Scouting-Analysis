import { chromium } from "./node_modules/playwright/index.mjs";

const appUrl = "http://localhost:4173/.browser-test/fixture-derived-function-help-ticket-85.html";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function verifyHoverHelp(page) {
  const menu = page.locator(".formula-function-menu");
  const button = page.locator("#formulaFunctionHelpButton");
  const popover = page.locator(".formula-function-popover");
  const bridge = await menu.evaluate((element) => {
    const style = getComputedStyle(element, "::after");
    return {
      top: style.top,
      width: style.width,
      height: style.height,
    };
  });

  await button.hover();
  await page.waitForSelector(".formula-function-popover", { state: "visible" });
  const before = await popover.evaluate((element) => ({
    scrollTop: element.scrollTop,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  assert(before.scrollHeight > before.clientHeight, "Function help should have enough content to scroll.");

  const popoverBox = await popover.boundingBox();
  assert(popoverBox, "Function help popover should have a visible bounding box.");
  await page.mouse.move(popoverBox.x + 12, popoverBox.y + 2);
  await page.waitForTimeout(150);
  const afterPointerEntry = await popover.isVisible();
  await popover.evaluate((element) => {
    element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight - 12);
  });
  const afterScroll = await popover.evaluate((element) => element.scrollTop);

  await button.focus();
  const focusVisible = await popover.isVisible();
  const focusedId = await page.evaluate(() => document.activeElement?.id);

  return {
    bridge,
    before,
    afterPointerEntry,
    afterScroll,
    focusVisible,
    focusedId,
  };
}

async function verifyClickHelp(page) {
  const helpPage = page.waitForEvent("popup");
  await page.locator("#formulaFunctionHelpButton").click();
  const help = await helpPage;
  await help.waitForLoadState("load");
  const text = await help.locator("body").textContent();
  await help.close();
  return String(text || "").includes("Built-in functions");
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));
const result = { pageErrors };

try {
  await page.goto(appUrl);
  result.hoverHelp = await verifyHoverHelp(page);
  result.clickHelp = await verifyClickHelp(page);
  console.log(JSON.stringify(result, null, 2));

  assert(result.pageErrors.length === 0, `Unexpected page errors: ${result.pageErrors.join(" | ")}`);
  assert(result.hoverHelp.bridge.height === "6px", "Hover bridge should cover the visual gap below the button.");
  assert(result.hoverHelp.afterPointerEntry, "Function help closed when the pointer entered the popover.");
  assert(result.hoverHelp.afterScroll > 0, "Function help did not remain scrollable after pointer entry.");
  assert(result.hoverHelp.focusVisible, "Function help should remain visible when the button has focus.");
  assert(result.hoverHelp.focusedId === "formulaFunctionHelpButton", "Keyboard focus should remain on the help button.");
  assert(result.clickHelp, "f(x) click should still open the full function help tab.");
} finally {
  await browser.close();
}
