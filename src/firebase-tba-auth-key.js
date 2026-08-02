import "./firebase-config.js";
import { doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const db = globalThis.firebaseServices?.db;
const factory = globalThis.TbaAuthKeyConfiguration?.createTbaAuthKeyConfigurationApi;
if (!db || !factory) throw new Error("TBA auth-key configuration is unavailable before Firebase initialization.");

globalThis.firebaseTbaAuthKeyApi = factory({
  db,
  firestore: { doc, getDoc, serverTimestamp, setDoc },
  fetch: globalThis.fetch.bind(globalThis),
});
