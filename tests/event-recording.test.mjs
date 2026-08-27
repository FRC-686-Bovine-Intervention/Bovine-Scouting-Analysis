import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRecorder, loadRecording } from "../eventSimulator/recording.mjs";
import { createRecordedEngine } from "../eventSimulator/engine.mjs";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "event-recording-"));
const responses = new Map();
const jsonResponse = (payload, etag = "") => ({ ok: true, status: 200, headers: new Headers(etag ? { etag } : {}), json: async () => payload });
const fetchImpl = async (url, options) => {
  const isTba = url.includes("tba.example");
  const isFallback = url.includes("fallback.example");
  if (!isTba && !isFallback) throw new Error("primary Statbotics unavailable");
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
assert.equal(first.providers.statbotics.sourceUrl, "https://fallback.example/v3");
assert.equal(first.providers.statbotics.usedFallback, true);
assert.equal((await recorder.poll({ force: true })), null);

setTba([{ comp_level: "qm", match_number: 1, alliances: { red: { score: 10 }, blue: { score: 8 } } }]);
const second = await recorder.poll({ force: true });
assert.equal(second.cursor, 1);
assert.equal(second.eventTag, "qual-1");

const recording = loadRecording(path.join(temp, "2026test"));
assert.equal(recording.cursors.length, 2);
assert.equal(recording.cursors[0].providers.tba.status, "ready");

const engine = createRecordedEngine({ recordingPath: path.join(temp, "2026test"), statePath: path.join(temp, "simulator-state.json") });
assert.equal(engine.getState().eventTag, "pre-event");
assert.equal(engine.get("tba", "matches").length, 0);
engine.advance();
assert.equal(engine.getState().eventTag, "qual-1");
assert.equal(engine.get("tba", "matches").length, 1);
console.log("PASS live event recording and recorded simulator playback");
