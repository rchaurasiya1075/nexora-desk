import { addDoc, collection, doc, getDocs, onSnapshot, updateDoc } from "firebase/firestore";
import { db, firebaseAuth } from "@/lib/firebase/client";
import { readerDb } from "@/lib/firebase/reader";
import { adjustUserBalance, balanceOverride } from "@/lib/ops/balance-adjust";
import type { DepositStatus } from "@/lib/ops/types";

const KEY = "sikkaaa.deposit.reviews.v1";
const PAID = "sikkaaa.deposit.paid.v1";
const listeners = new Set<() => void>();

function readMap(key: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "{}") as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function readReviews(): Record<string, DepositStatus> {
  const out: Record<string, DepositStatus> = {};
  for (const [id, status] of Object.entries(readMap(KEY))) {
    if (status === "approved" || status === "rejected") out[id] = status;
  }
  return out;
}

export function subscribeReviews(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function remember(id: string, status: DepositStatus) {
  const all = readMap(KEY);
  all[id] = status;
  localStorage.setItem(KEY, JSON.stringify(all));
  listeners.forEach((fn) => fn());
}

export async function loadReviews(userId?: string) {
  const reviews = readReviews();
  try {
    const database = firebaseAuth.currentUser ? db : await readerDb();
    const snap = await getDocs(collection(database, "withdrawals"));
    snap.forEach((row) => {
      const data = row.data();
      if (data.kind !== "deposit-review" || !data.depositId) return;
      if (userId && data.userId && data.userId !== userId) return;
      if (data.status === "approved" || data.status === "rejected") reviews[String(data.depositId)] = data.status;
    });
  } catch {
    /* local reviews still apply */
  }
  return reviews;
}

export function applyReviews<T extends { docId?: string; id: number; status: DepositStatus }>(
  rows: T[],
  reviews: Record<string, DepositStatus>,
) {
  return rows.map((row) => {
    const status = reviews[row.docId || ""] || reviews[String(row.id)];
    return status ? { ...row, status } : row;
  });
}

export function watchDepositReviews(onRows: (reviews: Record<string, DepositStatus>) => void) {
  let stop = () => undefined as void;
  let dead = false;
  const source = firebaseAuth.currentUser ? Promise.resolve(db) : readerDb();
  void source
    .then((database) => {
      if (dead) return;
      stop = onSnapshot(
        collection(database, "withdrawals"),
        (snap) => {
          const reviews = readReviews();
          snap.forEach((row) => {
            const data = row.data();
            if (data.kind !== "deposit-review" || !data.depositId) return;
            if (data.status === "approved" || data.status === "rejected") reviews[String(data.depositId)] = data.status;
          });
          onRows(reviews);
        },
        () => onRows(readReviews()),
      );
    })
    .catch(() => onRows(readReviews()));
  return () => {
    dead = true;
    stop();
  };
}

export async function settleDeposit(input: {
  docId?: string;
  id: number;
  userId: string;
  action: "approve" | "reject";
  usdCredit?: number;
  note?: string;
}) {
  const key = input.docId || String(input.id);
  const status: DepositStatus = input.action === "approve" ? "approved" : "rejected";
  if (input.action === "approve") {
    const usd = Number(input.usdCredit) || 0;
    if (usd <= 0) throw new Error("Credit amount is missing.");
    const paid = readMap(PAID);
    if (!paid[key]) {
      await adjustUserBalance(input.userId, usd, input.note || "Deposit approved", balanceOverride(input.userId) ?? undefined);
      paid[key] = "1";
      localStorage.setItem(PAID, JSON.stringify(paid));
    }
  }
  remember(key, status);
  if (input.docId && !/^\d+$/.test(input.docId)) {
    const database = firebaseAuth.currentUser ? db : await readerDb();
    try {
      await updateDoc(doc(database, "deposits", input.docId), {
        status,
        reviewedAt: new Date().toISOString(),
        ...(input.usdCredit != null ? { usdCredit: input.usdCredit, amountUSD: input.usdCredit } : {}),
      });
    } catch {
      /* rules often block deposit updates */
    }
    try {
      await addDoc(collection(database, "withdrawals"), {
        kind: "deposit-review",
        depositId: input.docId,
        userId: input.userId,
        status,
        createdAt: new Date().toISOString(),
      });
    } catch {
      /* this admin login still remembers the decision */
    }
  }
  return { ok: true as const, status };
}
