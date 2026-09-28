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
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { ensureAuthPersistence, firebaseAuth } from "./client";
import { ensureTraderProfile } from "./desk";
import { watchWallet } from "@/lib/ops/balance-adjust";
import { profileFromDesk, publishProfiles } from "@/lib/ops/directory";
import { loadPrefs, savePrefs } from "@/lib/profile/prefs";
import { firebaseMessage, isAuthNotConfigured } from "./errors";
import { setAuthMode } from "@/lib/desk/auth-mode";
import {
  getSessionUser,
  localLogin,
  localRegister,
  localSignOut,
  localChangePassword,
  renameLocalUser,
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
    signUpEmail: (email: string, password: string, name?: string, phone?: string) => Promise<void>;
    verifyGmail: (email: string) => Promise<void>;
    registerLocalAccount: (input: { email: string; password: string; name: string; phone?: string; username: string }) => Promise<void>;
    signInEmail: (email: string, password: string) => Promise<void>;
    signInGoogle: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    changeDeskPassword: (current: string, next: string) => Promise<void>;
    renameDesk: (name: string) => Promise<void>;
    signOutDesk: () => Promise<void>;
  }
>({
  user: null,
  isPending: true,
  error: null,
  local: false,
  signUpEmail: async () => undefined,
  verifyGmail: async () => undefined,
  registerLocalAccount: async () => undefined,
  signInEmail: async () => undefined,
  signInGoogle: async () => undefined,
  resetPassword: async () => undefined,
  changeDeskPassword: async () => undefined,
  renameDesk: async () => undefined,
  signOutDesk: async () => undefined,
});

let holdAuth = false;

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
        if (holdAuth) {
          setPending(false);
          return;
        }
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

  const walletId = user?.id;
  useEffect(() => {
    if (!walletId) return;
    return watchWallet(walletId);
  }, [walletId]);

  const adoptLocal = useCallback((paper: LocalUser) => {
    setAuthMode("local");
    setLocal(true);
    setUser(fromLocal(paper));
    void publishProfiles([profileFromDesk(paper)]);
  }, []);

  const signUpEmail = useCallback(
    async (email: string, password: string, name?: string, phone?: string) => {
      setError(null);
      const label = (name || email.split("@")[0] || "Trader").trim().slice(0, 40);
      const mobile = (phone || "").replace(/\s/g, "");
      const remember = (id: string) => {
        if (!mobile) return;
        savePrefs(id, { ...loadPrefs(id), phone: mobile });
      };
      try {
        await ensureAuthPersistence();
        const cred = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
        await updateProfile(cred.user, { displayName: label });
        await ensureTraderProfile(cred.user);
        remember(cred.user.uid);
        setAuthMode("firebase");
        setLocal(false);
      } catch (err) {
        if (!isAuthNotConfigured(err)) {
          const message = firebaseMessage(err);
          setError(message);
          throw new Error(message);
        }
        const paper = await localRegister(email, password, label);
        remember(paper.id);
        adoptLocal(paper);
      }
    },
    [adoptLocal],
  );

  const verifyGmail = useCallback(async (email: string) => {
    const expected = email.trim().toLowerCase();
    if (!expected.includes("@")) throw new Error("Enter the Gmail address first.");
    holdAuth = true;
    setError(null);
    try {
      await ensureAuthPersistence();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ login_hint: expected, prompt: "select_account" });
      const cred = await signInWithPopup(firebaseAuth, provider);
      const got = (cred.user.email || "").toLowerCase();
      await fbSignOut(firebaseAuth);
      if (got !== expected) throw new Error("Choose the same Gmail you typed.");
    } catch (err) {
      try {
        await fbSignOut(firebaseAuth);
      } catch {
        /* already signed out */
      }
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        throw new Error("Gmail check was closed.");
      }
      if (err instanceof Error && err.message === "Choose the same Gmail you typed.") throw err;
      throw new Error(firebaseMessage(err));
    } finally {
      holdAuth = false;
    }
  }, []);

  const registerLocalAccount = useCallback(
    async (input: { email: string; password: string; name: string; phone?: string; username: string }) => {
      setError(null);
      const paper = await localRegister(input.email, input.password, input.name, input.username);
      const mobile = (input.phone || "").replace(/\s/g, "");
      if (mobile) savePrefs(paper.id, { ...loadPrefs(paper.id), phone: mobile });
      adoptLocal(paper);
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
          const message = localErr instanceof Error ? localErr.message : firebaseMessage(err);
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

  const changeDeskPassword = useCallback(async (current: string, nextPw: string) => {
    if (nextPw.length < 6) throw new Error("Password must be at least 6 characters.");
    if (local) {
      await localChangePassword(current, nextPw);
      return;
    }
    const person = firebaseAuth.currentUser;
    if (!person?.email) throw new Error("Sign in again, then change the password.");
    try {
      const cred = EmailAuthProvider.credential(person.email, current);
      await reauthenticateWithCredential(person, cred);
      await updatePassword(person, nextPw);
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        throw new Error("Current password is wrong.");
      }
      if (code === "auth/operation-not-allowed") {
        throw new Error("This login uses Google. Password change needs Email/Password turned on in Firebase.");
      }
      throw new Error(firebaseMessage(err));
    }
  }, [local]);

  const renameDesk = useCallback(
    async (name: string) => {
      const clean = name.trim().slice(0, 40);
      if (clean.length < 2) throw new Error("Enter your name.");
      if (local) {
        renameLocalUser(clean);
        setUser((row) => (row ? { ...row, name: clean } : row));
        return;
      }
      const person = firebaseAuth.currentUser;
      if (!person) throw new Error("Sign in again.");
      await updateProfile(person, { displayName: clean });
      setUser((row) => (row ? { ...row, name: clean } : row));
    },
    [local],
  );

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
      verifyGmail,
      registerLocalAccount,
      signInEmail,
      signInGoogle,
      resetPassword,
      changeDeskPassword,
      renameDesk,
      signOutDesk,
    }),
    [user, isPending, error, local, signUpEmail, verifyGmail, registerLocalAccount, signInEmail, signInGoogle, resetPassword, changeDeskPassword, renameDesk, signOutDesk],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDeskSession() {
  return useContext(Ctx);
}

export function useDeskUser() {
  return useContext(Ctx).user;
}
