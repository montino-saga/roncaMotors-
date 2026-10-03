import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

// La configuración se lee desde variables de entorno (.env, prefijo VITE_).
// Copia .env.example como .env y completa los valores.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Aviso temprano si falta el .env (evita errores confusos de Firebase).
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    "Faltan variables de entorno de Firebase. Copia .env.example como .env y completa los valores."
  );
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with settings
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

const storage = getStorage(app);
const auth = getAuth(app);
// Idioma de los correos de Auth (invitación / restablecer) y de la página del
// enlace: la plantilla de la consola está bloqueada y por defecto sale en inglés.
auth.languageCode = "es";
const functions = getFunctions(app, "southamerica-east1");

export { db, storage, auth, functions };
