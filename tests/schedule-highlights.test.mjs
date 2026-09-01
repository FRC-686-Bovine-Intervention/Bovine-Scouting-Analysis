import assert from "node:assert/strict";
import fs from "node:fs";

const appSource = fs.readFileSync("src/app.js", "utf8");
const stylesSource = fs.readFileSync("src/styles.css", "utf8");

assert.match(appSource, /highlightTeam: 686/);
assert.match(appSource, /id="scheduleHighlightTeam" type="number"/);
assert.match(appSource, /const currentMatch = matches\.find\(\(match\) => !matchHasScore\(match\)\)/);
assert.match(appSource, /const className = isCurrent[\s\S]*?schedule-highlight-team[\s\S]*?schedule-complete/);
assert.match(appSource, /state\.highlightTeam = normalizeHighlightTeam\(event\.target\.value\)/);
assert.match(stylesSource, /\.match-row\.schedule-current\s*\{[\s\S]*?background:\s*#FFFF66/);
assert.match(stylesSource, /\.match-row\.schedule-highlight-team\s*\{[\s\S]*?background:\s*var\(--accent-soft\)/);
assert.match(stylesSource, /\.match-row\.schedule-complete\s*\{[\s\S]*?background:\s*#D9D9D9/);
assert.match(stylesSource, /\[data-theme="dark"\] \.match-row\.schedule-current\s*\{[\s\S]*?background:\s*#665f00/);
assert.match(stylesSource, /\[data-theme="dark"\] \.match-row\.schedule-highlight-team\s*\{[\s\S]*?background:\s*var\(--accent-soft\)/);
assert.match(stylesSource, /\[data-theme="dark"\] \.match-row\.schedule-complete\s*\{[\s\S]*?background:\s*#46505c/);

console.log("PASS schedule highlights use current, team, and completed priority states");
