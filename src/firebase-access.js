import "./firebase-config.js";
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const db = globalThis.firebaseServices?.db;
if (!db) throw new Error("Firebase Firestore is not initialized.");
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const accessCollection = () => collection(db, "allowlist");

async function listAllowlist() {
  const snapshot = await getDocs(accessCollection());
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
    .sort((left, right) => String(left.email || left.id).localeCompare(String(right.email || right.id)));
}
async function saveAllowlistEntry(email, role = "member") {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !normalizedEmail.includes("@")) throw new Error("Enter a valid email address.");
  const normalizedRole = role === "admin" ? "admin" : "member";
  await setDoc(doc(db, "allowlist", normalizedEmail), { email: normalizedEmail, role: normalizedRole, updatedAt: serverTimestamp() }, { merge: true });
  return { email: normalizedEmail, role: normalizedRole };
}
async function removeAllowlistEntry(email) {
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) await deleteDoc(doc(db, "allowlist", normalizedEmail));
}
async function queueInviteEmail(email, role = "member") {
  const normalizedEmail = normalizeEmail(email);
  const accessLabel = role === "admin" ? "Administrator" : "Regular user";
  const appUrl = "https://bovine-scouting-analysis.web.app/";
  await setDoc(doc(collection(db, "mail")), {
    to: [normalizedEmail],
    message: {
      subject: "Bovine Scouting Analysis access",
      text: `You have been invited to Bovine Scouting Analysis.\\n\\nOpen the app: ${appUrl}\\n\\nChoose Sign in with Google and use this email address: ${normalizedEmail}.\\n\\nYour access level is: ${accessLabel}.`,
      html: `<p>You have been invited to <strong>Bovine Scouting Analysis</strong>.</p><p><a href="${appUrl}">Open Bovine Scouting Analysis</a></p><p>Choose <strong>Sign in with Google</strong> and use this email address: <strong>${normalizedEmail}</strong>.</p><p>Your access level is: ${accessLabel}.</p>`, 
    },
    createdAt: serverTimestamp(),
  });
}
globalThis.firebaseAccessApi = { listAllowlist, saveAllowlistEntry, removeAllowlistEntry, queueInviteEmail };