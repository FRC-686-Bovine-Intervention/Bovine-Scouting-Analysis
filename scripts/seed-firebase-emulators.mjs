const projectId = "bovine-scouting-analysis";
const authBaseUrl = process.env.FIREBASE_AUTH_EMULATOR_HOST ? `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}` : "http://127.0.0.1:9099";
const firestoreBaseUrl = process.env.FIRESTORE_EMULATOR_HOST ? `http://${process.env.FIRESTORE_EMULATOR_HOST}` : "http://127.0.0.1:8080";
const email = process.env.FIREBASE_LOCAL_ADMIN_EMAIL || "admin@example.test";
const password = process.env.FIREBASE_LOCAL_ADMIN_PASSWORD || "local-admin-password";

async function jsonRequest(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(body)}`);
  return body;
}

const requestOptions = (body) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const authResponse = await jsonRequest(`${authBaseUrl}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, requestOptions({ email, password, returnSecureToken: true })).catch(async (error) => {
  if (!String(error.message).includes("EMAIL_EXISTS")) throw error;
  return jsonRequest(`${authBaseUrl}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, requestOptions({ email, password, returnSecureToken: true }));
});

function encodeValue(value) {
  if (value?.__firestoreTimestamp) return { timestampValue: value.__firestoreTimestamp };
  if (typeof value === "number") return { integerValue: String(value) };
  if (typeof value === "boolean") return { booleanValue: value };
  if (value && typeof value === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeValue(item)])) } };
  return { stringValue: String(value ?? "") };
}
const timestamp = { __firestoreTimestamp: new Date().toISOString() };
async function writeFields(path, fields) {
  await jsonRequest(`${firestoreBaseUrl}/v1/projects/${projectId}/databases/(default)/documents/${path}`, {
    method: "PATCH", headers: { authorization: "Bearer owner", "content-type": "application/json" },
    body: JSON.stringify({ fields }),
  });
}
async function writeDocument(path, values) {
  await writeFields(path, { ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, encodeValue(value)])), updatedAt: encodeValue(timestamp) });
}

function fingerprint(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16)}:${text.length}`;
}

async function writeSourceArtifact(eventKey, sourceId, payload) {
  const rawText = `${JSON.stringify(payload)}\n`;
  const sourceFingerprint = fingerprint(rawText);
  const versionId = sourceFingerprint.replace(/[^a-z0-9]/gi, "-");
  const manifest = {
    sourceId, sourceUrl: `https://local.emulator/${sourceId}`, contentType: "application/json", encoding: "text", status: 200,
    fetchedAt: new Date().toISOString(), fingerprint: sourceFingerprint, byteLength: new TextEncoder().encode(rawText).length, chunkCount: 1,
  };
  await writeFields(`events/${eventKey}/sourceCache/${sourceId}/versions/${versionId}`, {
    ...Object.fromEntries(Object.entries(manifest).map(([key, value]) => [key, encodeValue(value)])), cachedAt: encodeValue(timestamp),
  });
  await writeFields(`events/${eventKey}/sourceCache/${sourceId}/versions/${versionId}/chunks/000000`, { index: encodeValue(0), text: encodeValue(rawText) });
  await writeFields(`events/${eventKey}/sourceCache/${sourceId}`, { sourceId: encodeValue(sourceId), activeVersion: encodeValue(versionId), cachedAt: encodeValue(timestamp) });
}

await writeDocument(`users/${authResponse.localId}`, { role: "admin", email });
await writeDocument(`allowlist/${encodeURIComponent(email)}`, { role: "admin", email });
await writeDocument("events/2026local", { key: "2026local", season: 2026, name: "Local Emulator Event", seasonLabel: "2026 Local", workspace: { source: "emulator-seed" }, cachedAt: timestamp });
await writeSourceArtifact("2026local", "tba-event", { key: "2026local", year: 2026, name: "Local Emulator Event", short_name: "Local Emulator Event" });
await writeSourceArtifact("2026local", "tba-teams", [
  { key: "frc9999", team_number: 9999, nickname: "Local Team" },
  { key: "frc686", team_number: 686, nickname: "Bovine" },
  { key: "frc1719", team_number: 1719, nickname: "Bovine Partner" },
  { key: "frc346", team_number: 346, nickname: "Local Blue 1" },
  { key: "frc3939", team_number: 3939, nickname: "Local Blue 2" },
  { key: "frc9998", team_number: 9998, nickname: "Local Blue 3" },
]);
await writeSourceArtifact("2026local", "tba-matches", [{
  comp_level: "qm", match_number: 1, set_number: 1,
  alliances: { red: { team_keys: ["frc9999", "frc686", "frc1719"], score: 0 }, blue: { team_keys: ["frc346", "frc3939", "frc9998"], score: 0 } },
  winning_alliance: "",
}]);
await writeSourceArtifact("2026local", "tba-rankings", {});
await writeSourceArtifact("2026local", "tba-oprs", {});
await writeSourceArtifact("2026local", "statbotics-event", { event: "2026local", year: 2026, name: "Local Emulator Event" });
await writeSourceArtifact("2026local", "statbotics-team-events", []);
await writeDocument("appState/activeEvent", { eventKey: "2026local" });
await writeDocument("events/2026local/submissions/sample-match-1", { matchKey: "qm1", teamNumber: 9999, scoutName: "Local Scout", autoScore: 3, teleopScore: 7, notes: "Representative emulator scouting submission" });
console.log(`Seeded Firebase Emulator admin ${email}, event 2026local, and representative scouting data.`);
