import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: "AIzaSyAcgI3Rg-W5hjccfR76HbwgJ-0GhHeX0ws",
  authDomain: "digispire-academy.firebaseapp.com",
  projectId: "digispire-academy",
  storageBucket: "digispire-academy.firebasestorage.app",
  messagingSenderId: "143103427249",
  appId: "1:143103427249:web:8a47bc78138deda87c1890"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
