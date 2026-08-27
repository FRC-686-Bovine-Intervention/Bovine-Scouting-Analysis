import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

function load(config) {
  const context = { globalThis: {}, ...config };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.resolve("src/provider-routing.js"), "utf8"), context);
  return context.ProviderRouting;
}

const production = load({});
assert.deepEqual(JSON.parse(JSON.stringify(production.resolveProviderRouting({}))), {
  mode: "production",
  tbaBaseUrl: "https://www.thebluealliance.com/api/v3",
  statboticsBaseUrl: "https://api.statbotics.io/v3",
  tbaFallbackBaseUrl: "",
  statboticsFallbackBaseUrl: "",
  scoutingUrl: "",
});

const simulator = load({ __EVENT_SIMULATOR_CONFIG: { mode: "simulator-first", tbaUrl: "http://127.0.0.1:8787/api/tba", statboticsUrl: "http://127.0.0.1:8787/api/statbotics", scoutingUrl: "http://127.0.0.1:8787/api/scouting/2026evsim" } });
assert.equal(simulator.resolveProviderRouting({}).mode, "simulator-first");
assert.equal(simulator.resolveProviderRouting({}).tbaBaseUrl, "http://127.0.0.1:8787/api/tba");
assert.equal(simulator.resolveProviderRouting({}).statboticsBaseUrl, "http://127.0.0.1:8787/api/statbotics");
assert.equal(simulator.resolveProviderRouting({}).scoutingUrl, "http://127.0.0.1:8787/api/scouting/2026evsim");

const fallback = load({ __EVENT_SIMULATOR_CONFIG: { mode: "fallback", tbaUrl: "http://sim/tba", statboticsUrl: "http://sim/stat" } });
assert.deepEqual(JSON.parse(JSON.stringify(fallback.resolveProviderRouting({}))), {
  mode: "fallback",
  tbaBaseUrl: "https://www.thebluealliance.com/api/v3",
  statboticsBaseUrl: "https://api.statbotics.io/v3",
  tbaFallbackBaseUrl: "http://sim/tba",
  statboticsFallbackBaseUrl: "http://sim/stat",
  scoutingUrl: "",
});
assert.equal(fallback.resolveProviderRouting({ providerRoutingMode: "production" }).mode, "production");
console.log("PASS provider routing");
