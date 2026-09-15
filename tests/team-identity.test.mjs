import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/team-identity.js", import.meta.url), "utf8");
const context = { Number, String, Boolean, Object, globalThis: null };
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "src/team-identity.js" });

const identity = context.TeamIdentity;
assert.deepEqual(JSON.parse(JSON.stringify(identity.normalizeTeamIdentity("frc10988"))), {
  id: "frc10988",
  key: "frc10988",
  label: "10988",
  baseNumber: 10988,
  isSuffixed: false,
});
assert.deepEqual(JSON.parse(JSON.stringify(identity.normalizeTeamIdentity("frc10988b"))), {
  id: "frc10988B",
  key: "frc10988B",
  label: "10988B",
  baseNumber: 10988,
  isSuffixed: true,
});
assert.notEqual(identity.identityFromProviderValue("frc10988").id, identity.identityFromProviderValue("frc10988B").id);
assert.equal(identity.identityFromProviderValue(10988).id, "frc10988");
assert.equal(identity.normalizeTeamIdentity("frc10988-B"), null);
assert.equal(identity.normalizeTeamIdentity("frc0B"), null);
assert.equal(identity.normalizeTeamIdentity("frc10988B2"), null);
assert.equal(identity.normalizeTeamIdentity(null), null);
console.log("PASS team identity normalization");
