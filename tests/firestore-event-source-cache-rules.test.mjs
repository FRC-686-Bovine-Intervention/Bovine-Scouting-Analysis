import assert from "node:assert/strict";
import fs from "node:fs";

const rules = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");

assert.match(rules, /match \/events\/\{eventId\}\/sourceCache\/\{sourceId\}/);
assert.match(rules, /match \/events\/\{eventId\}\/workspace\/\{workspaceId\}/);
assert.match(rules, /workspaceId == 'state'/);
assert.match(rules, /request\.resource\.data\.eventWorkspace is map/);
assert.match(rules, /match \/events\/\{eventId\}\/sourceCache\/\{sourceId\}\/versions\/\{versionId\}/);
assert.match(rules, /match \/events\/\{eventId\}\/sourceCache\/\{sourceId\}\/versions\/\{versionId\}\/chunks\/\{chunkId\}/);
assert.match(rules, /allow create, update: if isAdmin\(\) && sourceId == request\.resource\.data\.sourceId && isValidSourcePointer\(\)/);
assert.match(rules, /chunkId\.matches\('\^\[0-9\]\{6\}\$'\) && request\.resource\.data\.index == int\(chunkId\) && isValidSourceChunk\(\)/);
assert.match(rules, /request\.resource\.data\.text\.size\(\) <= 131072/);
assert.doesNotMatch(rules, /allow write: if true/);

console.log("PASS source-cache rules restrict writes to admins and constrain cached chunks");
