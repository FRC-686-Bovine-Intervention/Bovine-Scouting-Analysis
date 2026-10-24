import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const appUrl = process.env.MOBILE_SCOUTING_APP_URL || "http://127.0.0.1:4173/mobile.html";
const playwrightCandidate = [
  path.resolve(".browser-test/node_modules/playwright/index.mjs"),
  path.resolve("node_modules/playwright/index.mjs"),
  "C:/Users/rich/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
].find((candidate) => fs.existsSync(candidate));
if (!playwrightCandidate) throw new Error("Playwright unavailable for the mobile picklist layout regression.");

const { chromium } = await import(pathToFileURL(playwrightCandidate).href);
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(executablePath) ? executablePath : undefined });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });

try {
  await page.route("**/src/firebase-mobile-display.js", (route) => route.abort());
  await page.addInitScript(() => {
    window.firebaseMobileDisplayApi = {
      subscribeMobileAllianceSnapshot(callback) {
        window.__publishMobileAllianceTestSnapshot = callback;
        return () => {};
      },
    };
  });
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.__publishMobileAllianceTestSnapshot === "function");
  await page.click('[data-mobile-tab="picklists"]');

  const deliver = (columns) => page.evaluate((nextColumns) => {
    const snapshot = window.mobileAllianceDisplay.buildMobileAllianceSnapshot({
      eventKey: "2026chcmp",
      columns: nextColumns,
    });
    window.__publishMobileAllianceTestSnapshot(snapshot);
  }, columns);

  const columnsForCount = (count) => Array.from({ length: count }, (_, index) => ({
    id: `metric:metric-${index + 1}`,
    label: `Metric ${index + 1}`,
    teams: [{ teamNumber: String(686 + index), score: index === 0 ? 0 : 100 - index }],
  }));
  await deliver(columnsForCount(4));

  const fourColumnState = await page.evaluate(() => {
    const list = document.querySelector("#mobile-picklists");
    const cards = [...list.querySelectorAll(":scope > .mobile-card")];
    return {
      labels: cards.map((card) => card.querySelector("h2")?.textContent),
      firstScore: cards[0]?.querySelector(".team-score")?.textContent,
      firstColumnWidth: cards[0]?.getBoundingClientRect().width,
      clientWidth: list.clientWidth,
      scrollWidth: list.scrollWidth,
      gridAutoFlow: getComputedStyle(list).gridAutoFlow,
      overflowX: getComputedStyle(list).overflowX,
      visible: !document.querySelector("#picklists-view").hidden,
      hasInputsOrActions: Boolean(list.querySelector("input, button, a")),
    };
  });
  if (process.env.MOBILE_PICKLIST_LAYOUT_SCREENSHOT) {
    await page.screenshot({ path: process.env.MOBILE_PICKLIST_LAYOUT_SCREENSHOT, fullPage: true });
  }

  assert.deepEqual(fourColumnState.labels, ["Metric 1", "Metric 2", "Metric 3", "Metric 4"], "all four selected columns stay in source order");
  assert.equal(fourColumnState.firstScore, "0", "a real zero metric value remains visible");
  assert.ok(fourColumnState.firstColumnWidth >= 160, `mobile column remains readable (got ${fourColumnState.firstColumnWidth}px)`);
  assert.equal(fourColumnState.gridAutoFlow, "column", "selected sources flow side by side");
  assert.equal(fourColumnState.overflowX, "auto", "additional columns can be reached horizontally");
  assert.ok(fourColumnState.scrollWidth > fourColumnState.clientWidth, "four columns remain available beyond the phone viewport");
  assert.equal(fourColumnState.visible, true, "the public Picklists tab displays the columns");
  assert.equal(fourColumnState.hasInputsOrActions, false, "the public mobile display remains read-only");

  for (const count of [1, 2, 3]) {
    await deliver(columnsForCount(count));
    const state = await page.evaluate(() => {
      const list = document.querySelector("#mobile-picklists");
      const cards = [...list.querySelectorAll(":scope > .mobile-card")];
      return {
        labels: cards.map((card) => card.querySelector("h2")?.textContent),
        cardWidth: cards[0]?.getBoundingClientRect().width,
        clientWidth: list.clientWidth,
        scrollWidth: list.scrollWidth,
      };
    });
    assert.equal(state.labels.length, count, `${count} selected source${count === 1 ? "" : "s"} all render`);
    assert.deepEqual(state.labels, columnsForCount(count).map(({ label }) => label), "source order stays stable as selected column count changes");
    assert.ok(state.cardWidth >= 160, `${count} source layout keeps its cards readable (got ${state.cardWidth}px)`);
    assert.equal(state.scrollWidth > state.clientWidth, count > 2, `${count} sources ${count > 2 ? "scroll when needed" : "fit without forced scrolling"}`);
  }

  await deliver([]);
  const emptyState = await page.evaluate(() => ({
    className: document.querySelector("#mobile-picklists").className,
    message: document.querySelector("#mobile-picklists .empty-state")?.textContent,
    messageWidth: document.querySelector("#mobile-picklists .empty-state")?.getBoundingClientRect().width,
    clientWidth: document.querySelector("#mobile-picklists").clientWidth,
  }));
  assert.match(emptyState.message || "", /No picklists or ranking sources/);
  assert.ok(emptyState.messageWidth >= emptyState.clientWidth - 2, "zero selected columns keep the empty message full-width");

  console.log(`PASS mobile picklist layout at 390px: 0–4 ordered columns, zero score visible, ${Math.round(fourColumnState.firstColumnWidth)}px card, horizontal scroll when needed, empty state, read-only`);
} finally {
  await browser.close();
}
