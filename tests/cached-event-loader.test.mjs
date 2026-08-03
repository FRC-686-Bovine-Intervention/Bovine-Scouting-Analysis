import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/cached-event-loader.js", import.meta.url), "utf8");
const context = { globalThis: { EventModelBuilder: { buildEventModelFromProviderBundle: (bundle) => ({ key: bundle.key, season: bundle.year, name: bundle.tbaEvent.name, teams: bundle.tbaTeams, matches: bundle.tbaMatches, catalogSource: bundle.catalogSource }) } }, TextDecoder };
vm.runInNewContext(source, context);
const sourceData = {
  "tba-event": { rawText: '{"year":2025,"name":"Championship"}', manifest: { sourceId: "tba-event", fetchedAt: "2025-01-01T00:00:00.000Z", fingerprint: "event" } },
  "tba-teams": { rawText: '[{"team_number":686}]', manifest: { sourceId: "tba-teams", fetchedAt: "2025-01-01T00:00:00.000Z", fingerprint: "teams" } },
  "tba-matches": { rawText: '[]', manifest: { sourceId: "tba-matches", fetchedAt: "2025-01-01T00:00:00.000Z", fingerprint: "matches" } },
  "tba-rankings": { rawText: '{}', manifest: { sourceId: "tba-rankings", fetchedAt: "2025-01-01T00:00:00.000Z", fingerprint: "rankings" } },
  "tba-oprs": { rawText: '{}', manifest: { sourceId: "tba-oprs", fetchedAt: "2025-01-01T00:00:00.000Z", fingerprint: "oprs" } },
  "statbotics-event": { rawText: '{}', manifest: { sourceId: "statbotics-event", fetchedAt: "2025-01-01T00:00:00.000Z", fingerprint: "statbotics" } },
  "statbotics-team-events": { rawText: '[]', manifest: { sourceId: "statbotics-team-events", fetchedAt: "2025-01-01T00:00:00.000Z", fingerprint: "team-events" } },
};
const result = await context.globalThis.CachedEventLoader.rebuildCachedEvent({ event: { key: "2025chcmp", season: 2025 }, loadSource: async (sourceId) => sourceData[sourceId], now: Date.parse("2025-01-01T00:20:00.000Z") });
assert.deepEqual(JSON.parse(JSON.stringify(result.eventModel)), { key: "2025chcmp", season: 2025, name: "Championship", teams: [{ team_number: 686 }], matches: [], catalogSource: "shared-cache" });
assert.equal(result.cacheFreshness, "stale");
assert.match(result.sourceStates.tba.notes, /stale/);
await assert.rejects(() => context.globalThis.CachedEventLoader.rebuildCachedEvent({ event: { key: "2025chcmp" }, loadSource: async (sourceId) => sourceId === "tba-matches" ? Promise.reject(new Error("offline cache miss")) : sourceData[sourceId] }), /tba-matches data is unavailable/);
console.log("PASS rebuilds an event from cached provider artifacts and reports offline cache misses without replacement data");
