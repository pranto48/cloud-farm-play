import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize Analytics (safely for server-side rendering environments)
export const analytics = typeof window !== "undefined"
  ? isSupported().then((supported) => (supported ? getAnalytics(app) : null)).catch(() => null)
  : Promise.resolve(null);

// Seeding function to ensure Meadow Life game exists in Firestore
export async function seedDefaultGames() {
  try {
    const meadowRef = doc(db, "games", "meadow-life");
    const snap = await getDoc(meadowRef);
    if (!snap.exists()) {
      await setDoc(meadowRef, {
        id: "meadow-life",
        title: "Meadow Life",
        slug: "meadow-life",
        description: "A cozy original farming demo. Till soil, plant seeds, water crops, and watch your meadow grow.",
        genre: "Cozy Farming RPG",
        cover_url: null,
        created_at: new Date().toISOString(),
      });
      console.log("[Firebase] Seeded Meadow Life default game");
    }
  } catch (err) {
    console.warn("[Firebase] Seeding checked/ignored:", err);
  }
}
