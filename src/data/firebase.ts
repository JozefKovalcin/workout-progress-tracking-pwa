import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  type Auth
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore
} from "firebase/firestore";

interface FirebaseModuleState {
  app?: FirebaseApp;
  auth?: Auth;
  db?: Firestore;
  emulatorsConnected?: boolean;
}

const runtime = globalThis as typeof globalThis & {
  __leanBulkFirebaseState?: FirebaseModuleState;
};
const firebaseState =
  runtime.__leanBulkFirebaseState ?? (runtime.__leanBulkFirebaseState = {});

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app =
  firebaseState.app ??
  (firebaseState.app =
    getApps().length > 0 ? getApp() : initializeApp(firebaseConfig));

export const db =
  firebaseState.db ??
  (firebaseState.db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }));

export const auth =
  firebaseState.auth ?? (firebaseState.auth = getAuth(app));

if (
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true" &&
  !firebaseState.emulatorsConnected
) {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", {
    disableWarnings: true
  });
  firebaseState.emulatorsConnected = true;
}
