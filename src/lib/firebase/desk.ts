import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./client";
import { firebaseAuth } from "./client";
import { toUsd } from "@/lib/ops/money";
import type {
  AccountStatus,
  AdminOverview,
  CurrencyRow,
  DepositRequest,
  DeskUser,
  MeOps,
  MethodKind,
  PaymentDetails,
  PaymentMethod,
} from "@/lib/ops/types";
import { MAX_BALANCE, MAX_REQUEST_USD, MIN_REQUEST_USD } from "@/lib/trading/constants";
import type { AccountBook, LedgerRow } from "@/lib/firebase/account-types";

const META = doc(db, "desk", "meta");
const KINDS = new Set<MethodKind>(["upi", "qr", "bank", "swift"]);

function emptyBook(): AccountBook {
  return {
    balance: 0,
    status: "active",
    pricing: "standard",
    selected: "EURUSD",
    positions: [],
    pending: [],
    history: [],
  };
}

const SEED_METHODS: PaymentMethod[] = [
  {
    id: 1,
    kind: "upi",
    title: "UPI",
    currency: "INR",
    details: { vpa: "sikkaaa@upi", payee: "Sikkaaa", note: "Sikkaaa desk" },
    enabled: true,
    sortOrder: 0,
  },
  {
    id: 2,
    kind: "qr",
    title: "UPI QR",
    currency: "INR",
    details: { vpa: "sikkaaa@upi", payee: "Sikkaaa", note: "Scan to pay" },
    enabled: true,
    sortOrder: 1,
  },
  {
    id: 3,
    kind: "bank",
    title: "INR bank transfer",
    currency: "INR",
    details: {
      bankName: "HDFC Bank",
      accountName: "Sikkaaa",
      accountNumber: "50100012345678",
      ifsc: "HDFC0001234",
      branch: "Mumbai",
    },
    enabled: true,
    sortOrder: 2,
  },
  {
    id: 4,
    kind: "swift",
    title: "USD wire / SWIFT",
    currency: "USD",
    details: {
      bankName: "Citibank",
      accountName: "Sikkaaa",
      accountNumber: "409123456789",
      swift: "CITIUS33",
      iban: "US64CITI000000409123456789",
      branch: "New York",
    },
    enabled: true,
    sortOrder: 3,
  },
];

const SEED_CCY: CurrencyRow[] = [
  { code: "USD", name: "US Dollar", symbol: "$", unitsPerUsd: 1, enabled: true, sortOrder: 0 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", unitsPerUsd: 83.5, enabled: true, sortOrder: 1 },
  { code: "EUR", name: "Euro", symbol: "€", unitsPerUsd: 0.92, enabled: true, sortOrder: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", unitsPerUsd: 0.78, enabled: true, sortOrder: 3 },
  { code: "AED", name: "UAE Dirham", symbol: "AED", unitsPerUsd: 3.67, enabled: true, sortOrder: 4 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", unitsPerUsd: 1.52, enabled: true, sortOrder: 5 },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", unitsPerUsd: 1.36, enabled: true, sortOrder: 6 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", unitsPerUsd: 1.35, enabled: true, sortOrder: 7 },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", unitsPerUsd: 7.8, enabled: true, sortOrder: 8 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", unitsPerUsd: 148, enabled: true, sortOrder: 9 },
];

type Meta = {
  seeded?: boolean;
  staff: string[];
  nextMethodId: number;
  nextDepositId: number;
  nextLedgerId: number;
  methods: PaymentMethod[];
  currencies: CurrencyRow[];
};

function asMeta(raw: Record<string, unknown> | undefined): Meta {
  return {
    seeded: Boolean(raw?.seeded),
    staff: Array.isArray(raw?.staff) ? (raw?.staff as string[]) : [],
    nextMethodId: Number(raw?.nextMethodId) || 5,
    nextDepositId: Number(raw?.nextDepositId) || 1,
    nextLedgerId: Number(raw?.nextLedgerId) || 1,
    methods: Array.isArray(raw?.methods) ? (raw?.methods as PaymentMethod[]) : SEED_METHODS,
    currencies: Array.isArray(raw?.currencies) ? (raw?.currencies as CurrencyRow[]) : SEED_CCY,
  };
}

export async function ensureDeskSeeded(): Promise<Meta> {
  const snap = await getDoc(META);
  if (snap.exists() && asMeta(snap.data()).seeded) return asMeta(snap.data());
  const seed: Meta = {
    seeded: true,
    staff: [],
    nextMethodId: 5,
    nextDepositId: 1,
    nextLedgerId: 1,
    methods: SEED_METHODS,
    currencies: SEED_CCY,
  };
  await setDoc(META, seed, { merge: true });
  return seed;
}

export async function ensureTraderProfile(user: User) {
  const name = user.displayName || user.email?.split("@")[0] || "Trader";
  const email = user.email || "";
  const now = new Date().toISOString();
  const profile = {
    name,
    email,
    role: "user",
    status: "active",
    lastLogin: now,
  };
  await setDoc(doc(db, "users", user.uid), profile, { merge: true });
  await setDoc(doc(db, "user_details", user.uid), profile, { merge: true });
  try {
    await ensureDeskSeeded();
    const ref = doc(db, "traders", user.uid);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, { name, email, createdAt: now, lastLogin: now, role: "user" });
      await setDoc(doc(db, "accounts", user.uid), emptyBook());
      return;
    }
    await setDoc(ref, { name, email, lastLogin: now }, { merge: true });
  } catch {
    /* desk collections stay blocked until rules are published */
  }
}

function profileRow(id: string, data: Record<string, unknown>): DeskUser {
  const raw = String(data.status || "active");
  return {
    id,
    name: String(data.name || "Trader"),
    email: String(data.email || ""),
    createdAt: String(data.createdAt || ""),
    lastLogin: data.lastLogin ? String(data.lastLogin) : null,
    balance: Number(data.balance) || 0,
    status: raw === "frozen" || raw === "suspended" ? "frozen" : "active",
    role: data.role === "admin" ? "admin" : "user",
    pendingDeposits: 0,
    openPositions: Number(data.openPositions || data.trades) || 0,
  };
}

function mergeProfile(prev: DeskUser | undefined, next: DeskUser): DeskUser {
  if (!prev) return next;
  return {
    ...prev,
    name: next.name && next.name !== "Trader" ? next.name : prev.name,
    email: next.email || prev.email,
    createdAt: next.createdAt || prev.createdAt,
    lastLogin: next.lastLogin || prev.lastLogin,
    balance: next.balance || prev.balance,
    status: next.status === "frozen" || prev.status === "frozen" ? "frozen" : "active",
    role: next.role === "admin" || prev.role === "admin" ? "admin" : "user",
    openPositions: next.openPositions || prev.openPositions,
    pendingDeposits: next.pendingDeposits || prev.pendingDeposits,
  };
}

/** Reads the Firestore records already in the console: users and user_details. */
export async function listFirestoreProfiles(): Promise<DeskUser[]> {
  const map = new Map<string, DeskUser>();
  const take = (id: string, data: Record<string, unknown>) => {
    if (!id) return;
    map.set(id, mergeProfile(map.get(id), profileRow(id, data)));
  };
  const [usersSnap, detailsSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "user_details")),
  ]);
  usersSnap.forEach((row) => take(row.id, row.data()));
  detailsSnap.forEach((row) => take(row.id, row.data()));
  try {
    const nested = await getDocs(collectionGroup(db, "user_details"));
    nested.forEach((row) => {
      const parent = row.ref.parent.parent?.id;
      take(parent && parent.length > 8 ? parent : row.id, row.data());
    });
  } catch {
    /* top-level collections are enough when the group query is not allowed */
  }
  return [...map.values()];
}

function requireUid() {
  const uid = firebaseAuth.currentUser?.uid;
  if (!uid) throw new Error("Sign in first.");
  return uid;
}

async function loadMeta(): Promise<Meta> {
  return ensureDeskSeeded();
}

function isAdmin(meta: Meta, uid: string) {
  return meta.staff.includes(uid);
}

export async function getMyOps(): Promise<MeOps> {
  const uid = requireUid();
  const meta = await loadMeta();
  return {
    userId: uid,
    isAdmin: isAdmin(meta, uid),
    canClaim: meta.staff.length === 0,
    staffCount: meta.staff.length,
  };
}

export async function claimAdmin(): Promise<MeOps> {
  const uid = requireUid();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(META);
    const meta = asMeta(snap.data());
    if (meta.staff.length === 0) {
      tx.set(META, { staff: [uid], seeded: true }, { merge: true });
      tx.set(doc(db, "traders", uid), { role: "admin" }, { merge: true });
      return;
    }
    if (!meta.staff.includes(uid)) throw new Error("An admin already exists.");
  });
  return getMyOps();
}

function asRequest(id: string, data: Record<string, unknown>): DepositRequest {
  const status =
    data.status === "approved" || data.status === "rejected" || data.status === "completed"
      ? data.status === "completed"
        ? "approved"
        : data.status
      : "pending";
  const numeric = Number(data.id);
  const docNumeric = Number(id);
  const idFromData = Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
  const idFromDoc = Number.isFinite(docNumeric) && String(docNumeric) === id ? docNumeric : 0;
  return {
    id: idFromData || idFromDoc || stableId(id),
    docId: id,
    userId: String(data.userId || ""),
    userName: (data.userName as string) ?? null,
    userEmail: (data.userEmail as string) ?? null,
    methodId: data.methodId == null ? null : Number(data.methodId),
    methodKind: String(data.methodKind || data.paymentMethod || ""),
    methodTitle: String(data.methodTitle || data.paymentMethod || "Deposit"),
    amount: Number(data.amount ?? data.amountLocal) || 0,
    currency: String(data.currency || data.currencyLocal || "USD"),
    usdCredit: Number(data.usdCredit ?? data.amountUSD) || 0,
    payerName: String(data.payerName || ""),
    reference: String(data.reference || data.utrNumber || ""),
    note: (data.note as string) ?? null,
    status,
    adminNote: (data.adminNote as string) ?? null,
    createdAt: String(data.createdAt || ""),
    reviewedAt: (data.reviewedAt as string) ?? null,
  };
}

function stableId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash || 1;
}

export async function syncDepositStatus(
  docId: string,
  action: "approve" | "reject",
  usdCredit?: number,
) {
  await updateDoc(doc(db, "deposits", docId), {
    status: action === "approve" ? "approved" : "rejected",
    reviewedAt: new Date().toISOString(),
    ...(usdCredit != null ? { usdCredit, amountUSD: usdCredit } : {}),
  });
  return {
    ok: true as const,
    status: action === "approve" ? ("approved" as const) : ("rejected" as const),
    usdCredit,
  };
}

export function watchDeposits(
  onRows: (rows: DepositRequest[]) => void,
  onError?: (err: Error) => void,
) {
  if (!firebaseAuth.currentUser) {
    onRows([]);
    onError?.(new Error("permission-denied"));
    return () => undefined;
  }
  return onSnapshot(
    collection(db, "deposits"),
    (snap) => {
      onRows(
        snap.docs
          .map((row) => asRequest(row.id, row.data()))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
    (err) => onError?.(err),
  );
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const uid = requireUid();
  const meta = await loadMeta();
  if (!isAdmin(meta, uid)) throw new Error("Admin only.");
  const traders = await getDocs(collection(db, "traders"));
  const deposits = await getDocs(collection(db, "deposits"));
  const accounts = await getDocs(collection(db, "accounts"));
  const today = new Date().toISOString().slice(0, 10);
  let paperAum = 0;
  accounts.forEach((d) => {
    paperAum += Number(d.data().balance) || 0;
  });
  let pending = 0;
  let approvedToday = 0;
  deposits.forEach((d) => {
    const row = d.data();
    if (row.status === "pending") pending += 1;
    if (row.status === "approved" && String(row.reviewedAt || "").startsWith(today)) {
      approvedToday += 1;
    }
  });
  return { users: traders.size, pending, paperAum, approvedToday };
}

export async function listCurrencies(): Promise<CurrencyRow[]> {
  requireUid();
  const meta = await loadMeta();
  return meta.currencies.slice().sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function listPaymentMethods(input?: { data?: { all?: boolean } } | { all?: boolean }) {
  const uid = requireUid();
  const all =
    input && typeof input === "object" && "data" in input
      ? Boolean((input as { data?: { all?: boolean } }).data?.all)
      : Boolean((input as { all?: boolean } | undefined)?.all);
  const meta = await loadMeta();
  const admin = isAdmin(meta, uid);
  const rows = all && admin ? meta.methods : meta.methods.filter((m) => m.enabled);
  return rows.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

export async function listMyDeposits(): Promise<DepositRequest[]> {
  const uid = requireUid();
  const qy = query(collection(db, "deposits"), where("userId", "==", uid), limit(40));
  const snap = await getDocs(qy);
  return snap.docs
    .map((d) => asRequest(d.id, d.data()))
    .sort((a, b) => b.id - a.id);
}

function dataOf(input?: unknown): Record<string, unknown> {
  if (input && typeof input === "object" && "data" in (input as object)) {
    const inner = (input as { data?: unknown }).data;
    if (inner && typeof inner === "object") return inner as Record<string, unknown>;
  }
  if (input && typeof input === "object") return input as Record<string, unknown>;
  return {};
}

export async function createDepositRequest(input: {
  data?: {
    methodId: number;
    amount: number;
    payerName: string;
    reference: string;
    note?: string;
  };
  methodId?: number;
  amount?: number;
  payerName?: string;
  reference?: string;
  note?: string;
}) {
  const uid = requireUid();
  const payload = dataOf(input);
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount.");
  const payerName = String(payload.payerName || "").trim().slice(0, 80);
  const reference = String(payload.reference || "").trim().slice(0, 80);
  if (payerName.length < 2) throw new Error("Enter the name on the transfer.");
  if (reference.length < 4) throw new Error("Enter UTR / UPI / wire reference.");

  const user = firebaseAuth.currentUser;
  const book = await loadOrCreateAccount(uid);
  if (book.status === "frozen") throw new Error("Account is frozen.");

  const mine = await listMyDeposits();
  if (mine.filter((d) => d.status === "pending").length >= 5) {
    throw new Error("You already have 5 pending requests.");
  }

  const meta = await loadMeta();
  const method = meta.methods.find((m) => m.id === Number(payload.methodId) && m.enabled);
  if (!method) throw new Error("That payment method is off.");
  const ccy = meta.currencies.find((c) => c.code === method.currency && c.enabled);
  if (!ccy) throw new Error("Currency is disabled.");
  const usd = toUsd(amount, ccy.unitsPerUsd);
  if (usd < MIN_REQUEST_USD) throw new Error("Amount is too small.");
  if (usd > MAX_REQUEST_USD) throw new Error("Amount is above the $100,000 request cap.");
  if (book.balance + usd > MAX_BALANCE) throw new Error("This would exceed the wallet cap.");

  const id = await runTransaction(db, async (tx) => {
    const snap = await tx.get(META);
    const m = asMeta(snap.data());
    const nextId = m.nextDepositId || 1;
    tx.set(META, { nextDepositId: nextId + 1, seeded: true }, { merge: true });
    tx.set(doc(db, "deposits", String(nextId)), {
      id: nextId,
      userId: uid,
      userName: user?.displayName || user?.email?.split("@")[0] || "Trader",
      userEmail: user?.email || "",
      methodId: method.id,
      methodKind: method.kind,
      methodTitle: method.title,
      paymentMethod: method.title,
      amount,
      amountLocal: amount,
      currency: method.currency,
      currencyLocal: method.currency,
      usdCredit: usd,
      amountUSD: usd,
      payerName,
      reference,
      utrNumber: reference,
      note: String(payload.note || "").trim().slice(0, 200) || null,
      status: "pending",
      adminNote: null,
      createdAt: new Date().toISOString(),
      reviewedAt: null,
    });
    return nextId;
  });
  return { id, usdCredit: usd };
}

export async function listAllDeposits(input?: { data?: { status?: string } } | { status?: string }) {
  const uid = requireUid();
  const meta = await loadMeta();
  if (!isAdmin(meta, uid)) throw new Error("Admin only.");
  const status = dataOf(input)?.status;
  const snap = await getDocs(query(collection(db, "deposits"), limit(200)));
  const rows = snap.docs.map((d) => asRequest(d.id, d.data()));
  const filtered =
    status === "approved" || status === "rejected" || status === "pending"
      ? rows.filter((d) => d.status === status)
      : rows;
  return filtered.sort((a, b) => b.id - a.id);
}

export async function reviewDeposit(input: {
  data?: { id: number; action: "approve" | "reject"; usdCredit?: number; adminNote?: string };
  id?: number;
  action?: "approve" | "reject";
  usdCredit?: number;
  adminNote?: string;
}) {
  const uid = requireUid();
  const meta = await loadMeta();
  if (!isAdmin(meta, uid)) throw new Error("Admin only.");
  const payload = dataOf(input);
  const docId = String(payload.docId || payload.id || "");
  const ref = doc(db, "deposits", docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Request not found.");
  const row = asRequest(snap.id, snap.data());
  if (row.status !== "pending") throw new Error("Already reviewed.");
  const note = String(payload.adminNote || "").trim().slice(0, 200) || null;

  if (payload.action === "reject") {
    await updateDoc(ref, {
      status: "rejected",
      adminNote: note,
      reviewedAt: new Date().toISOString(),
      adminId: uid,
    });
    return { ok: true as const, status: "rejected" as const };
  }

  const usd =
    payload.usdCredit != null && Number.isFinite(Number(payload.usdCredit))
      ? Number(Number(payload.usdCredit).toFixed(2))
      : row.usdCredit;
  if (usd < MIN_REQUEST_USD) throw new Error("Credit is too small.");
  if (usd > MAX_REQUEST_USD) throw new Error("Credit is above the request cap.");
  await creditUserBalance(row.userId, usd, "deposit", `Approved #${docId} · ${row.currency} ${row.amount}`);
  await updateDoc(ref, {
    status: "approved",
    usdCredit: usd,
    amountUSD: usd,
    adminNote: note,
    reviewedAt: new Date().toISOString(),
    adminId: uid,
  });
  return { ok: true as const, status: "approved" as const, usdCredit: usd };
}

export async function listDeskUsers(): Promise<DeskUser[]> {
  const uid = requireUid();
  const meta = await loadMeta();
  if (!isAdmin(meta, uid)) throw new Error("Admin only.");
  const traders = await getDocs(collection(db, "traders"));
  const deposits = await getDocs(collection(db, "deposits"));
  const pendingByUser = new Map<string, number>();
  deposits.forEach((d) => {
    const row = d.data();
    if (row.status === "pending") {
      const id = String(row.userId || "");
      pendingByUser.set(id, (pendingByUser.get(id) || 0) + 1);
    }
  });
  const rows: DeskUser[] = [];
  for (const t of traders.docs) {
    const data = t.data();
    const acc = await getDoc(doc(db, "accounts", t.id));
    const book = acc.exists() ? (acc.data() as AccountBook) : emptyBook();
    rows.push({
      id: t.id,
      name: String(data.name || "Trader"),
      email: String(data.email || ""),
      createdAt: String(data.createdAt || ""),
      lastLogin: data.lastLogin ? String(data.lastLogin) : null,
      balance: Number(book.balance) || 0,
      status: book.status === "frozen" ? "frozen" : "active",
      role: meta.staff.includes(t.id) ? "admin" : "user",
      pendingDeposits: pendingByUser.get(t.id) || 0,
      openPositions: Array.isArray(book.positions) ? book.positions.length : 0,
    });
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Every signed-in Gmail account. Does not require the viewer to be the Firebase admin. */
export async function listVisibleTraders(): Promise<DeskUser[]> {
  const traders = await getDocs(collection(db, "traders"));
  const rows: DeskUser[] = [];
  for (const t of traders.docs) {
    const data = t.data();
    let balance = 0;
    let status: AccountStatus = "active";
    let openPositions = 0;
    try {
      const acc = await getDoc(doc(db, "accounts", t.id));
      if (acc.exists()) {
        const book = acc.data() as AccountBook;
        balance = Number(book.balance) || 0;
        status = book.status === "frozen" ? "frozen" : "active";
        openPositions = Array.isArray(book.positions) ? book.positions.length : 0;
      }
    } catch {
      /* balance stays hidden until rules allow account reads */
    }
    rows.push({
      id: t.id,
      name: String(data.name || "Trader"),
      email: String(data.email || ""),
      createdAt: String(data.createdAt || ""),
      lastLogin: data.lastLogin ? String(data.lastLogin) : null,
      balance,
      status,
      role: data.role === "admin" ? "admin" : "user",
      pendingDeposits: 0,
      openPositions,
    });
  }
  return rows.sort((a, b) => (b.lastLogin || b.createdAt).localeCompare(a.lastLogin || a.createdAt));
}

export async function adminCredit(input: {
  data?: { userId: string; amount: number; note?: string };
  userId?: string;
  amount?: number;
  note?: string;
}) {
  const uid = requireUid();
  const meta = await loadMeta();
  if (!isAdmin(meta, uid)) throw new Error("Admin only.");
  const payload = dataOf(input);
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount === 0) throw new Error("Enter a non-zero amount.");
  if (Math.abs(amount) > MAX_BALANCE) throw new Error("Amount is too large.");
  const target = String(payload.userId || "").slice(0, 80);
  if (!target) throw new Error("Missing user.");
  const note = String(payload.note || "").trim().slice(0, 200) || "Admin adjustment";
  const balance = await creditUserBalance(
    target,
    Number(amount.toFixed(2)),
    amount > 0 ? "credit" : "debit",
    note,
  );
  return { balance };
}

export async function setUserFrozen(input: {
  data?: { userId: string; frozen: boolean };
  userId?: string;
  frozen?: boolean;
}) {
  const uid = requireUid();
  const meta = await loadMeta();
  if (!isAdmin(meta, uid)) throw new Error("Admin only.");
  const payload = dataOf(input);
  const target = String(payload.userId || "").slice(0, 80);
  const book = await loadOrCreateAccount(target);
  const status: AccountStatus = payload.frozen ? "frozen" : "active";
  await setDoc(doc(db, "accounts", target), { ...book, status }, { merge: true });
  return { status };
}

export async function setUserAdmin(input: {
  data?: { userId: string; admin: boolean };
  userId?: string;
  admin?: boolean;
}) {
  const uid = requireUid();
  const meta = await loadMeta();
  if (!isAdmin(meta, uid)) throw new Error("Admin only.");
  const payload = dataOf(input);
  const target = String(payload.userId || "").slice(0, 80);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(META);
    const m = asMeta(snap.data());
    let staff = [...m.staff];
    if (payload.admin) {
      if (!staff.includes(target)) staff.push(target);
    } else {
      if (target === uid) throw new Error("You cannot demote yourself.");
      if (staff.length <= 1) throw new Error("Keep at least one admin.");
      staff = staff.filter((id) => id !== target);
    }
    tx.set(META, { staff }, { merge: true });
    tx.set(doc(db, "traders", target), { role: payload.admin ? "admin" : "user" }, { merge: true });
  });
  return { role: payload.admin ? ("admin" as const) : ("user" as const) };
}

export async function saveCurrency(input: {
  data?: { code: string; name: string; symbol: string; unitsPerUsd: number; enabled: boolean };
  code?: string;
  name?: string;
  symbol?: string;
  unitsPerUsd?: number;
  enabled?: boolean;
}) {
  const uid = requireUid();
  const meta0 = await loadMeta();
  if (!isAdmin(meta0, uid)) throw new Error("Admin only.");
  const payload = dataOf(input);
  const code = String(payload.code || "").trim().toUpperCase().slice(0, 8);
  if (!/^[A-Z]{3,8}$/.test(code)) throw new Error("Use a 3–8 letter currency code.");
  const name = String(payload.name || "").trim().slice(0, 40) || code;
  const symbol = String(payload.symbol || "").trim().slice(0, 8) || code;
  const units = Number(payload.unitsPerUsd);
  if (!Number.isFinite(units) || units <= 0) throw new Error("Rate must be greater than 0.");
  const enabled = Boolean(payload.enabled);
  const currencies = [...meta0.currencies];
  const existing = currencies.find((c) => c.code === code);
  if (existing) {
    existing.name = name;
    existing.symbol = symbol;
    existing.unitsPerUsd = units;
    existing.enabled = enabled;
  } else {
    currencies.push({
      code,
      name,
      symbol,
      unitsPerUsd: units,
      enabled,
      sortOrder: currencies.length,
    });
  }
  await setDoc(META, { currencies }, { merge: true });
  return { ok: true as const };
}

export async function savePaymentMethod(input: {
  data?: {
    id?: number;
    kind: MethodKind;
    title: string;
    currency: string;
    details: PaymentDetails;
    enabled: boolean;
  };
} & Partial<{
  id: number;
  kind: MethodKind;
  title: string;
  currency: string;
  details: PaymentDetails;
  enabled: boolean;
}>) {
  const uid = requireUid();
  const meta0 = await loadMeta();
  if (!isAdmin(meta0, uid)) throw new Error("Admin only.");
  const payload = dataOf(input);
  const kind = payload.kind as MethodKind;
  if (!KINDS.has(kind)) throw new Error("Unknown method type.");
  const title = String(payload.title || "").trim().slice(0, 60);
  if (title.length < 2) throw new Error("Give the method a name.");
  const currency = String(payload.currency || "USD").trim().toUpperCase().slice(0, 8);
  const details = (payload.details ?? {}) as PaymentDetails;
  const enabled = Boolean(payload.enabled);
  let id = Number(payload.id) || 0;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(META);
    const m = asMeta(snap.data());
    const methods = [...m.methods];
    if (payload.id) {
      const row = methods.find((x) => x.id === Number(payload.id));
      if (!row) throw new Error("Method not found.");
      row.kind = kind;
      row.title = title;
      row.currency = currency;
      row.details = details;
      row.enabled = enabled;
      id = row.id;
      tx.set(META, { methods }, { merge: true });
      return;
    }
    id = Number(m.nextMethodId) || methods.length + 1;
    methods.push({
      id,
      kind,
      title,
      currency,
      details,
      enabled,
      sortOrder: methods.length,
    });
    tx.set(META, { methods, nextMethodId: id + 1 }, { merge: true });
  });
  return { id };
}

export async function deletePaymentMethod(input: { data: number } | number) {
  const uid = requireUid();
  const meta0 = await loadMeta();
  if (!isAdmin(meta0, uid)) throw new Error("Admin only.");
  const raw =
    input && typeof input === "object" && "data" in (input as object)
      ? (input as { data: unknown }).data
      : input;
  const id = Number(raw);
  const methods = meta0.methods.filter((m) => m.id !== id);
  await setDoc(META, { methods }, { merge: true });
  return { ok: true as const };
}

export async function loadOrCreateAccount(userId: string): Promise<AccountBook> {
  const ref = doc(db, "accounts", userId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const d = snap.data();
    return {
      balance: Number(d.balance) || 0,
      status: d.status === "frozen" ? "frozen" : "active",
      pricing: d.pricing === "raw" ? "raw" : "standard",
      selected: String(d.selected || "EURUSD"),
      positions: Array.isArray(d.positions) ? d.positions : [],
      pending: Array.isArray(d.pending) ? d.pending : [],
      history: Array.isArray(d.history) ? d.history : [],
    };
  }
  const book = emptyBook();
  await setDoc(ref, book);
  return book;
}

export async function creditUserBalance(
  userId: string,
  amount: number,
  kind: string,
  note: string,
): Promise<number> {
  const book = await loadOrCreateAccount(userId);
  const next = Math.max(0, Math.min(MAX_BALANCE, Number((book.balance + amount).toFixed(2))));
  await setDoc(doc(db, "accounts", userId), { ...book, balance: next }, { merge: true });
  const meta = await loadMeta();
  const id = meta.nextLedgerId || 1;
  await setDoc(doc(db, "ledgers", userId, "entries", String(id)), {
    id,
    kind,
    amount,
    note,
    createdAt: new Date().toISOString(),
  });
  await setDoc(META, { nextLedgerId: id + 1 }, { merge: true });
  return next;
}

export async function loadAccount(): Promise<AccountBook> {
  return loadOrCreateAccount(requireUid());
}

export async function listLedger(): Promise<LedgerRow[]> {
  const uid = requireUid();
  const snap = await getDocs(collection(db, "ledgers", uid, "entries"));
  return snap.docs
    .map((d) => {
      const r = d.data();
      return {
        id: Number(r.id) || Number(d.id),
        kind: String(r.kind || ""),
        amount: Number(r.amount) || 0,
        note: (r.note as string) ?? null,
        createdAt: String(r.createdAt || ""),
      };
    })
    .sort((a, b) => b.id - a.id)
    .slice(0, 40);
}

export async function saveBook(input: { data: AccountBook } | AccountBook) {
  const uid = requireUid();
  const book = "data" in input ? input.data : input;
  const current = await loadOrCreateAccount(uid);
  const next: AccountBook = {
    balance: Math.max(0, Math.min(MAX_BALANCE, Number(book.balance) || 0)),
    status: current.status,
    pricing: book.pricing === "raw" ? "raw" : "standard",
    selected: String(book.selected || "EURUSD").slice(0, 16),
    positions: book.positions ?? [],
    pending: book.pending ?? [],
    history: (book.history ?? []).slice(0, 80),
  };
  await setDoc(doc(db, "accounts", uid), next);
  return { ok: true as const, status: current.status };
}


