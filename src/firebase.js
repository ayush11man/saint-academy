import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA2IHHastFiGrgeemQdJO-JAAQW9_aoB2Y",
  authDomain: "saint-academy-63261.firebaseapp.com",
  projectId: "saint-academy-63261",
  storageBucket: "saint-academy-63261.appspot.com",
  messagingSenderId: "334085313805",
  appId: "1:334085313805:web:e2a1345bc4e9cc9c967884"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);