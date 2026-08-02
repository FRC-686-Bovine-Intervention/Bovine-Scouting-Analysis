import "./firebase-config.js";
import { collection, deleteDoc, doc, getDocs, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const db = globalThis.firebaseServices?.db;
if (!db) throw new Error("Firebase Firestore is not initialized.");
const eventCollection = (eventKey) => collection(db, "events", String(eventKey || "").trim().toLowerCase(), "submissions");

async function loadEventSubmissions(eventKey) {
  const snapshot = await getDocs(eventCollection(eventKey));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}
async function saveEventSubmissions(eventKey, submissions) {
  const normalized = JSON.parse(JSON.stringify(Array.isArray(submissions) ? submissions : [])).filter((entry) => entry?.id);
  const existing = await getDocs(eventCollection(eventKey));
  const wanted = new Set(normalized.map((entry) => String(entry.id)));
  const deletes = existing.docs.filter((entry) => !wanted.has(entry.id));
  for (let offset = 0; offset < normalized.length || offset < deletes.length; offset += 400) {
    const batch = writeBatch(db);
    normalized.slice(offset, offset + 400).forEach((entry) => batch.set(doc(eventCollection(eventKey), String(entry.id)), entry, { merge: true }));
    deletes.slice(offset, offset + 400).forEach((entry) => batch.delete(entry.ref));
    if (normalized.slice(offset, offset + 400).length || deletes.slice(offset, offset + 400).length) await batch.commit();
  }
  return normalized.length;
}
async function clearEventSubmissions(eventKey) {
  const snapshot = await getDocs(eventCollection(eventKey));
  for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
    const batch = writeBatch(db);
    snapshot.docs.slice(offset, offset + 400).forEach((entry) => batch.delete(entry.ref));
    await batch.commit();
  }
}
globalThis.firebaseSubmissionApi = { loadEventSubmissions, saveEventSubmissions, clearEventSubmissions };