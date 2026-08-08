import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/app.js", "utf8");

function sectionBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing ${startMarker}`);
  assert.notEqual(end, -1, `missing ${endMarker}`);
  return source.slice(start, end);
}

const quality = sectionBetween("function renderQuality()", "function renderSortBuilder()");
const eventControl = sectionBetween("function renderAdminEventControl()", "function renderAdminDataQuality()");
const dataQuality = sectionBetween("function renderAdminDataQuality()", "function renderAdminUserControl()");
const userControl = sectionBetween("function renderAdminUserControl()", "function renderFlags(flags)");

assert.match(source, /view: "adminEventControl", label: "Admin Event Control"/);
assert.match(source, /view: "adminDataQuality", label: "Admin Data Quality"/);
assert.match(source, /view: "adminUserControl", label: "Admin User Control", icon: "debug"/);
assert.match(source, /if \(view === "admin"\) return "adminEventControl"/);
assert.doesNotMatch(quality, /renderSubmissionGroup\(group\)/);
assert.match(eventControl, /Event Imports/);
assert.match(eventControl, /Source Status/);
assert.match(eventControl, /Activity Log/);
assert.match(eventControl, /data-view="adminDataQuality"/);
assert.match(dataQuality, /Schema Diagnostics/);
assert.match(dataQuality, /Duplicate Review/);
assert.match(userControl, /renderAccessManagement\(\)/);
assert.match(userControl, /renderRawSourceCacheViewer\(\)/);

console.log("PASS admin page split keeps quality review separate and exposes the three admin controls");
