import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// These values are safe to be public — your Firestore security rules
// (not these keys) are what actually protects your data.
const firebaseConfig = {
  apiKey: "AIzaSyBMsYCtkplrxAsrsTlAZoN96n9rUQBtw0s",
  authDomain: "glowup-001.firebaseapp.com",
  projectId: "glowup-001",
  storageBucket: "glowup-001.firebasestorage.app",
  messagingSenderId: "743727832533",
  appId: "1:743727832533:web:acbbcb2a6c7fe16c3e715c",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
