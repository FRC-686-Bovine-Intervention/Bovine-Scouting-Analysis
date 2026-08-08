  // Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
// import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-analytics.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

import {
  getAuth,
  GoogleAuthProvider,
  connectAuthEmulator,
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { connectFirestoreEmulator, getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { assertFirebaseConfiguration, resolveFirebaseEnvironment } from "./firebase-environment.mjs";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCrxYdFP2qql_n_1JjhyuZNcmQVvmtVlB4",
  authDomain: "bovine-scouting-analysis.firebaseapp.com",
  projectId: "bovine-scouting-analysis",
  storageBucket: "bovine-scouting-analysis.firebasestorage.app",
  messagingSenderId: "783362486999",
  appId: "1:783362486999:web:21255d3d7df0485a793692",
//  measurementId: "G-LBBNVNKM1X"
};

// Initialize Firebase
assertFirebaseConfiguration(firebaseConfig);
const firebaseEnvironment = resolveFirebaseEnvironment(globalThis.location?.hostname, { auth: { host: "127.0.0.1", port: 9099 }, firestore: { host: "127.0.0.1", port: 8080 } });
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
let db;
let persistenceStatus;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  persistenceStatus = { enabled: true, message: "Shared event data remains in this browser for offline reopening. Use only a trusted device; signing out does not clear this browser cache." };
} catch (error) {
  db = getFirestore(app);
  persistenceStatus = { enabled: false, message: "Persistent offline event cache is unavailable in this browser." };
  console.warn("Firestore persistent cache is unavailable; using memory-only cache.", error);
}

const auth = getAuth(app);
if (firebaseEnvironment.mode === "emulator") {
  connectAuthEmulator(auth, `http://${firebaseEnvironment.auth.host}:${firebaseEnvironment.auth.port}`, { disableWarnings: true });
  connectFirestoreEmulator(db, firebaseEnvironment.firestore.host, firebaseEnvironment.firestore.port);
}

globalThis.firebaseServices = {
  app,
  auth,
  db,
  googleProvider: new GoogleAuthProvider(),
  environment: firebaseEnvironment,
  persistenceStatus,
};
