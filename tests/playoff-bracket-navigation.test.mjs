import assert from "node:assert/strict";
import fs from "node:fs";

const appSource = fs.readFileSync("src/app.js", "utf8");

assert.match(appSource, /const matchAttributes = match[\s\S]*?data-match=/);
assert.match(appSource, /document\.querySelectorAll\("\[data-match\]"\)/);
assert.match(appSource, /state\.activeView = "matchup";/);

console.log("PASS playoff bracket matches navigate to Matchup");
