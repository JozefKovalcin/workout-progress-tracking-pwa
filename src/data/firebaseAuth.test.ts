import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  popup: vi.fn(),
  redirect: vi.fn()
}));

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: vi.fn(),
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: authMock.popup,
  signInWithRedirect: authMock.redirect,
  signOut: vi.fn()
}));

vi.mock("./firebase", () => ({
  auth: {}
}));

import { authErrorMessage, signInWithGoogle } from "./firebaseAuth";

describe("Firebase authentication", () => {
  beforeEach(() => {
    authMock.popup.mockReset();
    authMock.redirect.mockReset();
    authMock.popup.mockResolvedValue(undefined);
  });

  it("uses a popup for Google sign-in on every viewport", async () => {
    await signInWithGoogle();

    expect(authMock.popup).toHaveBeenCalledOnce();
    expect(authMock.redirect).not.toHaveBeenCalled();
  });

  it.each([
    [
      "auth/popup-blocked",
      "Prehliadač zablokoval prihlasovacie okno. Povoľ vyskakovacie okná a skús to znova."
    ],
    [
      "auth/popup-closed-by-user",
      "Prihlásenie bolo zrušené. Skús to znova."
    ],
    [
      "auth/cancelled-popup-request",
      "Prihlásenie už prebieha."
    ]
  ])("maps %s to a helpful Slovak message", (code, message) => {
    expect(authErrorMessage({ code })).toBe(message);
  });

  it("uses a safe generic message for unknown failures", () => {
    expect(authErrorMessage(new Error("provider details"))).toBe(
      "Prihlásenie zlyhalo. Skontroluj pripojenie a skús to znova."
    );
  });

  it("keeps the original Firebase failure as the error cause", async () => {
    const firebaseError = { code: "auth/popup-blocked" };
    authMock.popup.mockRejectedValue(firebaseError);

    await expect(signInWithGoogle()).rejects.toMatchObject({
      message: "Prehliadač zablokoval prihlasovacie okno. Povoľ vyskakovacie okná a skús to znova.",
      cause: firebaseError
    });
  });
});
