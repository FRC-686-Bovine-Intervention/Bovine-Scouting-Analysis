import fs from "node:fs";
import path from "node:path";
import { loadRecording } from "./recording.mjs";

export function validateRecording(recordingPath) {
  const recording = loadRecording(path.resolve(recordingPath));
  return {
    valid: true,
    eventCode: recording.manifest.eventCode,
    cursorCount: recording.cursors.length,
    firstTag: recording.cursors[0]?.eventTag || "",
    lastTag: recording.cursors.at(-1)?.eventTag || "",
  };
}

export function inspectRecording(recordingPath) {
  const recording = loadRecording(path.resolve(recordingPath));
  return {
    ...validateRecording(recordingPath),
    cursors: recording.cursors.map((cursor) => ({
      cursor: cursor.cursor,
      recordedAt: cursor.recordedAt,
      eventTag: cursor.eventTag,
      providers: Object.fromEntries(Object.entries(cursor.providers || {}).map(([source, provider]) => [source, {
        status: provider.status,
        usedFallback: Boolean(provider.usedFallback),
        endpoints: Object.fromEntries(Object.entries(provider.endpoints || {}).map(([name, endpoint]) => [name, { status: endpoint.status, sourceUrl: endpoint.sourceUrl, usedFallback: Boolean(endpoint.usedFallback), error: endpoint.error || "" }])) ,
      }])) ,
    })),
  };
}

export function exportRecording(sourcePath, destinationPath) {
  const source = path.resolve(sourcePath);
  const destination = path.resolve(destinationPath);
  validateRecording(source);
  if (destination === source || destination.startsWith(`${source}${path.sep}`)) throw new Error("The export destination cannot be inside the recording.");
  fs.cpSync(source, destination, { recursive: true, errorOnExist: true });
  return { source, destination, ...validateRecording(destination) };
}

const [command, source, destination] = process.argv.slice(2);
if (process.argv[1]?.endsWith("recording-tools.mjs")) {
  if (command === "validate") console.log(JSON.stringify(validateRecording(source), null, 2));
  else if (command === "inspect") console.log(JSON.stringify(inspectRecording(source), null, 2));
  else if (command === "export") console.log(JSON.stringify(exportRecording(source, destination), null, 2));
  else throw new Error("Usage: recording-tools.mjs validate|inspect <recording> or export <source> <destination>");
}
