import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAd2fMjPse2_fdlaVpa5Y7VyDozuRcelkM",
  authDomain: "base-de-prueba-cee39.firebaseapp.com",
  projectId: "base-de-prueba-cee39",
  storageBucket: "base-de-prueba-cee39.firebasestorage.app",
  messagingSenderId: "742708394755",
  appId: "1:742708394755:web:dfca938eba263462b40736",
  measurementId: "G-N6G9KHCEXD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
