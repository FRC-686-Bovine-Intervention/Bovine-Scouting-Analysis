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

runTest("createEventWorkspace builds default external sources and a default scouting attachment for sheet-backed events", () => {
  const context = loadBrowserContext(["src/event-workspace.js"]);
  const workspace = context.EventWorkspace.createEventWorkspace({
    key: "2026chcmp",
    season: 2026,
    name: "CHCMP",
    seasonLabel: "2026 Season",
    dataSources: [
      { name: "The Blue Alliance", notes: "Teams and qualification schedule are sourced from real TBA event snapshots." },
      { name: "Statbotics EPA", notes: "EPA totals and season-specific scoring breakdowns are sourced from Statbotics." },
      { name: "pRidge", notes: "pRidge is still modeled locally until we wire a dedicated source." },
    ],
    sheet: {
      url: "https://example.com/sheet",
      sampleCsvText: "header\nvalue",
      recommendedProfileId: "match-current-v2",
    },
  });

  assert.equal(workspace.eventKey, "2026chcmp");
  assert.equal(workspace.sources.tba.kind, "external");
  assert.equal(workspace.sources.statbotics.kind, "external");
  assert.equal(workspace.sources.pridge.kind, "external");
  assert.equal(workspace.sources.scouting.length, 1);
  assert.equal(workspace.sources.scouting[0].locationKind, "embedded-sample");
  assert.equal(workspace.sources.scouting[0].translatorId, "match-current-v2");
  assert.equal(context.EventWorkspace.scoutingSourceUrl(workspace), "https://example.com/sheet");
});

runTest("createEventWorkspace supports external-only events with an unconfigured scouting attachment", () => {
  const context = loadBrowserContext(["src/event-workspace.js"]);
  const workspace = context.EventWorkspace.createEventWorkspace({
    key: "2027test",
    season: 2027,
    name: "External Only Event",
    seasonLabel: "Future Game",
    dataSources: [
      { name: "The Blue Alliance", notes: "Snapshot-backed for now." },
      { name: "Statbotics EPA", notes: "EPA snapshot-backed for now." },
      { name: "pRidge", notes: "Local pRidge source." },
    ],
  });

  assert.equal(workspace.eventKey, "2027test");
  assert.equal(workspace.sources.tba.kind, "external");
  assert.equal(workspace.sources.statbotics.kind, "external");
  assert.equal(workspace.sources.pridge.kind, "external");
  assert.equal(Array.isArray(workspace.sources.scouting), true);
  assert.equal(workspace.sources.scouting.length, 1);
  assert.equal(workspace.activeScoutingAttachmentId, "scouting-2027test-default");
  assert.equal(context.EventWorkspace.activeScoutingAttachment(workspace)?.locationKind, "manual");
  assert.equal(context.EventWorkspace.activeScoutingAttachment(workspace)?.status, "stale");
  assert.equal(context.EventWorkspace.activeScoutingAttachment(workspace)?.translatorId, "canonical-json-v1");
});

runTest("createEventWorkspace preserves stored scouting attachment metadata over default event values", () => {
  const context = loadBrowserContext(["src/event-workspace.js"]);
  const workspace = context.EventWorkspace.createEventWorkspace(
    {
      key: "2025chcmp",
      season: 2025,
      name: "CHCMP 2025",
      seasonLabel: "Reefscape",
      sheet: {
        url: "https://example.com/default-sheet",
        recommendedProfileId: "match-current-v2",
      },
    },
    {
      activeScoutingAttachmentId: "custom-attachment",
      sources: {
        scouting: [
          {
            attachmentId: "custom-attachment",
            label: "Custom scouting source",
            format: "scouting-json",
            locationKind: "path",
            location: { path: "/tmp/custom.json", url: "https://example.com/custom.json" },
            translatorId: "custom-json-v1",
            status: "ready",
            freshness: "fresh",
            lastSuccessfulAt: "2026-07-11T10:00:00Z",
          },
        ],
      },
    },
  );

  assert.equal(workspace.activeScoutingAttachmentId, "custom-attachment");
  assert.equal(workspace.sources.scouting.length, 2);
  assert.equal(context.EventWorkspace.scoutingSourceUrl(workspace), "https://example.com/custom.json");
  const customAttachment = workspace.sources.scouting.find((attachment) => attachment.attachmentId === "custom-attachment");
  assert.equal(customAttachment.translatorId, "custom-json-v1");
  assert.equal(customAttachment.location.path, "/tmp/custom.json");
});

runTest("setScoutingSourceUrl updates the active scouting attachment url", () => {
  const context = loadBrowserContext(["src/event-workspace.js"]);
  const workspace = context.EventWorkspace.createEventWorkspace({
    key: "2026test",
    season: 2026,
    name: "Test Event",
    sheet: {
      url: "https://example.com/original-sheet",
      recommendedProfileId: "match-current-v2",
    },
  });

  const updatedWorkspace = context.EventWorkspace.setScoutingSourceUrl(workspace, "https://example.com/updated-sheet");

  assert.equal(context.EventWorkspace.scoutingSourceUrl(updatedWorkspace), "https://example.com/updated-sheet");
  assert.equal(
    context.EventWorkspace.activeScoutingAttachment(updatedWorkspace).location.url,
    "https://example.com/updated-sheet",
  );
  assert.equal(context.EventWorkspace.activeScoutingAttachment(updatedWorkspace).status, "stale");
});

runTest("setScoutingSourceLocation stores local file paths separately from remote urls", () => {
  const context = loadBrowserContext(["src/event-workspace.js"]);
  const workspace = context.EventWorkspace.createEventWorkspace({
    key: "2026local",
    season: 2026,
    name: "Local Event",
  }, {
    activeScoutingAttachmentId: "local-attachment",
    sources: {
      scouting: [
        {
          attachmentId: "local-attachment",
          format: "scouting-json",
          locationKind: "path",
          location: { path: "selected.json" },
        },
      ],
    },
  });

  const updatedWorkspace = context.EventWorkspace.setScoutingSourceLocation(workspace, "bound-local.json");

  assert.equal(context.EventWorkspace.activeScoutingAttachment(updatedWorkspace).locationKind, "path");
  assert.equal(context.EventWorkspace.activeScoutingAttachment(updatedWorkspace).location.path, "bound-local.json");
  assert.equal(context.EventWorkspace.activeScoutingAttachment(updatedWorkspace).location.url, "");
  assert.equal(context.EventWorkspace.activeScoutingAttachmentSourceValue(updatedWorkspace, {}), "bound-local.json");
  assert.equal(context.EventWorkspace.activeScoutingAttachment(updatedWorkspace).status, "stale");
});

runTest("setScoutingSourceLocation converts local sheet-backed attachments into loadable local CSV sources", () => {
  const context = loadBrowserContext(["src/event-workspace.js"]);
  const workspace = context.EventWorkspace.createEventWorkspace({
    key: "2026sheetlocal",
    season: 2026,
    name: "Sheet Local Event",
    sheet: {
      url: "https://docs.google.com/spreadsheets/d/default/edit#gid=0",
      recommendedProfileId: "match-current-v2",
    },
  });

  const updatedWorkspace = context.EventWorkspace.setScoutingSourceLocation(workspace, "cached-sheet.csv");
  const attachment = context.EventWorkspace.activeScoutingAttachment(updatedWorkspace);
  const load = context.EventWorkspace.describeActiveScoutingAttachmentLoad(updatedWorkspace, {});

  assert.equal(attachment.locationKind, "path");
  assert.equal(attachment.format, "legacy-sheet-csv");
  assert.equal(load.kind, "local-csv");
  assert.equal(load.canLoad, true);
});

runTest("setScoutingSourceLocation treats file URLs as URL-backed JSON sources", () => {
  const context = loadBrowserContext(["src/event-workspace.js"]);
  const workspace = context.EventWorkspace.createEventWorkspace({
    key: "2026fileurl",
    season: 2026,
    name: "File URL Event",
  });

  const updatedWorkspace = context.EventWorkspace.setScoutingSourceLocation(
    workspace,
    "file:///D:/FIRST/Scouting/Scouting-Analysis/tests/fixtures/canonical-scouting-datasets/2024mdsev.json",
  );
  const attachment = context.EventWorkspace.activeScoutingAttachment(updatedWorkspace);
  const load = context.EventWorkspace.describeActiveScoutingAttachmentLoad(updatedWorkspace, {});

  assert.equal(attachment.locationKind, "url");
  assert.equal(attachment.location.url.startsWith("file:///"), true);
  assert.equal(attachment.format, "scouting-json");
  assert.equal(load.kind, "remote-json");
  assert.equal(load.canLoad, true);
});

runTest("upsertScoutingAttachment adds a new attachment and makes it active", () => {
  const context = loadBrowserContext(["src/event-workspace.js"]);
  const eventModel = {
    key: "2026attach",
    season: 2026,
    name: "Attachment Event",
    sheet: {
      url: "https://docs.google.com/spreadsheets/d/default/edit#gid=0",
      recommendedProfileId: "match-current-v2",
    },
  };
  const workspace = context.EventWorkspace.createEventWorkspace(eventModel);
  const updatedWorkspace = context.EventWorkspace.upsertScoutingAttachment(
    workspace,
    {
      attachmentId: "json-main",
      label: "Main JSON Feed",
      format: "scouting-json",
      locationKind: "url",
      location: { url: "https://example.com/main.json" },
      translatorId: "canonical-json-v1",
      autoLoad: true,
    },
    eventModel,
  );

  assert.equal(updatedWorkspace.sources.scouting.length, 2);
  assert.equal(updatedWorkspace.activeScoutingAttachmentId, "json-main");
  assert.equal(context.EventWorkspace.activeScoutingAttachment(updatedWorkspace).format, "scouting-json");
});

runTest("setActiveScoutingAttachment switches the current attachment without mutating others", () => {
  const context = loadBrowserContext(["src/event-workspace.js"]);
  const eventModel = {
    key: "2026switch",
    season: 2026,
    name: "Switch Event",
    sheet: {
      url: "https://docs.google.com/spreadsheets/d/default/edit#gid=0",
      recommendedProfileId: "match-current-v2",
    },
  };
  const workspace = context.EventWorkspace.upsertScoutingAttachment(
    context.EventWorkspace.createEventWorkspace(eventModel),
    {
      attachmentId: "json-backup",
      label: "Backup JSON Feed",
      format: "scouting-json",
      locationKind: "url",
      location: { url: "https://example.com/backup.json" },
    },
    eventModel,
  );
  const switchedWorkspace = context.EventWorkspace.setActiveScoutingAttachment(
    workspace,
    `scouting-${eventModel.key}-default`,
  );

  assert.equal(switchedWorkspace.activeScoutingAttachmentId, `scouting-${eventModel.key}-default`);
  assert.equal(
    context.EventWorkspace.activeScoutingAttachment(switchedWorkspace).attachmentId,
    `scouting-${eventModel.key}-default`,
  );
});

runTest("setActiveScoutingAttachment changes the active source value to match the selected attachment", () => {
  const context = loadBrowserContext(["src/event-workspace.js"]);
  const eventModel = {
    key: "2026switchvalue",
    season: 2026,
    name: "Switch Value Event",
    sheet: {
      url: "https://docs.google.com/spreadsheets/d/default/edit#gid=0",
      recommendedProfileId: "match-current-v2",
    },
  };
  const workspaceWithBackup = context.EventWorkspace.upsertScoutingAttachment(
    context.EventWorkspace.createEventWorkspace(eventModel),
    {
      attachmentId: "json-backup",
      label: "Backup JSON Feed",
      format: "scouting-json",
      locationKind: "url",
      location: { url: "https://example.com/backup.json" },
    },
    eventModel,
  );

  assert.equal(
    context.EventWorkspace.activeScoutingAttachmentSourceValue(workspaceWithBackup, eventModel),
    "https://example.com/backup.json",
  );

  const switchedWorkspace = context.EventWorkspace.setActiveScoutingAttachment(
    workspaceWithBackup,
    `scouting-${eventModel.key}-default`,
  );

  assert.equal(
    context.EventWorkspace.activeScoutingAttachmentSourceValue(switchedWorkspace, eventModel),
    "https://docs.google.com/spreadsheets/d/default/edit#gid=0",
  );
});

runTest("removeScoutingAttachment drops the target attachment and rehomes the active pointer", () => {
  const context = loadBrowserContext(["src/event-workspace.js"]);
  const eventModel = {
    key: "2026remove",
    season: 2026,
    name: "Remove Event",
    sheet: {
      url: "https://docs.google.com/spreadsheets/d/default/edit#gid=0",
      recommendedProfileId: "match-current-v2",
    },
  };
  const workspace = context.EventWorkspace.upsertScoutingAttachment(
    context.EventWorkspace.createEventWorkspace(eventModel),
    {
      attachmentId: "json-remove",
      label: "JSON To Remove",
      format: "scouting-json",
      locationKind: "url",
      location: { url: "https://example.com/remove.json" },
      autoLoad: true,
    },
    eventModel,
  );
  const removedWorkspace = context.EventWorkspace.removeScoutingAttachment(workspace, "json-remove");

  assert.equal(removedWorkspace.sources.scouting.some((attachment) => attachment.attachmentId === "json-remove"), false);
  assert.equal(removedWorkspace.activeScoutingAttachmentId, `scouting-${eventModel.key}-default`);
});

runTest("active scouting attachment helpers expose sample and profile metadata", () => {
  const context = loadBrowserContext(["src/event-workspace.js"]);
  const workspace = context.EventWorkspace.createEventWorkspace({
    key: "2026sample",
    season: 2026,
    name: "Sample Event",
    sheet: {
      url: "https://example.com/sample-sheet",
      sampleCsvText: "header\nvalue",
      recommendedProfileId: "match-current-v2",
    },
  });

  assert.equal(context.EventWorkspace.activeScoutingAttachmentUsesSample(workspace), true);
  assert.equal(context.EventWorkspace.activeScoutingAttachmentSampleKey(workspace), "2026sample:sample-sheet");
  assert.equal(context.EventWorkspace.activeScoutingAttachmentProfileId(workspace), "match-current-v2");
});

runTest("resolveScoutingImportSourceUrl prefers stored state, then workspace attachment, then event defaults", () => {
  const context = loadBrowserContext(["src/event-workspace.js"]);
  const workspace = context.EventWorkspace.createEventWorkspace({
    key: "2026source",
    season: 2026,
    name: "Source Event",
    sheet: {
      url: "https://example.com/default-sheet",
      recommendedProfileId: "match-current-v2",
    },
  });

  assert.equal(
    context.EventWorkspace.resolveScoutingImportSourceUrl(workspace, { sheet: { url: "https://example.com/ignored-sheet" } }, "https://example.com/stored"),
    "https://example.com/stored",
  );
  assert.equal(
    context.EventWorkspace.resolveScoutingImportSourceUrl(workspace, { sheet: { url: "https://example.com/ignored-sheet" } }),
    "https://example.com/default-sheet",
  );
  assert.equal(
    context.EventWorkspace.resolveScoutingImportSourceUrl(null, { sheet: { url: "https://example.com/fallback-sheet" } }),
    "https://example.com/fallback-sheet",
  );
});

runTest("rebuildSampleBackedScoutingState refreshes sample-backed submissions through injected import callbacks", () => {
  const context = loadBrowserContext(["src/event-workspace.js"]);
  const eventModel = {
    key: "2026refresh",
    season: 2026,
    name: "Refresh Event",
    sheet: {
      url: "https://example.com/sample-sheet",
      sampleCsvText: "Header,Value\nA,1",
      recommendedProfileId: "match-current-v2",
    },
  };
  const workspace = context.EventWorkspace.createEventWorkspace(eventModel);
  const calls = [];

  const refreshed = context.EventWorkspace.rebuildSampleBackedScoutingState({
    workspace,
    eventModel,
    submissions: [{ id: "submission-1" }],
    activity: [{ id: "activity-1" }],
    shouldRefreshSampleBackedSubmissions: () => true,
    translateEventSheetToCanonical: (incomingEventModel, csvText) => {
      calls.push(["translate", incomingEventModel.key, csvText]);
      return {
        meta: { format: "frc-scouting-analysis/v1", season: 2026, eventKey: incomingEventModel.key, entryType: "match" },
        schema: { schemaId: "match-v2", fields: [] },
        entries: [{ matchNumber: 1, teamNumber: 1, scoutUser: "Scout", alliance: "red", station: "1", rawMetrics: {} }],
        templateProfileId: "match-current-v2",
        profileLabel: "Current Match Template",
        translatorVersion: "2026-thin-v2",
      };
    },
    previewScoutingJsonImport: ({ activeEventKey, profileId, translationVersion }) => {
      calls.push(["preview-json", activeEventKey, profileId, translationVersion]);
      return { ok: true, summary: { profileId: "match-current-v2" } };
    },
    commitScoutingImport: ({ existingActivity, replaceExisting }) => {
      calls.push(["commit", existingActivity.length, replaceExisting]);
      return {
        submissions: [{ id: "rebuilt-1", rawMetrics: { auto: 3 } }],
        activity: [{ id: "activity-2" }],
      };
    },
    stampScoutingSubmissionMetadata: (submissions, incomingEventModel, extra) =>
      submissions.map((submission) => ({ ...submission, eventKey: incomingEventModel.key, ...extra })),
  });

  assert.deepEqual(calls, [
    ["translate", "2026refresh", "Header,Value\nA,1"],
    ["preview-json", "2026refresh", "match-current-v2", "2026-thin-v2"],
    ["commit", 1, true],
  ]);
  assert.equal(refreshed.submissions.length, 1);
  assert.equal(refreshed.submissions[0].eventKey, "2026refresh");
  assert.equal(refreshed.submissions[0].scoutingImportSource, "event-sheet-sample");
  assert.deepEqual(refreshed.activity, [{ id: "activity-2" }]);
});

runTest("shouldAutoLoadScoutingAttachment requires autoLoad and a loadable source, even when submissions already exist", () => {
  const context = loadBrowserContext(["src/event-workspace.js"]);
  const eventModel = {
    key: "2026autoload",
    season: 2026,
    name: "Autoload Event",
    sheet: {
      url: "https://example.com/attached-sheet",
      recommendedProfileId: "match-current-v2",
    },
  };
  const workspace = context.EventWorkspace.createEventWorkspace(eventModel);

  assert.equal(context.EventWorkspace.shouldAutoLoadScoutingAttachment(workspace, eventModel, []), false);

  const attachedWorkspace = context.EventWorkspace.setScoutingSourceUrl(workspace, "https://docs.google.com/spreadsheets/d/attached-sheet/edit#gid=0");
  assert.equal(context.EventWorkspace.shouldAutoLoadScoutingAttachment(attachedWorkspace, eventModel, []), true);
  assert.equal(context.EventWorkspace.shouldAutoLoadScoutingAttachment(attachedWorkspace, eventModel, [{ id: "existing" }]), true);
});

runTest("attachment status helpers stamp attempt, success, and failure metadata", () => {
  const context = loadBrowserContext(["src/source-refresh.js", "src/event-workspace.js"]);
  const eventModel = {
    key: "2026status",
    season: 2026,
    name: "Status Event",
    sheet: {
      url: "https://example.com/status-sheet",
      recommendedProfileId: "match-current-v2",
    },
  };
  const workspace = context.EventWorkspace.createEventWorkspace(eventModel);
  const attempted = context.EventWorkspace.markActiveScoutingAttachmentAttempt(workspace, {
    timestamp: "2026-07-11T12:00:00Z",
  });
  const succeeded = context.EventWorkspace.markActiveScoutingAttachmentSuccess(attempted, {
    timestamp: "2026-07-11T12:01:00Z",
    schemaSignature: "schema-v1",
    translatorVersion: "2026-thin-v2",
    sourceFingerprint: "fingerprint-123",
  });
  const failed = context.EventWorkspace.markActiveScoutingAttachmentFailure(succeeded, {
    timestamp: "2026-07-11T12:02:00Z",
    error: "network down",
  });

  assert.equal(context.EventWorkspace.activeScoutingAttachment(attempted).status, "loading");
  assert.equal(context.EventWorkspace.activeScoutingAttachment(attempted).lastAttemptedAt, "2026-07-11T12:00:00Z");
  assert.equal(context.EventWorkspace.activeScoutingAttachment(succeeded).status, "ready");
  assert.equal(context.EventWorkspace.activeScoutingAttachment(succeeded).lastSuccessfulAt, "2026-07-11T12:01:00Z");
  assert.equal(context.EventWorkspace.activeScoutingAttachment(succeeded).schemaSignature, "schema-v1");
  assert.equal(context.EventWorkspace.activeScoutingAttachment(succeeded).translatorVersion, "2026-thin-v2");
  assert.equal(context.EventWorkspace.activeScoutingAttachment(succeeded).sourceFingerprint, "fingerprint-123");
  assert.equal(context.EventWorkspace.activeScoutingAttachment(succeeded).consecutiveFailures, 0);
  assert.equal(context.EventWorkspace.activeScoutingAttachment(failed).status, "error");
  assert.equal(context.EventWorkspace.activeScoutingAttachment(failed).error, "network down");
  assert.equal(context.EventWorkspace.activeScoutingAttachment(failed).consecutiveFailures, 1);
  assert.ok(context.EventWorkspace.activeScoutingAttachment(failed).nextPollAt);
});

runTest("describeActiveScoutingAttachmentLoad classifies sample, sheet, and json attachments", () => {
  const context = loadBrowserContext(["src/event-workspace.js"]);

  const sampleEvent = {
    key: "2026samplekind",
    season: 2026,
    name: "Sample Kind",
    sheet: {
      url: "https://docs.google.com/spreadsheets/d/sample/export?gid=0",
      sampleCsvText: "A,B\n1,2",
      recommendedProfileId: "match-current-v2",
    },
  };
  const sampleWorkspace = context.EventWorkspace.createEventWorkspace(sampleEvent);
  assert.equal(context.EventWorkspace.activeScoutingAttachmentFormat(sampleWorkspace, sampleEvent), "legacy-sheet-csv");
  assert.equal(context.EventWorkspace.describeActiveScoutingAttachmentLoad(sampleWorkspace, sampleEvent).kind, "embedded-sample");

  const googleSheetWorkspace = context.EventWorkspace.createEventWorkspace({
    key: "2026sheetkind",
    season: 2026,
    name: "Sheet Kind",
    sheet: {
      url: "https://docs.google.com/spreadsheets/d/abc123/edit#gid=0",
      recommendedProfileId: "match-current-v2",
    },
  });
  assert.equal(context.EventWorkspace.describeActiveScoutingAttachmentLoad(googleSheetWorkspace, { sheet: {} }).kind, "google-sheet-url");

  const jsonWorkspace = context.EventWorkspace.createEventWorkspace(
    {
      key: "2026jsonkind",
      season: 2026,
      name: "JSON Kind",
    },
    {
      activeScoutingAttachmentId: "json-attachment",
      sources: {
        scouting: [
          {
            attachmentId: "json-attachment",
            format: "scouting-json",
            locationKind: "url",
            location: { url: "https://example.com/scouting.json" },
            autoLoad: true,
          },
        ],
      },
    },
  );
  const jsonLoad = context.EventWorkspace.describeActiveScoutingAttachmentLoad(jsonWorkspace, {});
  assert.equal(jsonLoad.kind, "remote-json");
  assert.equal(jsonLoad.canLoad, true);

  const localJsonWorkspace = context.EventWorkspace.createEventWorkspace(
    {
      key: "2026localjson",
      season: 2026,
      name: "Local JSON",
    },
    {
      activeScoutingAttachmentId: "local-json-attachment",
      sources: {
        scouting: [
          {
            attachmentId: "local-json-attachment",
            format: "scouting-json",
            locationKind: "path",
            location: { path: "cached-scouting.json" },
            autoLoad: true,
          },
        ],
      },
    },
  );
  const localJsonLoad = context.EventWorkspace.describeActiveScoutingAttachmentLoad(localJsonWorkspace, {});
  assert.equal(localJsonLoad.kind, "local-json");
  assert.equal(localJsonLoad.canLoad, true);
});

runTest("external source helpers stamp refresh metadata and polling state", () => {
  const context = loadBrowserContext(["src/source-refresh.js", "src/event-workspace.js"]);
  const workspace = context.EventWorkspace.createEventWorkspace({
    key: "2026external",
    season: 2026,
    name: "External Event",
    dataSources: [
      { name: "The Blue Alliance", notes: "TBA snapshot" },
      { name: "Statbotics EPA", notes: "Statbotics snapshot" },
      { name: "pRidge", notes: "pRidge snapshot" },
    ],
  });

  const attempted = context.EventWorkspace.markExternalSourceAttempt(workspace, "tba", {
    timestamp: "2026-07-11T12:00:00Z",
  });
  const succeeded = context.EventWorkspace.markExternalSourceSuccess(attempted, "tba", {
    timestamp: "2026-07-11T12:01:00Z",
    sourceFingerprint: "snapshot-abc",
  });
  const paused = context.EventWorkspace.setExternalSourcePollingEnabled(succeeded, "tba", false);
  const failed = context.EventWorkspace.markExternalSourceFailure(paused, "tba", {
    timestamp: "2026-07-11T12:02:00Z",
    error: "snapshot unavailable",
  });

  assert.equal(attempted.sources.tba.status, "loading");
  assert.equal(succeeded.sources.tba.status, "ready");
  assert.equal(succeeded.sources.tba.lastSuccessfulAt, "2026-07-11T12:01:00Z");
  assert.equal(succeeded.sources.tba.sourceFingerprint, "snapshot-abc");
  assert.equal(paused.sources.tba.pollingEnabled, false);
  assert.equal(failed.sources.tba.status, "error");
  assert.equal(failed.sources.tba.error, "snapshot unavailable");
  assert.equal(failed.sources.tba.consecutiveFailures, 1);
});
