import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

// Firebase web config. The values below are public by design (Firebase web
// SDKs embed them in the bundle) — override via NEXT_PUBLIC_FIREBASE_* env
// vars when deploying under a different project.
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAs7C-OegYfoPxj8LOYNagZgcMi9yo45Zg',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'omix-systems-cd1af.firebaseapp.com',
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://omix-systems-cd1af-default-rtdb.firebaseio.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'omix-systems-cd1af',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'omix-systems-cd1af.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '458479471215',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:458479471215:web:1687c91f3004bd1dff5b9a',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-FP80YJDPC3',
};

// Reuse an existing app when hot-reloading in dev
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
