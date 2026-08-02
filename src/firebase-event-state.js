import "./firebase-config.js";
import { doc, onSnapshot, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const db = globalThis.firebaseServices?.db;
if (!db) throw new Error("Firebase Firestore is not available before event-state initialization.");

const activeEventDocument = () => doc(db, "appState", "activeEvent");

function subscribeActiveEvent(listener) {
  return onSnapshot(activeEventDocument(), (snapshot) => {
    listener(snapshot.exists() ? String(snapshot.data()?.eventKey || "").trim() : "");
  });
}

async function saveActiveEvent(eventKey) {
  const normalizedEventKey = String(eventKey || "").trim();
  if (!normalizedEventKey) throw new Error("An event key is required to save the shared active event.");
  await setDoc(activeEventDocument(), { eventKey: normalizedEventKey, updatedAt: serverTimestamp() });
}

globalThis.firebaseEventStateApi = { subscribeActiveEvent, saveActiveEvent };
