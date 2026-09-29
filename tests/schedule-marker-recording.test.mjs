import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const cursorPath = (cursor) => new URL(`../recordings/2026vaale1/cursors/${String(cursor).padStart(6, "0")}.json`, import.meta.url);
const appSource = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const builderSource = fs.readFileSync(new URL("../src/event-model-builder.js", import.meta.url), "utf8");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`unterminated function ${name}`);
}

let currentModel = { matches: [] };
const appContext = {
  state: { highlightTeam: 0 },
  currentMatches() { return currentModel.matches; },
  matchIdentity(match) { return String(match?.id || `${match?.compLevel || "qm"}-${match?.setNumber || 0}-${match?.number || 0}`); },
  matchupMatchLabel(match) {
    const level = String(match?.compLevel || "qm").toLowerCase();
    const number = Number(match?.number);
    const set = Number(match?.setNumber);
    if (level === "sf") return `Semis ${set}-${number}`;
    if (level === "f") return `Finals ${set}-${number}`;
    return `Qual ${number}`;
  },
  normalizeText(value) { return String(value || "").trim(); },
  escapeAttribute(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;"); },
  escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;"); },
  Array, Number, String, Math, Set, Object,
};
appContext.globalThis = appContext;
vm.createContext(appContext);
vm.runInContext([
  "scheduleMatchGroup", "normalizeHighlightTeam", "matchHasScore", "scheduleMatchOrder",
  "compareScheduleMatchOrder", "nextScheduleMatch", "scheduleRow", "scheduleAllianceSlots",
  "scheduleTeamSlot", "renderScheduleSection", "renderSchedule", "matchupMatchLabel",
].map((name) => extractFunction(appSource, name)).join("\n"), appContext);

const builderContext = {
  ScoutingSchemaRuntime: { buildMetricCatalog: () => [] },
  PriorRidge: {},
  MetricEngine: {},
  TeamIdentity: {
    identityFromProviderValue(value) {
      const match = String(value || "").replace(/^frc/i, "").match(/^(\d+)([A-Za-z]+)?$/);
      if (!match) return null;
      const suffix = (match[2] || "").toUpperCase();
      return { id: `frc${match[1]}${suffix}`, key: `frc${match[1]}${suffix}`, label: `${match[1]}${suffix}`, baseNumber: Number(match[1]), isSuffixed: Boolean(suffix) };
    },
  },
};
builderContext.globalThis = builderContext;
vm.runInNewContext(builderSource, builderContext, { filename: "src/event-model-builder.js" });

function eventAt(cursor) {
  const recording = JSON.parse(fs.readFileSync(cursorPath(cursor), "utf8"));
  const tba = recording.providers.tba.endpoints;
  const statbotics = recording.providers.statbotics.endpoints;
  return builderContext.EventModelBuilder.buildEventModelFromProviderBundle({
    key: "2026vaale1",
    year: 2026,
    tbaEvent: tba.event.payload,
    tbaTeams: tba.teams.payload,
    tbaMatches: tba.matches.payload,
    tbaAlliances: tba.alliances.payload,
    tbaRankings: tba.rankings.payload,
    tbaTeamStats: tba.oprs.payload,
    statboticsEvent: statbotics.event?.payload || {},
    statboticsTeamEvents: statbotics.teamEvents?.payload || [],
    statboticsTeamMatches: statbotics.matches?.payload || [],
    deferPridgeComputation: true,
  });
}

function markerAt(cursor) {
  currentModel = eventAt(cursor);
  const html = appContext.renderSchedule();
  return [...html.matchAll(/data-match-row="([^"]+)"[^>]*data-schedule-last-played="true"/g)].map((match) => match[1]);
}

const at374 = eventAt(374);
assert.equal(at374.matches.filter((match) => match.compLevel === "qm").length, 38);
assert.equal(at374.matches.filter((match) => match.compLevel === "qm" && match.hasScore).length, 35);
assert.deepEqual(markerAt(374), ["2026vaale1_sf1m1"], "when playoffs exist, the visible current marker should start at Semis 1-1");
assert.deepEqual(markerAt(426), ["2026vaale1_sf2m1"], "after Semis 1-1 is scored, the marker should advance to Semis 2-1");
assert.deepEqual(markerAt(745), ["2026vaale1_f1m2"], "after Finals 1-1 is scored, the marker should advance to Finals 1-2");

const qualsOnly = eventAt(373);
assert.equal(qualsOnly.matches.some((match) => match.compLevel !== "qm"), false);
currentModel = qualsOnly;
assert.deepEqual(markerAt(373), ["2026vaale1_qm36"], "with only qualifications, keep the current marker on the next qualification");

console.log("PASS schedule marker follows the active playoff section and preserves qualification-only behavior");
