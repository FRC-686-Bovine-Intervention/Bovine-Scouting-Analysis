import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

function loadWorkspaceContext() {
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
  };
  context.globalThis = context;
  for (const relativePath of ["src/source-refresh.js", "src/event-workspace.js"]) {
    const sourcePath = path.resolve(relativePath);
    vm.runInNewContext(fs.readFileSync(sourcePath, "utf8"), context, { filename: sourcePath });
  }
  return context.EventWorkspace;
}

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const workspaceApi = loadWorkspaceContext();
const event = {
  key: "2026local",
  season: 2026,
  name: "Local",
  seasonLabel: "2026",
  dataSources: [],
  sheet: null,
};

runTest("unchanged external source keeps its revision", () => {
  let workspace = workspaceApi.createEventWorkspace(event);
  workspace = workspaceApi.markExternalSourceSuccess(workspace, "tba", { sourceFingerprint: "fnv1a:a:1" });
  const firstRevision = workspace.sources.tba.sourceRevision;
  workspace = workspaceApi.markExternalSourceAttempt(workspace, "tba", { timestamp: "2026-08-11T18:00:00.000Z" });
  workspace = workspaceApi.markExternalSourceSuccess(workspace, "tba", {
    sourceFingerprint: "fnv1a:a:1",
    timestamp: "2026-08-11T18:01:00.000Z",
  });
  assert.equal(workspace.sources.tba.sourceRevision, firstRevision);
});

runTest("changed external source increments only its revision", () => {
  let workspace = workspaceApi.createEventWorkspace(event);
  workspace = workspaceApi.markExternalSourceSuccess(workspace, "tba", { sourceFingerprint: "fnv1a:a:1" });
  workspace = workspaceApi.markExternalSourceSuccess(workspace, "tba", { sourceFingerprint: "fnv1a:b:1" });
  assert.equal(workspace.sources.tba.sourceRevision, 2);
  assert.equal(workspace.sources.statbotics.sourceRevision, 0);
  assert.equal(workspace.sources.pridge.sourceRevision, 0);
});

runTest("unchanged scouting source keeps its revision", () => {
  let workspace = workspaceApi.createEventWorkspace(event);
  workspace = workspaceApi.markActiveScoutingAttachmentSuccess(workspace, { sourceFingerprint: "fnv1a:a:1" });
  const firstRevision = workspace.sources.scouting[0].sourceRevision;
  workspace = workspaceApi.markActiveScoutingAttachmentSuccess(workspace, { sourceFingerprint: "fnv1a:a:1" });
  assert.equal(workspace.sources.scouting[0].sourceRevision, firstRevision);
});
