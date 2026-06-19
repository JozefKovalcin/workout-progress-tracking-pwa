// @vitest-environment node

import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, describe, it } from "vitest";

const protectedPath = "users/jozef/dailyEntries/2026-06-19";

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  "Firestore user isolation",
  () => {
    let env: RulesTestEnvironment;

    beforeAll(async () => {
      env = await initializeTestEnvironment({
        projectId: "demo-lean-bulk",
        firestore: {
          rules: readFileSync("firestore.rules", "utf8")
        }
      });
    });

    afterAll(async () => {
      await env.cleanup();
    });

    it("allows an authenticated user to write their own data", async () => {
      const own = env.authenticatedContext("jozef").firestore();

      await assertSucceeds(
        setDoc(doc(own, protectedPath), { calories: 2900 })
      );
    });

    it("denies another user read and write access", async () => {
      const other = env.authenticatedContext("other").firestore();

      await assertFails(getDoc(doc(other, protectedPath)));
      await assertFails(
        setDoc(doc(other, protectedPath), { calories: 3100 })
      );
    });

    it("denies unauthenticated read and write access", async () => {
      const unauthenticated = env.unauthenticatedContext().firestore();

      await assertFails(getDoc(doc(unauthenticated, protectedPath)));
      await assertFails(
        setDoc(doc(unauthenticated, protectedPath), { calories: 3100 })
      );
    });
  }
);
