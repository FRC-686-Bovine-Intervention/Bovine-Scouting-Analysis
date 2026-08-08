import "./firebase-config.js";
import { doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const db = globalThis.firebaseServices?.db;
if (!db) throw new Error("Firebase Firestore is not available before workspace initialization.");

function workspaceDocument(eventKey) {
  const key = String(eventKey || "").trim().toLowerCase();
  if (!key) throw new Error("An event key is required to load shared workspace state.");
  return doc(db, "events", key, "workspace", "state");
}

async function loadEventWorkspaceState(eventKey) {
  const snapshot = await getDoc(workspaceDocument(eventKey));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function saveEventWorkspaceState(eventKey, state = {}) {
  await setDoc(workspaceDocument(eventKey), {
    version: 1,
    eventKey: String(eventKey || "").trim().toLowerCase(),
    eventWorkspace: state.eventWorkspace || {},
    picklists: Array.isArray(state.picklists) ? state.picklists : [],
    sortEquations: Array.isArray(state.sortEquations) ? state.sortEquations : [],
    activePicklist: String(state.activePicklist || ""),
    activeSortEquation: String(state.activeSortEquation || ""),
    updatedAt: serverTimestamp(),
  });
}

globalThis.firebaseWorkspaceApi = { loadEventWorkspaceState, saveEventWorkspaceState };
