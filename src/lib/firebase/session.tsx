import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { ensureAuthPersistence, firebaseAuth } from "./client";
import { ensureTraderProfile } from "./desk";
import { profileFromDesk, publishProfiles } from "@/lib/ops/directory";
import { firebaseMessage, isAuthNotConfigured } from "./errors";
import { setAuthMode } from "@/lib/desk/auth-mode";
import {
  getSessionUser,
  localLogin,
  localSignOut,
  type LocalUser,
} from "@/lib/desk/local-store";

export type DeskSessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

type SessionState = {
  user: DeskSessionUser | null;
  isPending: boolean;
  error: string | null;
  local: boolean;
};

const Ctx = createContext<
  SessionState & {
    signUpEmail: (email: string, password: string, name?: string) => Promise<void>;
    signInEmail: (email: string, password: string) => Promise<void>;
    signInGoogle: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    signOutDesk: () => Promise<void>;
  }
>({
  user: null,
  isPending: true,
  error: null,
  local: false,
  signUpEmail: async () => undefined,
  signInEmail: async () => undefined,
  signInGoogle: async () => undefined,
  resetPassword: async () => undefined,
  signOutDesk: async () => undefined,
});

function toUser(u: User): DeskSessionUser {
  return {
    id: u.uid,
    name: u.displayName || u.email?.split("@")[0] || "Trader",
    email: u.email || "",
    image: u.photoURL,
  };
}

function fromLocal(u: LocalUser): DeskSessionUser {
  return { id: u.id, name: u.name, email: u.email };
}

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DeskSessionUser | null>(null);
  const [isPending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState(false);

  useEffect(() => {
    let unsub = () => undefined as void;
    void ensureAuthPersistence().then(() => {
      unsub = onAuthStateChanged(firebaseAuth, (next) => {
        if (next) {
          setAuthMode("firebase");
          setLocal(false);
          setUser(toUser(next));
          setPending(false);
          void ensureTraderProfile(next).catch(() => undefined);
          void publishProfiles([
            profileFromDesk({
              id: next.uid,
              name: next.displayName || next.email?.split("@")[0] || "Trader",
              email: next.email || "",
              createdAt: next.metadata.creationTime,
              lastLogin: next.metadata.lastSignInTime,
            }),
          ]);
          return;
        }
        const paper = getSessionUser();
        if (paper) {
          setAuthMode("local");
          setLocal(true);
          setUser(fromLocal(paper));
          void publishProfiles([profileFromDesk(paper)]);
        } else {
          setUser(null);
          setLocal(false);
        }
        setPending(false);
      });
    });
    return () => unsub();
  }, []);

  const adoptLocal = useCallback((paper: LocalUser) => {
    setAuthMode("local");
    setLocal(true);
    setUser(fromLocal(paper));
    void publishProfiles([profileFromDesk(paper)]);
  }, []);

  const signUpEmail = useCallback(
    async (email: string, password: string, name?: string) => {
      setError(null);
      try {
        await ensureAuthPersistence();
        const cred = await createUserWithEmailAndPassword(
          firebaseAuth,
          email.trim(),
          password,
        );
        const label = (name || email.split("@")[0] || "Trader").slice(0, 40);
        await updateProfile(cred.user, { displayName: label });
        await ensureTraderProfile(cred.user);
        setAuthMode("firebase");
        setLocal(false);
      } catch (err) {
        const message = firebaseMessage(err);
        setError(message);
        throw new Error(message);
      }
    },
    [adoptLocal],
  );

  const signInEmail = useCallback(
    async (email: string, password: string) => {
      setError(null);
      const ident = email.trim();
      if (!ident.includes("@")) {
        const paper = await localLogin(ident, password);
        adoptLocal(paper);
        return;
      }
      try {
        await ensureAuthPersistence();
        const cred = await signInWithEmailAndPassword(firebaseAuth, ident, password);
        await ensureTraderProfile(cred.user);
        setAuthMode("firebase");
        setLocal(false);
      } catch (err) {
        try {
          const paper = await localLogin(ident, password);
          adoptLocal(paper);
          return;
        } catch (localErr) {
          const message = isAuthNotConfigured(err)
            ? firebaseMessage(err)
            : localErr instanceof Error
              ? localErr.message
              : firebaseMessage(err);
          setError(message);
          throw new Error(message);
        }
      }
    },
    [adoptLocal],
  );

  const signInGoogle = useCallback(async () => {
    setError(null);
    await ensureAuthPersistence();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const cred = await signInWithPopup(firebaseAuth, provider);
      await ensureTraderProfile(cred.user).catch(() => undefined);
      setAuthMode("firebase");
      setLocal(false);
      setUser(toUser(cred.user));
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
      const message = firebaseMessage(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    const ident = email.trim();
    if (!ident.includes("@")) throw new Error("Enter the Gmail address on the account.");
    await ensureAuthPersistence();
    try {
      await sendPasswordResetEmail(firebaseAuth, ident, {
        url: "https://sikkaaa.in/",
      });
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "auth/unauthorized-continue-uri") {
        await sendPasswordResetEmail(firebaseAuth, ident);
        return;
      }
      const message = firebaseMessage(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  const signOutDesk = useCallback(async () => {
    localSignOut();
    setLocal(false);
    setUser(null);
    try {
      await fbSignOut(firebaseAuth);
    } catch {
      /* firebase may be off */
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isPending,
      error,
      local,
      signUpEmail,
      signInEmail,
      signInGoogle,
      resetPassword,
      signOutDesk,
    }),
    [user, isPending, error, local, signUpEmail, signInEmail, signInGoogle, resetPassword, signOutDesk],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDeskSession() {
  return useContext(Ctx);
}

export function useDeskUser() {
  return useContext(Ctx).user;
}
