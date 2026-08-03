import "./firebase-config.js";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const db = globalThis.firebaseServices?.db;
const factory = globalThis.FrcSeasonMetadata?.createFrcSeasonMetadataApi;
if (!db || !factory) throw new Error("FIRST season metadata is unavailable before Firebase initialization.");

globalThis.firebaseFrcSeasonMetadataApi = factory({
  db,
  firestore: { doc, getDoc, onSnapshot, serverTimestamp, setDoc },
  fetch: globalThis.fetch.bind(globalThis),
});
