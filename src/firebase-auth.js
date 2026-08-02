import "./firebase-config.js";
import { onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const services = globalThis.firebaseServices;
if (!services?.auth || !services?.googleProvider) throw new Error("Firebase services are not available before Firebase Auth initialization.");
const { auth, googleProvider } = services;

globalThis.firebaseAuthApi = {
  signIn: () => signInWithPopup(auth, googleProvider),
  signOut: () => signOut(auth),
  getCurrentUser: () => auth.currentUser,
};

onAuthStateChanged(auth, async (user) => {
  globalThis.firebaseCurrentUser = user || null;
  let role = "member";
  if (user && globalThis.firebaseServices?.db) {
    try {
      const userSnapshot = await getDoc(doc(globalThis.firebaseServices.db, "users", user.uid));
      if (userSnapshot.exists()) role = String(userSnapshot.data()?.role || "member");
      if (role === "member" && user.email) {
        const allowlistSnapshot = await getDoc(doc(globalThis.firebaseServices.db, "allowlist", String(user.email).trim().toLowerCase()));
        if (allowlistSnapshot.exists()) role = String(allowlistSnapshot.data()?.role || "member");
      }
    } catch (error) {
      console.warn("Unable to load Firebase user role; defaulting to member.", error);
    }
  }
  globalThis.firebaseUserRole = role;
  globalThis.dispatchEvent(new CustomEvent("firebase-auth-state-changed", { detail: { user: user || null, role } }));
});
