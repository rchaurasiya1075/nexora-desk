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
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { ensureAuthPersistence, firebaseAuth } from "./client";
import { ensureTraderProfile } from "./desk";
import { firebaseMessage, isAuthNotConfigured } from "./errors";
import { setAuthMode } from "@/lib/desk/auth-mode";
import {
  getSessionUser,
  localLogin,
  localRegister,
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
    enterDemo: () => Promise<void>;
    signOutDesk: () => Promise<void>;
  }
>({
  user: null,
  isPending: true,
  error: null,
  local: false,
  signUpEmail: async () => undefined,
  signInEmail: async () => undefined,
  enterDemo: async () => undefined,
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
          return;
        }
        const paper = getSessionUser();
        if (paper) {
          setAuthMode("local");
          setLocal(true);
          setUser(fromLocal(paper));
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
        if (isAuthNotConfigured(err)) {
          const paper = await localRegister(email, password, name);
          adoptLocal(paper);
          return;
        }
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
      try {
        await ensureAuthPersistence();
        const cred = await signInWithEmailAndPassword(
          firebaseAuth,
          email.trim(),
          password,
        );
        await ensureTraderProfile(cred.user);
        setAuthMode("firebase");
        setLocal(false);
      } catch (err) {
        if (isAuthNotConfigured(err)) {
          try {
            const paper = await localLogin(email, password);
            adoptLocal(paper);
            return;
          } catch {
            const paper = await localRegister(email, password);
            adoptLocal(paper);
            return;
          }
        }
        try {
          const paper = await localLogin(email, password);
          adoptLocal(paper);
          return;
        } catch {
          /* stay on firebase error */
        }
        const message = firebaseMessage(err);
        setError(message);
        throw new Error(message);
      }
    },
    [adoptLocal],
  );

  const enterDemo = useCallback(async () => {
    setError(null);
    try {
      const paper = await localLogin("demo@nexora.local", "nexora-demo");
      adoptLocal(paper);
    } catch {
      const paper = await localRegister("demo@nexora.local", "nexora-demo", "Demo trader");
      adoptLocal(paper);
    }
  }, [adoptLocal]);

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
      enterDemo,
      signOutDesk,
    }),
    [user, isPending, error, local, signUpEmail, signInEmail, enterDemo, signOutDesk],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDeskSession() {
  return useContext(Ctx);
}

export function useDeskUser() {
  return useContext(Ctx).user;
}
