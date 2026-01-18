import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";


// const firebaseConfig = {
//   apiKey: "AIzaSyAP7Af1h_-zBmBfL_A5K2uuJsJDFuOel0c",
//   authDomain: "local-js-d7712.firebaseapp.com",
//   databaseURL: "https://local-js-d7712-default-rtdb.firebaseio.com",
//   projectId: "local-js-d7712",
//   storageBucket: "local-js-d7712.firebasestorage.app",
//   messagingSenderId: "200538761653",
//   appId: "1:200538761653:web:571a969ac8a572328451fc",
//   measurementId: "G-XXD5WT5TV1"
// };

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
const storage = getStorage(app);

export { db, storage };

