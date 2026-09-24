import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "./config";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const firebaseApp = app;
export const firebaseAuth = getAuth(app);
export const db = getFirestore(app);

let persistenceReady: Promise<void> | null = null;

export function ensureAuthPersistence() {
  if (typeof window === "undefined") return Promise.resolve();
  if (!persistenceReady) {
    persistenceReady = setPersistence(firebaseAuth, browserLocalPersistence).then(
      () => undefined,
      () => undefined,
    );
  }
  return persistenceReady;
}
