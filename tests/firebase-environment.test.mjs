import assert from "node:assert/strict";
import test from "node:test";
import { assertFirebaseConfiguration, isLocalDevelopmentHost, resolveFirebaseEnvironment } from "../src/firebase-environment.mjs";

const emulatorConfig = { auth: { host: "127.0.0.1", port: 9099 }, firestore: { host: "127.0.0.1", port: 8080 } };
test("loopback hosts select the Firebase emulators", () => {
  assert.equal(isLocalDevelopmentHost("localhost"), true);
  assert.deepEqual(resolveFirebaseEnvironment("127.0.0.1", emulatorConfig), { mode: "emulator", ...emulatorConfig });
});
test("production hosts cannot select emulator mode", () => assert.deepEqual(resolveFirebaseEnvironment("bovine-scouting-analysis.web.app", emulatorConfig), { mode: "production" }));
test("localhost fails closed when emulator configuration is missing", () => {
  assert.throws(() => resolveFirebaseEnvironment("localhost", undefined), /Emulator configuration is missing/);
  assert.throws(() => resolveFirebaseEnvironment("localhost", { auth: emulatorConfig.auth }), /Emulator configuration is missing/);
});
test("Firebase configuration fails closed when required fields are missing", () => assert.throws(() => assertFirebaseConfiguration({ projectId: "project" }), /apiKey, authDomain, appId/));
