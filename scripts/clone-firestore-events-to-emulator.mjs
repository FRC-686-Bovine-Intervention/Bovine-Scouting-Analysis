import fs from "node:fs";
import { Firestore } from "../functions/node_modules/@google-cloud/firestore/build/src/index.js";

const requestedArguments = process.argv.slice(2).map((value) => String(value || "").trim()).filter(Boolean);
const listOnly = requestedArguments.length === 1 && requestedArguments[0] === "--list";
const eventKeys = requestedArguments.map((value) => value.toLowerCase()).filter((value) => value !== "--list");
if (!listOnly && !eventKeys.length) throw new Error("Usage: node scripts/clone-firestore-events-to-emulator.mjs [--list | <eventKey> [eventKey ...]]");
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error("GOOGLE_APPLICATION_CREDENTIALS must point to a production service-account key outside the repository.");
}

const credential = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"));
const sourceProjectId = process.env.FIRESTORE_SOURCE_PROJECT || credential.project_id || "bovine-scouting-analysis";
const targetProjectId = process.env.FIRESTORE_TARGET_PROJECT || "bovine-scouting-analysis";
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const [host, portText] = emulatorHost.split(":");
const targetPort = Number(portText || 8080);
const subcollections = String(process.env.FIRESTORE_CLONE_SUBCOLLECTIONS || "sourceCache,profiles,workspace")
  .split(",").map((value) => value.trim()).filter(Boolean);

// FIRESTORE_EMULATOR_HOST is needed for the target client, but must not leak into
// the production source client. The Firestore library reads this environment
// variable when it constructs its client settings.
const emulatorHostEnvironment = process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIRESTORE_EMULATOR_HOST;
const source = new Firestore({ projectId: sourceProjectId });
if (emulatorHostEnvironment) process.env.FIRESTORE_EMULATOR_HOST = emulatorHostEnvironment;
const target = new Firestore({ projectId: targetProjectId, host, port: targetPort, ssl: false });

async function cloneCollection(sourceCollection, targetCollection, label) {
  const snapshot = await sourceCollection.get();
  let count = 0;
  for (const sourceDocument of snapshot.docs) {
    const targetDocument = targetCollection.doc(sourceDocument.id);
    await targetDocument.set(sourceDocument.data());
    count += 1;
    const nestedCollections = await sourceDocument.ref.listCollections();
    for (const nestedCollection of nestedCollections) {
      await cloneCollection(
        nestedCollection,
        targetDocument.collection(nestedCollection.id),
        `${label}/${sourceDocument.id}/${nestedCollection.id}`,
      );
    }
  }
  if (count) console.log(`  ${label}: copied ${count} document(s)`);
}

try {
  if (listOnly) {
    const snapshot = await source.collection("events").get();
    console.log(`Production events in project ${sourceProjectId}:`);
    snapshot.docs.map((document) => document.id).sort().forEach((eventKey) => console.log(`  ${eventKey}`));
    process.exitCode = 0;
  }
  for (const eventKey of eventKeys) {
    const sourceEvent = source.collection("events").doc(eventKey);
    const sourceSnapshot = await sourceEvent.get();
    if (!sourceSnapshot.exists) {
      const available = (await source.collection("events").get()).docs.map((document) => document.id).sort();
      throw new Error(`Production event document does not exist: events/${eventKey}. Available event keys: ${available.join(", ") || "<none>"}`);
    }
    await target.collection("events").doc(eventKey).set(sourceSnapshot.data());
    console.log(`Cloning events/${eventKey}`);
    for (const collectionName of subcollections) {
      await cloneCollection(sourceEvent.collection(collectionName), target.collection("events").doc(eventKey).collection(collectionName), `events/${eventKey}/${collectionName}`);
    }
  }
  console.log(`Copied ${eventKeys.length} event(s) to Firestore emulator at ${emulatorHost}.`);
} finally {
  await Promise.all([source.terminate(), target.terminate()]);
}
