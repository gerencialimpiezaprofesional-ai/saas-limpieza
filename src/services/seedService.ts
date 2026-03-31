import { db, auth } from "../firebase";
import { 
  doc, 
  setDoc, 
  collection, 
  addDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";

export const seedDemoData = async () => {
  const tenantId = "impeccable-prod-001";
  const tenantRef = doc(db, "tenants", tenantId);

  // 1. Create Tenant
  await setDoc(tenantRef, {
    name: "IMPECCABLE",
    createdAt: serverTimestamp(),
  });

  // 2. Create Clients
  const clients = [
    { id: "client-emmsa", name: "Emmsa", activeServices: 5 },
    { id: "client-casalumbre", name: "Casa Lumbre", activeServices: 3 },
    { id: "client-engrane", name: "Engrane", activeServices: 8 },
  ];

  for (const client of clients) {
    await setDoc(doc(db, "clients", client.id), {
      ...client,
      tenantId,
    });
  }

  // 3. Demo Users Data
  const demoUsers = [
    { email: "ceo@impeccable.com", role: "ceo", name: "Elena Valdés", points: 0 },
    { email: "rh@impeccable.com", role: "rh", name: "Roberto Hernández", points: 0 },
    { email: "supervisor@impeccable.com", role: "supervisor", name: "Sofía Pérez", points: 0 },
    { email: "operator@impeccable.com", role: "operator", name: "Carlos Mendoza", points: 12450 },
  ];

  const password = "password123";

  for (const user of demoUsers) {
    try {
      // Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, user.email, password);
      const uid = userCredential.user.uid;

      // Create Firestore User Doc
      await setDoc(doc(db, "users", uid), {
        ...user,
        tenantId,
        uid,
      });

      console.log(`Created user: ${user.email}`);
    } catch (error: any) {
      if (error.code === "auth/email-already-in-use") {
        console.log(`User ${user.email} already exists.`);
      } else {
        console.error(`Error creating ${user.email}:`, error);
      }
    }
  }

  // 4. Create Sample Tasks for the Operator
  const operator = demoUsers.find(u => u.role === "operator");
  if (operator) {
    // We need to find the UID of the operator we just created or that already exists
    // For simplicity in this demo seed, we'll just add some tasks to the collection
    const tasksRef = collection(db, "tasks");
    const sampleTasks = [
      {
        title: "Limpieza Profunda Baños - Ala Norte",
        clientId: "client-emmsa",
        operatorId: "operator-uid-placeholder", // This would be the real UID
        tenantId,
        status: "completed",
        score: 92,
        beforePhoto: "https://picsum.photos/seed/before1/400/400",
        afterPhoto: "https://picsum.photos/seed/after1/400/400",
        createdAt: serverTimestamp(),
      },
      {
        title: "Mantenimiento Oficinas Piso 4",
        clientId: "client-casalumbre",
        operatorId: "operator-uid-placeholder",
        tenantId,
        status: "in_progress",
        createdAt: serverTimestamp(),
      }
    ];

    for (const task of sampleTasks) {
      await addDoc(tasksRef, task);
    }
  }

  // Sign out the last created user to return to login state
  await signOut(auth);
  
  return {
    tenant: "IMPECCABLE",
    users: demoUsers.map(u => ({ email: u.email, password, role: u.role }))
  };
};
