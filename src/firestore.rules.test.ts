import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from "firebase/firestore";
import * as fs from "fs";
import { describe, test, beforeAll, afterAll, beforeEach } from "vitest";

let testEnv: RulesTestEnvironment;

describe("Impeccable AI Firestore Rules", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "cleanflow-ai-test",
      firestore: {
        rules: fs.readFileSync("DRAFT_firestore.rules", "utf8"),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  // 1. Tenant Isolation
  test("deny user from TenantA reading document from TenantB", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "clients/clientB"), { tenantId: "TenantB", name: "Client B" });
      await setDoc(doc(context.firestore(), "users/userA"), { uid: "userA", tenantId: "TenantA", role: "operator" });
    });

    const aliceDb = testEnv.authenticatedContext("userA").firestore();
    await assertFails(getDoc(doc(aliceDb, "clients/clientB")));
  });

  // 2. Role Integrity
  test("deny operator from updating their own role to ceo", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users/op1"), { uid: "op1", tenantId: "T1", role: "operator" });
    });

    const opDb = testEnv.authenticatedContext("op1").firestore();
    await assertFails(updateDoc(doc(opDb, "users/op1"), { role: "ceo" }));
  });

  // 3. Point Injection
  test("deny operator from increasing points to arbitrary value", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users/op1"), { uid: "op1", tenantId: "T1", role: "operator", points: 100 });
    });

    const opDb = testEnv.authenticatedContext("op1").firestore();
    await assertFails(updateDoc(doc(opDb, "users/op1"), { points: 999999 }));
  });

  // 4. Default Deny
  test("deny unauthenticated write to random collection", async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(unauthDb, "random/123"), { data: "leak" }));
  });

  // 5. Task Logic - Operator can only update status/photos
  test("deny operator from updating task score", async () => {
     await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users/op1"), { uid: "op1", tenantId: "T1", role: "operator" });
      await setDoc(doc(context.firestore(), "tasks/task1"), { tenantId: "T1", operatorId: "op1", title: "Task 1", score: 0 });
    });

    const opDb = testEnv.authenticatedContext("op1").firestore();
    await assertFails(updateDoc(doc(opDb, "tasks/task1"), { score: 100 }));
  });

  // 6. ID Injection Guard
  test("deny write with non-compliant ID", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users/ceo1"), { uid: "ceo1", tenantId: "T1", role: "ceo" });
    });
    const ceoDb = testEnv.authenticatedContext("ceo1").firestore();
    // Path variable {taskId} has isValidId applied
    await assertFails(setDoc(doc(ceoDb, "tasks/BAD!!ID"), { title: "Bad", tenantId: "T1" }));
  });
});
