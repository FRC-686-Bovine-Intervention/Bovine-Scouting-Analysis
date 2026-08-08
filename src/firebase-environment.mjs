const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

export function isLocalDevelopmentHost(hostname) {
  return LOCAL_HOSTNAMES.has(String(hostname || "").trim().toLowerCase());
}

export function resolveFirebaseEnvironment(hostname, emulatorConfig) {
  if (!isLocalDevelopmentHost(hostname)) return { mode: "production" };
  const auth = emulatorConfig?.auth;
  const firestore = emulatorConfig?.firestore;
  if (!auth?.host || !Number.isInteger(auth.port) || auth.port < 1 || !firestore?.host || !Number.isInteger(firestore.port) || firestore.port < 1) {
    throw new Error("Firebase Emulator configuration is missing. Start the configured Auth and Firestore emulators before using localhost.");
  }
  return { mode: "emulator", auth, firestore };
}

export function assertFirebaseConfiguration(config) {
  const required = ["apiKey", "authDomain", "projectId", "appId"];
  const missing = required.filter((key) => !String(config?.[key] || "").trim());
  if (missing.length) throw new Error(`Firebase configuration is missing: ${missing.join(", ")}.`);
  return config;
}
