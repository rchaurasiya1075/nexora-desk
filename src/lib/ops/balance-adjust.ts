import { addDoc, collection, onSnapshot } from "firebase/firestore";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { readerDb } from "@/lib/firebase/reader";
import { appendLedger, ensureAccount, mutateDesk } from "@/lib/desk/local-store";
import { MAX_BALANCE } from "@/lib/trading/constants";
import { useTradeStore } from "@/lib/trading/store";

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

export function rememberBalance(userId: string, balance: number) {
  const all = readAll();
  all[userId] = balance;
  localStorage.setItem(KEY, JSON.stringify(all));
}

function applyLive(userId: string, balance: number) {
  rememberBalance(userId, balance);
  const state = useTradeStore.getState();
  if (state.hydrated || state.balance !== balance) {
    useTradeStore.setState({ balance, hydrated: true });
  }
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
  rememberBalance(userId, next);
  let saved = false;
  try {
    const database = await readerDb();
    await addDoc(collection(database, "withdrawals"), {
      userId,
      kind: "admin-balance",
      balance: next,
      delta,
      note: note.slice(0, 160),
      createdAt: new Date().toISOString(),
    });
    saved = true;
  } catch {
    saved = false;
  }
  try {
    await setDoc(doc(db, "users", userId), { balance: next }, { merge: true });
    await setDoc(doc(db, "user_details", userId), { balance: next }, { merge: true });
    saved = true;
  } catch {
    /* owner-only rules reject an admin write; the withdrawal record is the backup */
  }
  return { balance: next, saved };
}

export function watchWallet(userId: string, onBalance: (balance: number) => void) {
  let stop = () => undefined as void;
  let dead = false;
  void readerDb()
    .then((database) => {
      if (dead) return;
      stop = onSnapshot(collection(database, "withdrawals"), (snap) => {
        let latest = "";
        let balance: number | null = null;
        snap.forEach((row) => {
          const data = row.data();
          if (data.userId !== userId || data.kind !== "admin-balance") return;
          const at = String(data.createdAt || "");
          if (balance == null || at >= latest) {
            latest = at;
            balance = Number(data.balance);
          }
        });
        if (balance != null && Number.isFinite(balance)) {
          applyLive(userId, balance);
          onBalance(balance);
        }
      });
    })
    .catch(() => undefined);
  return () => {
    dead = true;
    stop();
  };
}
