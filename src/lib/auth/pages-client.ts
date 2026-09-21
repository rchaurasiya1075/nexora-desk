import { useSyncExternalStore } from "react";
import {
  getSessionUser,
  hashPassword,
  loadDesk,
  mutateDesk,
  setSessionUserId,
  subscribeDesk,
  uid,
} from "@/lib/desk/local-store";

export const authEnabled = true;
export const GROK_PROVIDERS: Array<{ providerId: string; label: string }> = [];

type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

function snapshot(): { user: SessionUser } | null {
  const u = getSessionUser();
  if (!u) return null;
  return { user: { id: u.id, name: u.name, email: u.email, image: null } };
}

export const authClient = {
  useSession() {
    const data = useSyncExternalStore(subscribeDesk, snapshot, snapshot);
    return { data, isPending: false };
  },
  signUp: {
    async email(input: { email: string; password: string; name?: string }) {
      const email = input.email.trim().toLowerCase();
      const password = input.password;
      if (!email || password.length < 6) {
        return { error: { message: "Use a valid email and 6+ character password." } };
      }
      const hash = await hashPassword(password);
      try {
        mutateDesk((desk) => {
          if (desk.users.some((u) => u.email === email)) {
            throw new Error("That email is already registered.");
          }
          const user = {
            id: uid("usr"),
            name: (input.name || email.split("@")[0] || "Trader").slice(0, 40),
            email,
            passwordHash: hash,
            createdAt: new Date().toISOString(),
          };
          desk.users.push(user);
        });
      } catch (err) {
        return { error: { message: err instanceof Error ? err.message : "Could not create account." } };
      }
      const created = loadDesk().users.find((u) => u.email === email);
      if (created) setSessionUserId(created.id);
      return { error: null };
    },
  },
  signIn: {
    async email(input: { email: string; password: string }) {
      const email = input.email.trim().toLowerCase();
      const hash = await hashPassword(input.password);
      const user = loadDesk().users.find((u) => u.email === email);
      if (!user || user.passwordHash !== hash) {
        return { error: { message: "Email or password is wrong." } };
      }
      setSessionUserId(user.id);
      return { error: null };
    },
  },
};

export async function signIn(_providerId: string, _opts?: { callbackURL?: string }) {
  throw new Error("Social sign-in is not on the GitHub live desk. Use email.");
}

export async function signOut() {
  setSessionUserId(null);
  if (typeof window !== "undefined") {
    const hash = window.location.hash || "#/";
    if (!hash.startsWith("#/login")) window.location.hash = "#/";
  }
}

export function getBearerToken(): string | null {
  return null;
}
