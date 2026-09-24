import { getApps, initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { firebaseConfig } from "./config";

const NAME = "sikkaaa-reader";

let ready: Promise<Firestore> | null = null;

/** Second Firebase app so the desk can read and file records without replacing the trader login. */
export function readerDb(): Promise<Firestore> {
  if (!ready) {
    const app = getApps().find((item) => item.name === NAME) ?? initializeApp(firebaseConfig, NAME);
    const auth = getAuth(app);
    ready = signInAnonymously(auth)
      .then(() => getFirestore(app))
      .catch((err) => {
        ready = null;
        throw err;
      });
  }
  return ready;
}
