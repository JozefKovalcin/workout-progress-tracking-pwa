import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User
} from "firebase/auth";
import { auth } from "./firebase";

export const subscribeUser = (cb: (user: User | null) => void) =>
  onAuthStateChanged(auth, cb);

export const signInWithGoogle = () => {
  const provider = new GoogleAuthProvider();
  return window.matchMedia("(max-width: 799px)").matches
    ? signInWithRedirect(auth, provider)
    : signInWithPopup(auth, provider);
};

export const signInForE2E = () => {
  if (import.meta.env.VITE_USE_FIREBASE_EMULATORS !== "true") {
    throw new Error("Test login is available only with Firebase emulators.");
  }
  return signInWithEmailAndPassword(
    auth,
    "jozef@example.test",
    "local-test-password"
  );
};

export const signOutCurrentUser = () => signOut(auth);
