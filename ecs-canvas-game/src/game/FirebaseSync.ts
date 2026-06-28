import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  setDoc,
  getDoc,
  Bytes
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from "firebase/auth";
import pako from "pako";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with local persistent cache enabled (IndexedDB equivalent)
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

const auth = getAuth(app);

export { app, db, auth };

/**
 * Ensures the user is logged in anonymously and returns their User object
 */
export function ensureAuthenticated(): Promise<User> {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        unsubscribe();
        resolve(user);
      } else {
        try {
          const userCredential = await signInAnonymously(auth);
          unsubscribe();
          resolve(userCredential.user);
        } catch (error) {
          unsubscribe();
          reject(error);
        }
      }
    });
  });
}

/**
 * Compresses any JSON-serializable object into a binary string using pako.gzip.
 */
export function compressToBinaryString(saveData: any): string {
  const jsonStr = JSON.stringify(saveData);
  const compressed = pako.gzip(jsonStr);
  let binaryString = "";
  for (let i = 0; i < compressed.length; i++) {
    binaryString += String.fromCharCode(compressed[i]);
  }
  return binaryString;
}

/**
 * Decompresses a binary string using pako.ungzip back into a JSON object.
 */
export function decompressFromBinaryString(binaryString: string): any {
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const decompressed = pako.ungzip(bytes, { to: "string" });
  return JSON.parse(decompressed);
}

/**
 * Compresses the JSON game state and saves it to the Firestore 'saves' collection.
 */
export async function saveToCloud(uid: string, saveData: any): Promise<void> {
  const jsonStr = JSON.stringify(saveData);
  const compressed = pako.gzip(jsonStr);
  const bytes = Bytes.fromUint8Array(compressed);

  const docRef = doc(db, "saves", uid);
  await setDoc(docRef, {
    uid: uid,
    data: bytes,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Fetches the compressed game state from Firestore and decompresses it back into a JSON object.
 */
export async function loadFromCloud(uid: string): Promise<any | null> {
  const docRef = doc(db, "saves", uid);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const payload = docSnap.data();
  if (!payload || !payload.data) {
    return null;
  }

  // payload.data is a Bytes instance
  const bytesInstance = payload.data as Bytes;
  const uint8 = bytesInstance.toUint8Array();
  const decompressed = pako.ungzip(uint8, { to: "string" });
  return JSON.parse(decompressed);
}
