import assert from "node:assert/strict";
import fs from "node:fs";
assert.equal(fs.existsSync("scripts/start-event-simulator.ps1"), true);
assert.match(fs.readFileSync("scripts/start-event-simulator.ps1", "utf8"), /RoutingMode/);
assert.match(fs.readFileSync("scripts/start-event-simulator.ps1", "utf8"), /health check/);
assert.equal(fs.existsSync(".browser-test/verify-event-simulator.mjs"), true);
assert.equal(fs.existsSync("docs/event-simulator-human-checklist.md"), true);
console.log("PASS event simulator launcher artifacts");
