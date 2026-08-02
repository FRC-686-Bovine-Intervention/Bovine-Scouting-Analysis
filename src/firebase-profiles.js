import "./firebase-config.js";
import { collection, doc, getDocs, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const db = globalThis.firebaseServices?.db;
if (!db) throw new Error("Firebase Firestore is not available before profile initialization.");

function profileCollection(eventKey) {
  const key = String(eventKey || "").trim();
  if (!key) throw new Error("An event key is required to load shared profiles.");
  return collection(db, "events", key, "profiles");
}

async function loadEventProfiles(eventKey) {
  const snapshot = await getDocs(profileCollection(eventKey));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

async function saveEventProfile(eventKey, profile) {
  const profileId = String(profile?.id || "").trim();
  if (!profileId) throw new Error("A profile id is required to save a shared profile.");
  await setDoc(doc(profileCollection(eventKey), profileId), { ...profile, id: profileId, updatedAt: serverTimestamp() }, { merge: true });
}

globalThis.firebaseProfileApi = { loadEventProfiles, saveEventProfile };
