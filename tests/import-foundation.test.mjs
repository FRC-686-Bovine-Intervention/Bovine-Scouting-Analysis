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

runTest("commitScoutingImport can replace existing submissions for source-of-truth imports", () => {
  const context = loadBrowserContext(["src/import-foundation.js"]);
  const existingSubmissions = [{ id: "old-1", teamNumber: 686, matchNumber: 1 }];
  const preview = {
    ok: true,
    summary: {
      newRows: 2,
      duplicateGroups: 0,
      confidenceImpactTeams: 0,
      metadata: { eventKey: "2025chcmp" },
      submissions: [
        { id: "new-1", teamNumber: 686, matchNumber: 10 },
        { id: "new-2", teamNumber: 686, matchNumber: 20 },
      ],
    },
  };

  const committed = context.ImportFoundation.commitScoutingImport({
    preview,
    existingSubmissions,
    existingActivity: [],
    replaceExisting: true,
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(committed.submissions.map((submission) => submission.id))),
    ["new-1", "new-2"],
  );
});
