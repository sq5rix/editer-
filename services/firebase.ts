import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

// --- Configuration ---
// In a real app, these should be individual env vars. 
// For this environment, we attempt to read a JSON string or fallback to individual keys if available.
const firebaseConfig = process.env.FIREBASE_CONFIG 
  ? JSON.parse(process.env.FIREBASE_CONFIG)
  : {
      apiKey: process.env.FIREBASE_API_KEY || "AIzaSy...", 
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID
    };

// Initialize
let app;
let auth: any;
let db: any;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (e) {
    console.warn("Firebase initialization failed. Cloud features will be disabled.", e);
}

const provider = new GoogleAuthProvider();

// --- Auth Exports ---

export const loginWithGoogle = async () => {
    if (!auth) throw new Error("Firebase not initialized");
    try {
        const result = await signInWithPopup(auth, provider);
        return result.user;
    } catch (error) {
        console.error("Login failed", error);
        throw error;
    }
};

export const logout = async () => {
    if (!auth) return;
    await signOut(auth);
};

export const subscribeToAuth = (callback: (user: FirebaseUser | null) => void) => {
    if (!auth) return () => {};
    return onAuthStateChanged(auth, callback);
};

// --- Firestore Exports ---

export const saveData = async (userId: string, collection: string, docId: string, data: any) => {
    if (!db) return;
    try {
        // We store data under users/{userId}/{collection}/{docId}
        const ref = doc(db, "users", userId, collection, docId);
        await setDoc(ref, data, { merge: true });
    } catch (e) {
        console.error("Save to cloud failed", e);
    }
};

export const loadData = async (userId: string, collection: string, docId: string) => {
    if (!db) return null;
    try {
        const ref = doc(db, "users", userId, collection, docId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            return snap.data();
        }
        return null;
    } catch (e) {
        console.error("Load from cloud failed", e);
        return null;
    }
};

// Hook-like helper for use in components
export const useCloudSync = (
    user: { uid: string } | null, 
    collection: string, 
    docId: string, 
    localData: any, 
    setLocalData: (data: any) => void
) => {
    // 1. Save to Cloud on change (Debounced)
    // 2. Load from Cloud on Mount (if user exists)
    // Note: This logic is usually implemented inside the component's useEffect
    // We just export the raw functions above to keep this pure TS.
};