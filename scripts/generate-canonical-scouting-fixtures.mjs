import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

function loadBrowserContext(relativePaths) {
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
  };
  context.globalThis = context;
  relativePaths.forEach((relativePath) => {
    const sourcePath = path.resolve(relativePath);
    const source = fs.readFileSync(sourcePath, "utf8");
    vm.runInNewContext(source, context, { filename: sourcePath });
  });
  return context;
}

const context = loadBrowserContext([
  "src/season-framework.js",
  "src/scouting-json-schema.js",
  "src/event-model-builder.js",
  "src/real-event-snapshots.js",
  "src/real-event-data.js",
  "src/sheet-import-adapters.js",
]);

const eventCatalog = context.eventCatalog || [];
const sheetImportAdapters = context.SheetImportAdapters || {};
const fixtureDirectory = path.resolve("tests/fixtures/canonical-scouting-datasets");

const fixtureSpecs = [
  {
    eventKey: "2024mdsev",
    rawSheetPath: "src/real-source-cache/2024mdsev-sheet.csv",
  },
  {
    eventKey: "2025chcmp",
    rawSheetPath: "src/real-source-cache/2025chcmp-sheet.csv",
  },
  {
    eventKey: "2026chcmp",
    rawSheetPath: "src/real-source-cache/2026chcmp-sheet.csv",
  },
];

fs.mkdirSync(fixtureDirectory, { recursive: true });

fixtureSpecs.forEach((spec) => {
  const eventModel = eventCatalog.find((event) => event.key === spec.eventKey);
  if (!eventModel) {
    throw new Error(`Unknown event ${spec.eventKey}.`);
  }
  const rawSheetCsv = fs.readFileSync(path.resolve(spec.rawSheetPath), "utf8");
  const canonicalDataset = sheetImportAdapters.translateEventSheetToCanonical(eventModel, rawSheetCsv, {
    templateProfileId: eventModel?.sheet?.recommendedProfileId || "match-current-v2",
  });
  const outputPath = path.join(fixtureDirectory, `${spec.eventKey}.json`);
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        meta: canonicalDataset.meta,
        schema: canonicalDataset.schema,
        entries: canonicalDataset.entries,
      },
      null,
      2,
    ),
  );
  console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`);
});
