import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User
} from "firebase/auth";
import { auth } from "./firebase";

export const subscribeUser = (cb: (user: User | null) => void) =>
  onAuthStateChanged(auth, cb);

export const authErrorMessage = (error: unknown) => {
  const code = typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: unknown }).code
    : undefined;

  if (code === "auth/popup-blocked") {
    return "Prehliadač zablokoval prihlasovacie okno. Povoľ vyskakovacie okná a skús to znova.";
  }
  if (code === "auth/popup-closed-by-user") {
    return "Prihlásenie bolo zrušené. Skús to znova.";
  }
  if (code === "auth/cancelled-popup-request") {
    return "Prihlásenie už prebieha.";
  }
  return "Prihlásenie zlyhalo. Skontroluj pripojenie a skús to znova.";
};

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    throw new Error(authErrorMessage(error));
  }
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
