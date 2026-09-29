import "./firebase-config.js";
import { doc, onSnapshot, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const db = globalThis.firebaseServices?.db;
if (!db) throw new Error("Firebase Firestore is not available before mobile display initialization.");
const publicDisplayDocument = doc(db, "publicAllianceSelection", "current");
let lastPublishedContent = "";
let pendingPublishTimer = null;

function publishMobileAllianceSnapshot(snapshot) {
  if (globalThis.firebaseUserRole !== "admin" || !globalThis.mobileAllianceDisplay?.validateMobileAllianceSnapshot(snapshot)) return false;
  const content = JSON.stringify(snapshot);
  if (content === lastPublishedContent) return true;
  clearTimeout(pendingPublishTimer);
  pendingPublishTimer = setTimeout(async () => {
    try {
      await setDoc(publicDisplayDocument, { ...snapshot, publishedAt: serverTimestamp() });
      lastPublishedContent = content;
    } catch (error) {
      console.warn("Unable to publish the public mobile alliance display.", error);
    }
  }, 350);
  return true;
}

function subscribeMobileAllianceSnapshot(onValue, onError = () => {}) {
  return onSnapshot(publicDisplayDocument, (snapshot) => onValue(snapshot.exists() ? snapshot.data() : null), onError);
}

globalThis.firebaseMobileDisplayApi = Object.freeze({ publishMobileAllianceSnapshot, subscribeMobileAllianceSnapshot });
globalThis.dispatchEvent(new Event("firebase-mobile-display-api-ready"));
