// src/auth/firebase.ts
import admin from "firebase-admin";

// Prefer explicit Firebase project id (the one that issues the ID tokens)
const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT || // fallback
  process.env.GOOGLE_CLOUD_PROJECT; // fallback

// Initialize Admin SDK once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    // ✅ Critical: make sure Admin verifies against the Firebase project that issued the token
    ...(FIREBASE_PROJECT_ID ? { projectId: FIREBASE_PROJECT_ID } : {}),
  });

  console.log("[auth] firebase-admin initialized", {
    projectId: (admin.app().options as any)?.projectId,
    env_FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    env_GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
    env_GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
  });
}

// --- Helpers ---

function base64UrlToUtf8(b64url: string) {
  // JWT uses base64url (RFC 7515): '-' -> '+', '_' -> '/', pad with '='
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  return Buffer.from(b64, "base64").toString("utf8");
}

function decodeJwtPayload(idToken: string) {
  try {
    const parts = idToken.split(".");
    if (parts.length < 2) return null;
    const payloadJson = base64UrlToUtf8(parts[1]);
    return JSON.parse(payloadJson) as Record<string, any>;
  } catch {
    return null;
  }
}

export async function verifyFirebaseIdToken(idToken: string) {
  const decodedUnverified = decodeJwtPayload(idToken);

  const projectIdFromAdmin =
    (admin.app().options as any)?.projectId ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT;

  console.debug("[auth] verifyFirebaseIdToken: token claims (unverified)", {
    aud: decodedUnverified?.aud,
    iss: decodedUnverified?.iss,
    sub: decodedUnverified?.sub,
    exp: decodedUnverified?.exp,
    email: decodedUnverified?.email,
    projectIdFromAdmin,
  });

  // Optional: check token revocation (defaults to false)
  const checkRevoked = process.env.FIREBASE_CHECK_REVOKED === "true";

  try {
    // ✅ This will fail if the Admin projectId/credentials don't match the token's aud/iss
    return await admin.auth().verifyIdToken(idToken, checkRevoked);
  } catch (err: any) {
    console.error("[auth] verifyIdToken failed", {
      message: err?.message,
      code: err?.code,
      name: err?.name,
      aud: decodedUnverified?.aud,
      iss: decodedUnverified?.iss,
      adminProjectId: (admin.app().options as any)?.projectId,
    });
    throw err;
  }
}
