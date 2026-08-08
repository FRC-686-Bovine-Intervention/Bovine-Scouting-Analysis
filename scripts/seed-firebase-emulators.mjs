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
async function writeDocument(path, values) {
  await jsonRequest(`${firestoreBaseUrl}/v1/projects/${projectId}/databases/(default)/documents/${path}`, {
    method: "PATCH", headers: { authorization: "Bearer owner", "content-type": "application/json" },
    body: JSON.stringify({ fields: { ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, encodeValue(value)])), updatedAt: encodeValue(timestamp) } }),
  });
}

await writeDocument(`users/${authResponse.localId}`, { role: "admin", email });
await writeDocument(`allowlist/${encodeURIComponent(email)}`, { role: "admin", email });
await writeDocument("events/2026local", { key: "2026local", season: 2026, name: "Local Emulator Event", seasonLabel: "2026 Local", workspace: { source: "emulator-seed" }, cachedAt: timestamp });
await writeDocument("appState/activeEvent", { eventKey: "2026local" });
await writeDocument("events/2026local/submissions/sample-match-1", { matchKey: "qm1", teamNumber: 9999, scoutName: "Local Scout", autoScore: 3, teleopScore: 7, notes: "Representative emulator scouting submission" });
console.log(`Seeded Firebase Emulator admin ${email}, event 2026local, and representative scouting data.`);
