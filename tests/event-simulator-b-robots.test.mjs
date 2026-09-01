import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRecordedEngine } from "../eventSimulator/engine.mjs";

const engine = createRecordedEngine({
  recordingPath: path.resolve("recordings/2026azscor"),
  statePath: path.join(fs.mkdtempSync(path.join(os.tmpdir(), "event-simulator-b-robots-")), "state.json"),
});
engine.setState({ cursor: 512 });

const matches = engine.get("tba", "matches");
const duplicateMatch = matches.find((match) => match.alliances?.red?.team_keys?.includes("frc10988B") && match.alliances?.red?.team_keys?.includes("frc10988"));
assert.ok(duplicateMatch, "the completed recording includes the parent and B robot together");

assert.ok(matches.every((match) => match.alliances.red.score >= 0 && match.alliances.blue.score >= 0), "the completed recording exposes completed match results");
console.log("PASS recorded 2026azscor duplicate-base robot coverage");
