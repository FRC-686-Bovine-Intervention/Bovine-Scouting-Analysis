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

const eventControl = sectionBetween("function renderAdminEventControl()", "function renderAdminDataQuality()");
const eventCodeHandler = sectionBetween("async function applyAdminEventCodeDraft", "async function applyScoutingSourceInputChange");
const recentEventHandler = sectionBetween("async function applyRecentAdminEventSelection", "function readCurrentScoutingAttachmentDraftFromDom");
const dataQuality = sectionBetween("function renderAdminDataQuality()", "function renderAdminUserControl()");
const userControl = sectionBetween("function renderAdminUserControl()", "function renderFlags(flags)");

assert.match(source, /view: "adminEventControl", label: "Admin Event Control"/);
assert.match(source, /view: "adminDataQuality", label: "Admin Data Quality"/);
assert.doesNotMatch(source, /view: "quality"/);
assert.doesNotMatch(source, /function renderQuality\(/);
assert.doesNotMatch(source, /quality: renderQuality/);
assert.doesNotMatch(source, /quality: "Data Quality"/);
assert.match(source, /view: "adminUserControl", label: "Admin User Control", icon: "debug"/);
assert.match(source, /if \(view === "admin"\) return "adminEventControl"/);
assert.match(source, /class="nav-divider" role="separator" aria-label="Admin pages"/);
assert.match(source, /index === items\.findIndex\(\(navItem\) => navItem\.view\.startsWith\("admin"\)\)/);
assert.match(source, /visibleNavItems\(\)\.map\(\(item, index, items\)/);
assert.match(eventControl, /Event Imports/);
assert.match(eventControl, /event-code-row/);
assert.match(eventControl, /Source Status/);
assert.match(eventControl, /Statbotics API Sources/);
assert.match(eventControl, /Primary/);
assert.match(eventControl, /Secondary/);
assert.match(eventControl, /admin-credentials-row/);
assert.doesNotMatch(eventControl, /tbaAuthKeyValidationStatus/);
assert.doesNotMatch(eventControl, /official game title refreshes automatically/);
assert.doesNotMatch(eventControl, /adminStatboticsBaseUrlInput/);
assert.doesNotMatch(eventControl, /saveStatboticsBaseUrlButton/);
assert.doesNotMatch(eventControl, /toggleAllSourcePollingButton|Pause Polling|Resume Polling/);
assert.match(eventCodeHandler, /refreshCurrentExternalSourcesImmediately/);
assert.match(recentEventHandler, /refreshCurrentExternalSourcesImmediately/);
assert.match(source, /authFailureMessage\("TBA"/);
assert.match(source, /localBuildHash/);
assert.match(source, /authFailureMessage\("FIRST API"/);
assert.match(eventControl, /Activity Log/);
assert.match(eventControl, /createSchemaBaselineButton/);
assert.match(dataQuality, /renderPridgeResponseDiagnostics/);
assert.equal((eventControl.match(/renderRawSourceCacheViewer\(\)/g) || []).length, 1);
assert.ok(eventControl.indexOf("Activity Log") < eventControl.indexOf("${renderRawSourceCacheViewer()}"));
assert.match(source, /rawSourceCacheSchemaSelect/);
assert.match(source, /scouting-schema-link/);
assert.match(source, /endsWith\(":schema"\)/);
assert.match(fs.readFileSync("src/styles.css", "utf8"), /\.raw-source-cache-viewer \.admin-form-grid[\s\S]*?align-content: start;[\s\S]*?align-items: start;/);
assert.match(eventControl, /data-view="adminDataQuality"/);
assert.match(dataQuality, /return `<div class="grid cols-2">/);
assert.match(dataQuality, /Schema Diagnostics/);
assert.match(dataQuality, /Duplicate Review/);
assert.doesNotMatch(userControl, /renderRawSourceCacheViewer\(\)/);
assert.match(userControl, /renderPerformanceDiagnostics/);
assert.match(source, /raw-source-cache-preview/);
assert.doesNotMatch(source, /Readable Preview/);
assert.match(userControl, /renderAccessManagement\(\)/);

console.log("PASS standalone data quality page is removed and admin quality review remains wired");
