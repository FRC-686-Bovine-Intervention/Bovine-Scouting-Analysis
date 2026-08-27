import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRecorder, createRecorderService, loadRecorderConfig, loadRecording } from "../eventSimulator/recording.mjs";
import { createRecordedEngine } from "../eventSimulator/engine.mjs";
import { createServer } from "../eventSimulator/server.mjs";
import { exportRecording, inspectRecording, validateRecording } from "../eventSimulator/recording-tools.mjs";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "event-recording-"));
const responses = new Map();
let failFallbackTeamMatches = false;
const jsonResponse = (payload, etag = "") => ({ ok: true, status: 200, headers: new Headers(etag ? { etag } : {}), json: async () => payload });
const fetchImpl = async (url, options) => {
  const isTba = url.includes("tba.example");
  const isFallback = url.includes("fallback.example");
  if (!isTba && !isFallback) throw new Error("primary Statbotics unavailable");
  if (isFallback && failFallbackTeamMatches && url.includes("team_matches")) throw new Error("team matches unavailable");
  const key = url.replace(isFallback ? "https://fallback.example/v3" : isTba ? "https://tba.example/v3" : "", "");
  const prior = responses.get(`${isFallback ? "fallback" : isTba ? "tba" : "statbotics"}:${key}`) || { value: key.includes("matches") ? [] : key.includes("teams") ? [] : {} , etag: "a" };
  if (options.headers["If-None-Match"] === prior.etag) return { ok: false, status: 304, headers: new Headers({ etag: prior.etag }) };
  return jsonResponse(prior.value, prior.etag);
};
const setTba = (matches) => {
  for (const suffix of ["/event/2026test", "/event/2026test/teams", "/event/2026test/matches", "/event/2026test/alliances", "/event/2026test/rankings", "/event/2026test/oprs"]) responses.set(`tba:${suffix}`, { value: suffix.endsWith("matches") ? matches : suffix.endsWith("teams") ? [{ team_number: 1 }] : {}, etag: String(matches.length) });
};
const setStatbotics = (eventName, base = "statbotics") => {
  for (const suffix of ["/event/2026test", "/team_events/event/2026test", "/matches?event=2026test", "/team_matches?event=2026test&limit=10000"]) responses.set(`${base}:${suffix}`, { value: suffix === "/event/2026test" ? { status: eventName } : [], etag: eventName });
};
setTba([]); setStatbotics("Scheduled");
const recorder = createRecorder({ eventCode: "2026TEST", outputRoot: temp, tbaBaseUrl: "https://tba.example/v3", statboticsBaseUrl: "https://statbotics.example/v3", statboticsFallbackBaseUrl: "https://fallback.example/v3", fetchImpl, pollIntervalsMs: { tba: 0, statbotics: 0 } });
const first = await recorder.poll({ force: true });
assert.equal(first.cursor, 0);
assert.equal(first.eventTag, "pre-event");
assert.equal(first.providers.statbotics.endpoints.event.sourceUrl, "https://fallback.example/v3/event/2026test");
assert.equal(first.providers.statbotics.usedFallback, true);
assert.equal((await recorder.poll({ force: true })), null);

setTba([{ comp_level: "qm", match_number: 1, alliances: { red: { score: 10 }, blue: { score: 8 } } }]);
const second = await recorder.poll({ force: true });
assert.equal(second.cursor, 1);
assert.equal(second.eventTag, "qual-1");

responses.delete("fallback:/team_matches?event=2026test&limit=10000");
failFallbackTeamMatches = true;
setTba([{ comp_level: "qm", match_number: 1, alliances: { red: { score: 10 }, blue: { score: 8 } } }, { comp_level: "qm", match_number: 2, alliances: { red: { score: 9 }, blue: { score: 7 } } }]);
const partial = await recorder.poll({ force: true });
assert.equal(partial.cursor, 2);
assert.equal(partial.providers.statbotics.status, "partial");
assert.ok(partial.providers.statbotics.endpoints.event.payload);

const recording = loadRecording(path.join(temp, "2026test"));
assert.equal(recording.cursors.length, 3);
assert.equal(recording.cursors[0].providers.tba.status, "ready");

const engine = createRecordedEngine({ recordingPath: path.join(temp, "2026test"), statePath: path.join(temp, "simulator-state.json") });
assert.equal(engine.getState().eventTag, "pre-event");
assert.equal(engine.get("tba", "matches").length, 0);
engine.advance();
assert.equal(engine.getState().eventTag, "qual-1");
assert.equal(engine.get("tba", "matches").length, 1);

const configPath = path.join(temp, "recorder-config.json");
fs.writeFileSync(configPath, JSON.stringify({ events: ["2026test"], outputRoot: temp, tbaAuthKey: "must-not-be-read", statusPort: 8899 }));
assert.deepEqual(loadRecorderConfig(configPath), { events: ["2026test"], outputRoot: temp, tbaBaseUrl: undefined, statboticsBaseUrl: undefined, statboticsFallbackBaseUrl: undefined, pollIntervalsMs: undefined, statusPort: 8899 });
const service = createRecorderService({ events: [] });
assert.equal(service.status().running, false);
service.start();
assert.equal(service.status().running, true);
service.stop();

const server = createServer({ recordingRoot: temp });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const serverUrl = `http://127.0.0.1:${server.address().port}`;
const recordings = await (await fetch(`${serverUrl}/recordings`)).json();
assert.deepEqual(recordings.recordings[0].eventCode, "2026test");
const loadedState = await (await fetch(`${serverUrl}/control/load-recording`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventCode: "2026test" }) })).json();
assert.equal(loadedState.mode, "recording");
assert.equal(loadedState.eventTag, "pre-event");
await new Promise((resolve) => server.close(resolve));
assert.deepEqual(validateRecording(path.join(temp, "2026test")), { valid: true, eventCode: "2026test", cursorCount: 3, firstTag: "pre-event", lastTag: "qual-2" });
assert.equal(inspectRecording(path.join(temp, "2026test")).cursors.length, 3);
const exportPath = path.join(temp, "exported-2026test");
assert.equal(exportRecording(path.join(temp, "2026test"), exportPath).cursorCount, 3);
console.log("PASS live event recording and recorded simulator playback");
