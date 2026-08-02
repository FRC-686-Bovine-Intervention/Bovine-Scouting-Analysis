const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const nodemailer = require("nodemailer");

initializeApp();
const db = getFirestore();

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required function environment variable: ${name}`);
  return value;
}

exports.sendMailOnCreate = onDocumentCreated(
  {
    document: "mail/{mailId}",
    region: process.env.FUNCTIONS_REGION || "us-central1",
    secrets: ["SMTP_PASSWORD"],
    retry: true,
  },
  async (event) => {
    const mailData = event.data?.data();
    if (!mailData) return;
    const message = mailData.message || mailData;
    const recipients = Array.isArray(mailData.to) ? mailData.to : [mailData.to];
    const to = recipients.filter(Boolean).join(",");
    if (!to || !message.subject || (!message.text && !message.html)) {
      throw new Error(`Mail document ${event.params.mailId} is missing to, subject, or body.`);
    }

    const transporter = nodemailer.createTransport({
      host: requiredEnv("SMTP_HOST"),
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false") === "true",
      auth: { user: requiredEnv("SMTP_USER"), pass: requiredEnv("SMTP_PASSWORD") },
    });

    await transporter.sendMail({
      from: requiredEnv("SMTP_FROM"),
      to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    await db.collection("mail").doc(event.params.mailId).set({
      delivery: { state: "SUCCESS", sentAt: FieldValue.serverTimestamp() },
    }, { merge: true });
    logger.info("Invitation email sent", { mailId: event.params.mailId, to });
  },
);