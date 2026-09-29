import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { db, firebaseAuth } from "@/lib/firebase/client";
import { setAuthHold } from "@/lib/firebase/session";
import { DESK_BANK, DESK_CRYPTO } from "@/lib/ops/rails";

export type PayDesk = {
  holder: string;
  bank: string;
  number: string;
  ifsc: string;
  upi: string;
  cryptoAsset: string;
  cryptoNetwork: string;
  cryptoAddress: string;
  upiQr: string;
  cryptoQr: string;
  cryptoLink: string;
  footer: string;
  eventTitle: string;
  eventText: string;
  eventImage: string;
};

export type ChatLine = {
  id: string;
  from: "user" | "admin";
  text: string;
  at: string;
};

export type ChatThread = {
  userId: string;
  name: string;
  email: string;
  lines: ChatLine[];
};

export const EMPTY_PAY: PayDesk = {
  holder: DESK_BANK.holder,
  bank: DESK_BANK.bank,
  number: DESK_BANK.number,
  ifsc: DESK_BANK.ifsc,
  upi: "sikkaaa@upi",
  cryptoAsset: DESK_CRYPTO.asset,
  cryptoNetwork: DESK_CRYPTO.network,
  cryptoAddress: DESK_CRYPTO.address,
  upiQr: "",
  cryptoQr: "",
  cryptoLink: "",
  footer: "",
  eventTitle: "",
  eventText: "",
  eventImage: "",
};

function asPay(raw: unknown): PayDesk | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<PayDesk>;
  if (!row.number && !row.cryptoAddress && !row.upi) return null;
  return {
    holder: String(row.holder || EMPTY_PAY.holder),
    bank: String(row.bank || EMPTY_PAY.bank),
    number: String(row.number || EMPTY_PAY.number),
    ifsc: String(row.ifsc || EMPTY_PAY.ifsc),
    upi: String(row.upi || EMPTY_PAY.upi),
    cryptoAsset: String(row.cryptoAsset || EMPTY_PAY.cryptoAsset),
    cryptoNetwork: String(row.cryptoNetwork || EMPTY_PAY.cryptoNetwork),
    cryptoAddress: String(row.cryptoAddress || EMPTY_PAY.cryptoAddress),
    upiQr: String(row.upiQr || ""),
    cryptoQr: String(row.cryptoQr || ""),
    cryptoLink: String(row.cryptoLink || ""),
    footer: String(row.footer || ""),
    eventTitle: String(row.eventTitle || ""),
    eventText: String(row.eventText || ""),
    eventImage: String(row.eventImage || ""),
  };
}

function asLines(raw: unknown): ChatLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const line = row as Partial<ChatLine>;
      if (!line.text || (line.from !== "user" && line.from !== "admin")) return null;
      return {
        id: String(line.id || Math.random().toString(36).slice(2)),
        from: line.from,
        text: String(line.text).slice(0, 500),
        at: String(line.at || ""),
      };
    })
    .filter((row): row is ChatLine => !!row);
}

export async function writer() {
  if (firebaseAuth.currentUser) return firebaseAuth.currentUser;
  setAuthHold(true);
  try {
    const cred = await signInAnonymously(firebaseAuth);
    return cred.user;
  } finally {
    setAuthHold(false);
  }
}

export function watchPayDesk(onPay: (pay: PayDesk) => void) {
  return onSnapshot(collection(db, "users"), (snap) => {
    let found: PayDesk | null = null;
    snap.forEach((row) => {
      const pay = asPay(row.data().paymentDesk);
      if (pay) found = pay;
    });
    onPay(found || EMPTY_PAY);
  }, () => onPay(EMPTY_PAY));
}

export async function savePayDesk(pay: PayDesk) {
  const user = await writer();
  await setDoc(doc(db, "users", user.uid), { paymentDesk: pay, role: "admin" }, { merge: true });
}

export async function sendUserLine(input: { name: string; email: string; userId: string; text: string }) {
  const text = input.text.trim().slice(0, 500);
  if (!text) return;
  const user = await writer();
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const prev = asLines(snap.data()?.p2p);
  const line: ChatLine = {
    id: `m${Date.now().toString(36)}`,
    from: "user",
    text,
    at: new Date().toISOString(),
  };
  await setDoc(
    ref,
    {
      name: input.name.slice(0, 40),
      email: input.email.slice(0, 80),
      deskUserId: input.userId,
      p2p: [...prev, line].slice(-40),
    },
    { merge: true },
  );
}

export function watchThreads(onThreads: (rows: ChatThread[]) => void) {
  return onSnapshot(collection(db, "users"), (snap) => {
    const replies = new Map<string, ChatLine[]>();
    snap.forEach((row) => {
      const bag = row.data().paymentReplies as Record<string, unknown> | undefined;
      if (!bag) return;
      for (const [userId, lines] of Object.entries(bag)) {
        replies.set(userId, asLines(lines));
      }
    });
    const threads: ChatThread[] = [];
    snap.forEach((row) => {
      const own = asLines(row.data().p2p);
      const extra = replies.get(row.id) || [];
      const lines = [...own, ...extra].sort((a, b) => a.at.localeCompare(b.at));
      if (!lines.length) return;
      threads.push({
        userId: row.id,
        name: String(row.data().name || "Trader"),
        email: String(row.data().email || row.data().deskUserId || ""),
        lines,
      });
    });
    threads.sort((a, b) => (b.lines.at(-1)?.at || "").localeCompare(a.lines.at(-1)?.at || ""));
    onThreads(threads);
  }, () => onThreads([]));
}

export function watchMyThread(onLines: (rows: ChatLine[]) => void) {
  const uid = () => firebaseAuth.currentUser?.uid || "";
  return onSnapshot(collection(db, "users"), (snap) => {
    const me = uid();
    if (!me) {
      onLines([]);
      return;
    }
    let own: ChatLine[] = [];
    let extra: ChatLine[] = [];
    snap.forEach((row) => {
      if (row.id === me) own = asLines(row.data().p2p);
      const bag = row.data().paymentReplies as Record<string, unknown> | undefined;
      if (bag?.[me]) extra = extra.concat(asLines(bag[me]));
    });
    onLines([...own, ...extra].sort((a, b) => a.at.localeCompare(b.at)));
  }, () => onLines([]));
}

export async function replyToUser(userId: string, text: string) {
  const clean = text.trim().slice(0, 500);
  if (!clean) return;
  const user = await writer();
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const bag = (snap.data()?.paymentReplies as Record<string, ChatLine[]> | undefined) || {};
  const line: ChatLine = {
    id: `a${Date.now().toString(36)}`,
    from: "admin",
    text: clean,
    at: new Date().toISOString(),
  };
  bag[userId] = [...asLines(bag[userId]), line].slice(-40);
  await setDoc(ref, { paymentReplies: bag, role: "admin" }, { merge: true });
}
