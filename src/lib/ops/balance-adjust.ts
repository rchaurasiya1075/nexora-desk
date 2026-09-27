import { addDoc, collection, onSnapshot } from "firebase/firestore";
import { doc, setDoc } from "firebase/firestore";
import { db, firebaseAuth } from "@/lib/firebase/client";
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
    const database = firebaseAuth.currentUser ? db : await readerDb();
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

const CURSOR = "sikkaaa.wallet.cursor.v2";

type Cursor = { at: string; adminBalance: number };

function readCursor(userId: string): Cursor | null {
  if (typeof window === "undefined") return null;
  try {
    const all = JSON.parse(localStorage.getItem(CURSOR) || "{}") as Record<string, Cursor>;
    const row = all[userId];
    if (!row || typeof row.adminBalance !== "number") return null;
    return row;
  } catch {
    return null;
  }
}

function writeCursor(userId: string, cursor: Cursor) {
  const all = JSON.parse(localStorage.getItem(CURSOR) || "{}") as Record<string, Cursor>;
  all[userId] = cursor;
  localStorage.setItem(CURSOR, JSON.stringify(all));
}

export function watchWallet(userId: string, onBalance?: (balance: number) => void) {
  let stop = () => undefined as void;
  let dead = false;
  const source = firebaseAuth.currentUser ? Promise.resolve(db) : readerDb();
  void source
    .then((database) => {
      if (dead) return;
      stop = onSnapshot(
        collection(database, "withdrawals"),
        (snap) => {
          let latest = "";
          let adminBalance: number | null = null;
          snap.forEach((row) => {
            const data = row.data();
            if (data.userId !== userId || data.kind !== "admin-balance") return;
            const at = String(data.createdAt || "");
            if (adminBalance == null || at >= latest) {
              latest = at;
              adminBalance = Number(data.balance);
            }
          });
          if (adminBalance == null || !Number.isFinite(adminBalance)) return;
          const cursor = readCursor(userId);
          if (!cursor) {
            const state = useTradeStore.getState();
            const untouched =
              state.balance === 0 &&
              state.positions.length === 0 &&
              state.pending.length === 0 &&
              state.history.length === 0;
            if (untouched) useTradeStore.setState({ balance: adminBalance, hydrated: true });
            writeCursor(userId, { at: latest, adminBalance });
            rememberBalance(userId, adminBalance);
            onBalance?.(useTradeStore.getState().balance);
            return;
          }
          if (latest <= cursor.at && adminBalance === cursor.adminBalance) return;
          const delta = Number((adminBalance - cursor.adminBalance).toFixed(2));
          writeCursor(userId, { at: latest, adminBalance });
          rememberBalance(userId, adminBalance);
          if (delta !== 0) useTradeStore.getState().adjustCash(delta);
          onBalance?.(useTradeStore.getState().balance);
        },
        () => undefined,
      );
    })
    .catch(() => undefined);
  return () => {
    dead = true;
    stop();
  };
}
