import { getApps, initializeApp, cert, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

let adminApp: any = null;
let isMockAdmin = false;

if (projectId && clientEmail && privateKey && !privateKey.includes("MOCK")) {
  try {
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = JSON.parse(privateKey);
    }
    const formattedKey = privateKey.replace(/\\n/g, "\n");
    
    if (getApps().length === 0) {
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: formattedKey,
        }),
      });
    } else {
      adminApp = getApp();
    }
  } catch (err) {
    console.error("[Firebase Admin] Error initializing Admin SDK:", err);
    isMockAdmin = true;
  }
} else {
  console.warn("[Firebase Admin] Running in MOCK admin mode. Real service account credentials not configured.");
  isMockAdmin = true;
}

export const adminDb = !isMockAdmin ? getFirestore() : null;
export const adminAuth = !isMockAdmin ? getAuth() : null;
export { isMockAdmin };
