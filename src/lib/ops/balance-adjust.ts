import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { appendLedger, ensureAccount, mutateDesk } from "@/lib/desk/local-store";
import { MAX_BALANCE } from "@/lib/trading/constants";

const KEY = "sikkaaa.balance.overrides.v1";

function readAll(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function balanceOverride(userId: string): number | null {
  const value = readAll()[userId];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function remember(userId: string, balance: number) {
  const all = readAll();
  all[userId] = balance;
  localStorage.setItem(KEY, JSON.stringify(all));
}

export async function adjustUserBalance(
  userId: string,
  delta: number,
  note: string,
  shown = 0,
): Promise<{ balance: number; saved: boolean }> {
  if (!userId) throw new Error("Missing user.");
  if (!Number.isFinite(delta) || delta === 0) throw new Error("Enter a non-zero amount.");
  const base = balanceOverride(userId) ?? (Number.isFinite(shown) ? shown : 0);
  const next = Math.max(0, Math.min(MAX_BALANCE, Number((base + delta).toFixed(2))));
  if (delta < 0 && next === base) throw new Error("Balance is already $0.00.");
  mutateDesk((desk) => {
    const book = ensureAccount(userId, desk);
    book.balance = next;
    appendLedger(desk, userId, delta > 0 ? "credit" : "debit", delta, note);
  });
  remember(userId, next);
  let saved = false;
  try {
    await setDoc(doc(db, "users", userId), { balance: next }, { merge: true });
    await setDoc(doc(db, "user_details", userId), { balance: next }, { merge: true });
    saved = true;
  } catch {
    saved = false;
  }
  return { balance: next, saved };
}
