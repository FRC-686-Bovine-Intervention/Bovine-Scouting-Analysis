import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function loadBrowserContext(relativePaths, extras = {}) {
  const context = {
    globalThis: {},
    console,
    Set,
    Map,
    Math,
    Number,
    Array,
    Object,
    String,
    JSON,
    Date,
    ...extras,
  };
  context.globalThis = context;
  relativePaths.forEach((relativePath) => {
    const sourcePath = path.resolve(relativePath);
    const source = fs.readFileSync(sourcePath, "utf8");
    vm.runInNewContext(source, context, { filename: sourcePath });
  });
  return context;
}

runTest("source refresh policy computes stale freshness and next poll backoff", () => {
  const context = loadBrowserContext(["src/source-refresh.js"]);
  const policy = context.SourceRefresh.defaultPolicyForSource({ kind: "scouting", sourceId: "attachment-1" });
  const now = Date.parse("2026-07-11T12:10:00Z");
  const freshSource = {
    lastSuccessfulAt: "2026-07-11T12:08:30Z",
    lastAttemptedAt: "2026-07-11T12:08:30Z",
    consecutiveFailures: 0,
  };
  const staleSource = {
    lastSuccessfulAt: "2026-07-11T11:50:00Z",
    lastAttemptedAt: "2026-07-11T12:00:00Z",
    consecutiveFailures: 2,
  };

  assert.equal(context.SourceRefresh.freshnessForSource(freshSource, policy, now), "fresh");
  assert.equal(context.SourceRefresh.freshnessForSource(staleSource, policy, now), "stale");
  assert.equal(
    context.SourceRefresh.computeNextPollAt(staleSource, policy, now),
    "2026-07-11T12:08:00.000Z",
  );
});

runTest("source refresh policy only polls when due", () => {
  const context = loadBrowserContext(["src/source-refresh.js"]);
  const policy = context.SourceRefresh.defaultPolicyForSource({ kind: "external", sourceId: "tba" });
  assert.equal(
    context.SourceRefresh.shouldPollSource({ nextPollAt: "2026-07-11T12:00:00Z", pollingEnabled: true }, policy, Date.parse("2026-07-11T12:01:00Z")),
    true,
  );
  assert.equal(
    context.SourceRefresh.shouldPollSource({ nextPollAt: "2026-07-11T12:05:00Z", pollingEnabled: true }, policy, Date.parse("2026-07-11T12:01:00Z")),
    false,
  );
});

runTest("refresh coordinator coalesces one source and rejects superseded responses", async () => {
  const context = loadBrowserContext(["src/source-refresh.js"]);
  const coordinator = context.SourceRefresh.createRefreshCoordinator();
  const first = coordinator.begin("tba");
  const second = coordinator.begin("tba");
  assert.equal(coordinator.isCurrent(first), false);
  assert.equal(coordinator.isCurrent(second), true);
  const a = coordinator.run("statbotics", async () => "latest");
  const b = coordinator.run("statbotics", async () => "duplicate");
  assert.equal(a, b);
});

runTest("source refresh policy seeds the first external poll shortly after activation", () => {
  const context = loadBrowserContext(["src/source-refresh.js"]);
  const policy = context.SourceRefresh.defaultPolicyForSource({ kind: "external", sourceId: "tba" });
  const now = Date.parse("2026-07-11T12:00:00Z");

  assert.equal(
    context.SourceRefresh.computeInitialNextPollAt({ kind: "external", sourceId: "tba" }, policy, now),
    "2026-07-11T12:00:10.000Z",
  );
});

runTest("simulator scouting refresh polls on every five-second loop tick", () => {
  const context = loadBrowserContext(["src/source-refresh.js"], {
    __EVENT_SIMULATOR_CONFIG: { mode: "simulator-first" },
  });
  const policy = context.SourceRefresh.defaultPolicyForSource({ kind: "scouting", sourceId: "simulator" });
  assert.equal(policy.baseIntervalMs, 5 * 1000);
  assert.equal(policy.pollEveryTick, true);
  assert.equal(
    context.SourceRefresh.shouldPollSource({ nextPollAt: "2099-01-01T00:00:00Z", pollingEnabled: true }, policy),
    true,
  );
});

runTest("simulator external refresh polls on every five-second loop tick", () => {
  const context = loadBrowserContext(["src/source-refresh.js"], {
    __EVENT_SIMULATOR_CONFIG: { mode: "simulator-first" },
  });
  const policy = context.SourceRefresh.defaultPolicyForSource({ kind: "external", sourceId: "tba" });
  assert.equal(policy.baseIntervalMs, 5 * 1000);
  assert.equal(policy.pollEveryTick, true);
  assert.equal(
    context.SourceRefresh.shouldPollSource({ nextPollAt: "2099-01-01T00:00:00Z", pollingEnabled: true }, policy),
    true,
  );
});

runTest("simulator scouting policy is recognized from the event attachment id", () => {
  const context = loadBrowserContext(["src/source-refresh.js"]);
  const policy = context.SourceRefresh.defaultPolicyForSource({ kind: "scouting", sourceId: "scouting-2026evsim-default" });
  assert.equal(policy.baseIntervalMs, 5 * 1000);
  assert.equal(policy.pollEveryTick, true);
});

runTest("source refresh policy normalizes visible source statuses to ready, stale, and error", () => {
  const context = loadBrowserContext(["src/source-refresh.js"]);
  const policy = context.SourceRefresh.defaultPolicyForSource({ kind: "scouting", sourceId: "attachment-1" });
  const now = Date.parse("2026-07-11T12:10:00Z");

  assert.equal(
    context.SourceRefresh.visibleStatusForSource(
      { status: "ready", freshness: "snapshot" },
      policy,
      now,
    ),
    "ready",
  );
  assert.equal(
    context.SourceRefresh.visibleStatusForSource(
      { status: "ready", lastSuccessfulAt: "2026-07-11T11:40:00Z" },
      policy,
      now,
    ),
    "stale",
  );
  assert.equal(
    context.SourceRefresh.visibleStatusForSource(
      { status: "stale", freshness: "unknown" },
      policy,
      now,
    ),
    "stale",
  );
  assert.equal(
    context.SourceRefresh.visibleStatusForSource(
      { status: "loading", freshness: "unknown" },
      policy,
      now,
    ),
    "stale",
  );
  assert.equal(
    context.SourceRefresh.visibleStatusForSource(
      { status: "error", freshness: "stale" },
      policy,
      now,
    ),
    "error",
  );
  assert.equal(context.SourceRefresh.sourceStatusBadgeClassName("ready"), "status-ready");
  assert.equal(context.SourceRefresh.sourceStatusBadgeClassName("stale"), "status-stale");
  assert.equal(context.SourceRefresh.sourceStatusBadgeClassName("loading"), "status-stale");
  assert.equal(context.SourceRefresh.sourceStatusBadgeClassName("error"), "status-error");
});
