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
  if (content.length > 400000 || new TextEncoder().encode(content).length > 500000) return false;
  if (content === lastPublishedContent) return true;
  clearTimeout(pendingPublishTimer);
  pendingPublishTimer = setTimeout(async () => {
    try {
      await setDoc(publicDisplayDocument, {
        version: snapshot.version,
        eventKey: snapshot.eventKey,
        payload: content,
        publishedAt: serverTimestamp(),
      });
      lastPublishedContent = content;
    } catch (error) {
      console.warn("Unable to publish the public mobile alliance display.", error);
    }
  }, 350);
  return true;
}

function subscribeMobileAllianceSnapshot(onValue, onError = () => {}) {
  return onSnapshot(publicDisplayDocument, (documentSnapshot) => {
    if (!documentSnapshot.exists()) return onValue(null);
    try {
      const documentData = documentSnapshot.data();
      const displaySnapshot = JSON.parse(documentData.payload);
      if (documentData.version !== displaySnapshot.version || documentData.eventKey !== displaySnapshot.eventKey) return onValue(null);
      onValue(displaySnapshot);
    } catch (error) {
      console.warn("The public mobile alliance snapshot is malformed.", error);
      onValue(null);
    }
  }, onError);
}

globalThis.firebaseMobileDisplayApi = Object.freeze({ publishMobileAllianceSnapshot, subscribeMobileAllianceSnapshot });
globalThis.dispatchEvent(new Event("firebase-mobile-display-api-ready"));
