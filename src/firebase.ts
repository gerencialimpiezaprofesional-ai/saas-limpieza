import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import localFirebaseConfig from '../firebase-applet-config.json';

// Use environment variables if provided (via Platform Settings), otherwise fallback to local config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || localFirebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || localFirebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || localFirebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || localFirebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || localFirebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || localFirebaseConfig.appId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || localFirebaseConfig.firestoreDatabaseId || '(default)',
};

console.log("🔥 Firebase Config Sources:");
console.log("- Project ID:", firebaseConfig.projectId, import.meta.env.VITE_FIREBASE_PROJECT_ID ? "(From Env)" : "(From Config File)");
console.log("- Database ID:", firebaseConfig.firestoreDatabaseId, import.meta.env.VITE_FIREBASE_DATABASE_ID ? "(From Env)" : "(From Config File)");
console.log("- API Key:", firebaseConfig.apiKey ? "********" + firebaseConfig.apiKey.slice(-4) : "MISSING", import.meta.env.VITE_FIREBASE_API_KEY ? "(From Env)" : "(From Config File)");

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Test connection strictly
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("✅ Firestore Connection Established");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("❌ Firestore Error: Please check your Firebase configuration (API Key, Project ID, or Database ID).");
    } else {
      console.warn("⚠️ Initial Firestore check:", error);
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error Detailed: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
