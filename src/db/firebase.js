import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";


const firebaseConfig = {
  apiKey: "AIzaSyAP7Af1h_-zBmBfL_A5K2uuJsJDFuOel0c",
  authDomain: "local-js-d7712.firebaseapp.com",
  databaseURL: "https://local-js-d7712-default-rtdb.firebaseio.com",
  projectId: "local-js-d7712",
  storageBucket: "local-js-d7712.firebasestorage.app",
  messagingSenderId: "200538761653",
  appId: "1:200538761653:web:571a969ac8a572328451fc",
  measurementId: "G-XXD5WT5TV1"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with settings
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

const storage = getStorage(app);

export { db, storage };
