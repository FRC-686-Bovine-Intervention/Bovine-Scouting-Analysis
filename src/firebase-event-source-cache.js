import "./firebase-config.js";
import { collection, doc, getDoc, getDocFromCache, getDocs, getDocsFromCache, serverTimestamp, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const db = globalThis.firebaseServices?.db;
const factory = globalThis.EventSourceCacheStore?.createEventSourceCacheStore;
if (!db || !factory) throw new Error("Event source caching is unavailable before Firebase initialization.");

globalThis.firebaseEventSourceCacheApi = factory({
  db,
  firestore: { collection, doc, getDoc, getDocFromCache, getDocs, getDocsFromCache, serverTimestamp, setDoc, writeBatch },
});
