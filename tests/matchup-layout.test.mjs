import assert from "node:assert/strict";
import fs from "node:fs";

const styles = fs.readFileSync("src/styles.css", "utf8");

assert.match(styles, /\.matchup-alliances\s*\{[\s\S]*?align-items:\s*stretch;/);
assert.match(styles, /\.matchup-alliance-card\s*\{[\s\S]*?display:\s*flex;/);
assert.match(styles, /\.matchup-team-row\s*\{[\s\S]*?flex:\s*1;/);
assert.match(styles, /\.matchup-match-number\s*\{[\s\S]*?align-self:\s*center;/);

console.log("PASS matchup alliance team rows share the tallest alliance height");
