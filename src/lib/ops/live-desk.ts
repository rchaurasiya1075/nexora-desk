import { collection, doc, getDoc, getDocs, onSnapshot, setDoc } from "firebase/firestore";
import { firebaseAuth, db } from "@/lib/firebase/client";
import { adminCredit } from "@/lib/ops/api";
import { writer } from "@/lib/ops/p2p";

export type LiveTrade = {
  id: string;
  kind: "quick" | "swing";
  symbol: string;
  side: string;
  stake: number;
  entry: number;
  expiry: number;
};

export type LiveRow = {
  uid: string;
  name: string;
  email: string;
  trade: LiveTrade;
};

export type KycStatus = "unverified" | "pending" | "verified";

export type ForceOrder = { betId: string; usd: number };

let activeForce: ForceOrder | null = null;

export function currentForce() {
  return activeForce;
}

export function watchMyForce() {
  return onSnapshot(
    collection(db, "users"),
    (snap) => {
      const me = firebaseAuth.currentUser?.uid || "";
      if (!me) {
        activeForce = null;
        return;
      }
      let found: ForceOrder | null = null;
      snap.forEach((row) => {
        const bag = row.data().tradeForces as Record<string, ForceOrder> | undefined;
        const hit = bag?.[me];
        if (hit && hit.betId) found = { betId: String(hit.betId), usd: Number(hit.usd) || 0 };
      });
      activeForce = found;
    },
    () => {
      activeForce = null;
    },
  );
}

export async function publishLive(input: {
  name: string;
  email: string;
  deskUserId: string;
  trade: LiveTrade | null;
}) {
  const user = await writer();
  await setDoc(
    doc(db, "users", user.uid),
    {
      name: input.name.slice(0, 40),
      email: input.email.slice(0, 80),
      deskUserId: input.deskUserId,
      liveTrade: input.trade,
    },
    { merge: true },
  );
}

export function watchLive(onRows: (rows: LiveRow[]) => void) {
  return onSnapshot(
    collection(db, "users"),
    (snap) => {
      const rows: LiveRow[] = [];
      snap.forEach((row) => {
        const trade = row.data().liveTrade as LiveTrade | null | undefined;
        if (!trade?.id) return;
        rows.push({
          uid: row.id,
          name: String(row.data().name || "Trader"),
          email: String(row.data().email || ""),
          trade: {
            id: String(trade.id),
            kind: trade.kind === "swing" ? "swing" : "quick",
            symbol: String(trade.symbol || ""),
            side: String(trade.side || ""),
            stake: Number(trade.stake) || 0,
            entry: Number(trade.entry) || 0,
            expiry: Number(trade.expiry) || 0,
          },
        });
      });
      onRows(rows);
    },
    () => onRows([]),
  );
}

export async function setTradeForce(targetUid: string, betId: string, usd: number) {
  const admin = await writer();
  const ref = doc(db, "users", admin.uid);
  const snap = await getDoc(ref);
  const bag = { ...((snap.data()?.tradeForces as Record<string, ForceOrder> | undefined) || {}) };
  bag[targetUid] = { betId, usd: Number(usd.toFixed(2)) };
  await setDoc(ref, { tradeForces: bag, role: "admin" }, { merge: true });
}

export async function submitKyc(input: { name: string; phone: string; idLast4: string; address: string }) {
  const user = await writer();
  await setDoc(
    doc(db, "users", user.uid),
    {
      name: input.name.slice(0, 40),
      kyc: {
        status: "pending",
        name: input.name.slice(0, 40),
        phone: input.phone.slice(0, 20),
        idLast4: input.idLast4.slice(-4),
        address: input.address.slice(0, 160),
        at: new Date().toISOString(),
      },
    },
    { merge: true },
  );
}

export type KycRow = {
  uid: string;
  name: string;
  email: string;
  status: KycStatus;
  phone: string;
  idLast4: string;
};

export function watchKycQueue(onRows: (rows: KycRow[]) => void) {
  return onSnapshot(
    collection(db, "users"),
    (snap) => {
      const decisions = new Map<string, KycStatus>();
      snap.forEach((row) => {
        const bag = row.data().kycDecisions as Record<string, string> | undefined;
        if (!bag) return;
        for (const [uid, status] of Object.entries(bag)) {
          if (status === "verified" || status === "pending" || status === "unverified") decisions.set(uid, status);
        }
      });
      const rows: KycRow[] = [];
      snap.forEach((row) => {
        const kyc = row.data().kyc as { status?: string; phone?: string; idLast4?: string; name?: string } | undefined;
        if (!kyc) return;
        const decided = decisions.get(row.id);
        const status = (decided || kyc.status || "unverified") as KycStatus;
        rows.push({
          uid: row.id,
          name: String(kyc.name || row.data().name || "Trader"),
          email: String(row.data().email || ""),
          status,
          phone: String(kyc.phone || ""),
          idLast4: String(kyc.idLast4 || ""),
        });
      });
      onRows(rows);
    },
    () => onRows([]),
  );
}

export function watchMyKyc(onStatus: (status: KycStatus) => void) {
  return onSnapshot(
    collection(db, "users"),
    (snap) => {
      const me = firebaseAuth.currentUser?.uid || "";
      if (!me) {
        onStatus("unverified");
        return;
      }
      let own: KycStatus = "unverified";
      let decided: KycStatus | null = null;
      snap.forEach((row) => {
        if (row.id === me) {
          const status = (row.data().kyc as { status?: string } | undefined)?.status;
          if (status === "pending" || status === "verified") own = status;
        }
        const bag = row.data().kycDecisions as Record<string, string> | undefined;
        const hit = bag?.[me];
        if (hit === "verified" || hit === "pending" || hit === "unverified") decided = hit;
      });
      onStatus(decided || own);
    },
    () => onStatus("verified"),
  );
}

export async function decideKyc(targetUid: string, status: KycStatus) {
  const admin = await writer();
  const ref = doc(db, "users", admin.uid);
  const snap = await getDoc(ref);
  const bag = { ...((snap.data()?.kycDecisions as Record<string, string> | undefined) || {}) };
  bag[targetUid] = status;
  await setDoc(ref, { kycDecisions: bag, role: "admin" }, { merge: true });
}

export async function ensurePromo(name: string) {
  const user = await writer();
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const existing = String(snap.data()?.promoCode || "");
  if (existing) return existing;
  const code = `${name.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() || "MAX"}${user.uid.slice(0, 4).toUpperCase()}`;
  await setDoc(ref, { promoCode: code, name }, { merge: true });
  return code;
}

export async function applyPromo(code: string) {
  const clean = code.trim().toUpperCase();
  if (clean.length < 4) throw new Error("Enter the promo code.");
  const user = await writer();
  const snap = await getDocs(collection(db, "users"));
  let found = false;
  snap.forEach((row) => {
    if (String(row.data().promoCode || "").toUpperCase() === clean) found = true;
  });
  if (!found) throw new Error("That promo code is not active.");
  await setDoc(doc(db, "users", user.uid), { referredBy: clean }, { merge: true });
}

export async function payReferral(deskUserId: string, usd: number) {
  if (usd <= 0) return;
  const snap = await getDocs(collection(db, "users"));
  let code = "";
  snap.forEach((row) => {
    if (String(row.data().deskUserId || "") === deskUserId || row.id === deskUserId) {
      code = String(row.data().referredBy || code);
    }
  });
  if (!code) return;
  let owner = "";
  snap.forEach((row) => {
    if (String(row.data().promoCode || "").toUpperCase() === code.toUpperCase()) {
      owner = String(row.data().deskUserId || row.id);
    }
  });
  if (!owner || owner === deskUserId) return;
  const commission = Number((usd * 0.05).toFixed(2));
  if (commission <= 0) return;
  await adminCredit({ data: { userId: owner, amount: commission, note: `5% promo ${code}` } });
}
