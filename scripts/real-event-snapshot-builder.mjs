import fs from "node:fs";
import path from "node:path";

const defaultCacheDir = path.resolve("src/real-source-cache");
const defaultOutputPath = path.resolve("src/real-event-snapshots.js");

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function cachePath(cacheDir, eventKey, suffix) {
  return path.join(cacheDir, `${eventKey}-${suffix}`);
}

export function buildSnapshotEventDefinition(eventConfig, options = {}) {
  const cacheDir = options.cacheDir ? path.resolve(options.cacheDir) : defaultCacheDir;
  const sheetText = eventConfig.sheet ? readUtf8(cachePath(cacheDir, eventConfig.key, "sheet.csv")) : "";
  return {
    key: eventConfig.key,
    year: eventConfig.year,
    importProfileId: eventConfig.importProfileId || "",
    sheet: eventConfig.sheet
      ? {
          ...eventConfig.sheet,
          sampleCsvText: sheetText,
        }
      : null,
    tbaEventText: readUtf8(cachePath(cacheDir, eventConfig.key, "tba-event.json")),
    tbaTeamsText: readUtf8(cachePath(cacheDir, eventConfig.key, "tba-teams.json")),
    tbaMatchesText: readUtf8(cachePath(cacheDir, eventConfig.key, "tba-matches.json")),
    statboticsEventText: readUtf8(cachePath(cacheDir, eventConfig.key, "statbotics-event.json")),
    statboticsTeamEventsText: readUtf8(cachePath(cacheDir, eventConfig.key, "statbotics-team-events.json")),
  };
}

export function buildRealEventSnapshots(eventConfigs, options = {}) {
  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    events: eventConfigs.map((eventConfig) => buildSnapshotEventDefinition(eventConfig, options)),
  };
}

export function serializeRealEventSnapshots(snapshotData) {
  return `globalThis.realEventSnapshots = ${JSON.stringify(snapshotData)};\n`;
}

export function writeRealEventSnapshots(eventConfigs, options = {}) {
  const snapshotData = buildRealEventSnapshots(eventConfigs, options);
  const outputPath = options.outputPath ? path.resolve(options.outputPath) : defaultOutputPath;
  fs.writeFileSync(outputPath, serializeRealEventSnapshots(snapshotData), "utf8");
  return { outputPath, snapshotData };
}
