import type {
  AccountStatus,
  CurrencyRow,
  DepositRequest,
  MethodKind,
  PaymentDetails,
  PaymentMethod,
} from "@/lib/ops/types";
import type { AccountBook, LedgerRow } from "@/lib/firebase/account-types";

const DESK_KEY = "nexora.desk.v1";
const SESSION_KEY = "nexora.session.v1";

export type LocalUser = {
  id: string;
  name: string;
  email: string;
  username?: string;
  passwordHash: string;
  createdAt: string;
  lastLogin?: string;
};

export type DeskState = {
  users: LocalUser[];
  staff: string[];
  currencies: CurrencyRow[];
  methods: PaymentMethod[];
  deposits: DepositRequest[];
  accounts: Record<string, AccountBook>;
  ledger: Record<string, LedgerRow[]>;
  nextMethodId: number;
  nextDepositId: number;
  nextLedgerId: number;
};

const ADMIN_ID = "admin_yuvraj1075";
const ADMIN_USER = "yuvraj1075";
const ADMIN_HASH = "cc158eff12c32971a0b518858c09908034b032da4c8db5768001574e7f59f886";

const listeners = new Set<() => void>();

function ensureAdmin(desk: DeskState) {
  let user = desk.users.find(
    (u) => u.id === ADMIN_ID || u.username === ADMIN_USER || u.email === ADMIN_USER,
  );
  if (!user) {
    user = {
      id: ADMIN_ID,
      name: "Yuvraj",
      email: ADMIN_USER,
      username: ADMIN_USER,
      passwordHash: ADMIN_HASH,
      createdAt: "2026-09-22T00:00:00.000Z",
    };
    desk.users.unshift(user);
  } else {
    user.id = user.id || ADMIN_ID;
    user.username = ADMIN_USER;
    user.passwordHash = ADMIN_HASH;
    user.name = user.name || "Yuvraj";
  }
  if (!desk.staff.includes(user.id)) desk.staff.unshift(user.id);
  if (!desk.accounts[user.id]) desk.accounts[user.id] = emptyBook();
}

function seed(): DeskState {
  const methods: PaymentMethod[] = [
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
  return {
    users: [],
    staff: [],
    currencies: [
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
    ],
    methods,
    deposits: [],
    accounts: {},
    ledger: {},
    nextMethodId: 5,
    nextDepositId: 1,
    nextLedgerId: 1,
  };
}

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

export function loadDesk(): DeskState {
  if (typeof window === "undefined") {
    const fresh = seed();
    ensureAdmin(fresh);
    return fresh;
  }
  let desk = seed();
  let stored = "";
  try {
    stored = window.localStorage.getItem(DESK_KEY) || "";
    if (stored) {
      const parsed = JSON.parse(stored) as DeskState;
      if (parsed && Array.isArray(parsed.users)) desk = parsed;
    }
  } catch {
    desk = seed();
  }
  ensureAdmin(desk);
  if (!stored.includes(ADMIN_ID)) saveDesk(desk);
  return desk;
}

export function saveDesk(next: DeskState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DESK_KEY, JSON.stringify(next));
  listeners.forEach((fn) => fn());
}

export function mutateDesk(fn: (desk: DeskState) => void): DeskState {
  const desk = loadDesk();
  fn(desk);
  saveDesk(desk);
  return desk;
}

export function subscribeDesk(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function ensureAccount(userId: string, desk = loadDesk()): AccountBook {
  if (!desk.accounts[userId]) desk.accounts[userId] = emptyBook();
  return desk.accounts[userId];
}

export function appendLedger(
  desk: DeskState,
  userId: string,
  kind: string,
  amount: number,
  note: string | null,
) {
  const id = desk.nextLedgerId++;
  const row: LedgerRow = {
    id,
    kind,
    amount,
    note,
    createdAt: new Date().toISOString(),
  };
  desk.ledger[userId] = [row, ...(desk.ledger[userId] ?? [])].slice(0, 40);
}

export async function hashPassword(password: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`nexora:${password}`));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getSessionUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      window.localStorage.getItem(SESSION_KEY) ||
      window.sessionStorage.getItem(SESSION_KEY)
    );
  } catch {
    return null;
  }
}

export function setSessionUserId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) {
      window.localStorage.setItem(SESSION_KEY, id);
      window.sessionStorage.setItem(SESSION_KEY, id);
    } else {
      window.localStorage.removeItem(SESSION_KEY);
      window.sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
}

export function getSessionUser(): LocalUser | null {
  const id = getSessionUserId();
  if (!id) return null;
  return loadDesk().users.find((u) => u.id === id) ?? null;
}

export function requireUser(): LocalUser {
  const user = getSessionUser();
  if (!user) throw new Error("Sign in first.");
  return user;
}

export function requireAdmin(): LocalUser {
  const user = requireUser();
  const desk = loadDesk();
  if (!desk.staff.includes(user.id)) throw new Error("Admin only.");
  return user;
}

export function uid(prefix = "u") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export async function localRegister(
  email: string,
  password: string,
  name?: string,
): Promise<LocalUser> {
  const em = email.trim().toLowerCase();
  if (!em.includes("@")) throw new Error("Enter a valid email.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");
  const hash = await hashPassword(password);
  const label = (name || em.split("@")[0] || "Trader").slice(0, 40);
  const created: LocalUser = {
    id: uid("u"),
    name: label,
    email: em,
    passwordHash: hash,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };
  mutateDesk((desk) => {
    if (
      desk.users.some(
        (u) => u.email === em || u.username === em || em === ADMIN_USER,
      )
    ) {
      throw new Error("That email is already registered.");
    }
    desk.users.push(created);
    ensureAccount(created.id, desk);
  });
  setSessionUserId(created.id);
  return created;
}

export async function localLogin(email: string, password: string): Promise<LocalUser> {
  const key = email.trim().toLowerCase();
  const hash = await hashPassword(password);
  const desk = loadDesk();
  const user = desk.users.find(
    (u) => u.email === key || u.username === key,
  );
  if (!user || user.passwordHash !== hash) throw new Error("User id or password is wrong.");
  const at = new Date().toISOString();
  mutateDesk((desk) => {
    const row = desk.users.find((u) => u.id === user.id);
    if (row) row.lastLogin = at;
  });
  user.lastLogin = at;
  setSessionUserId(user.id);
  return user;
}

export async function localChangePassword(current: string, next: string) {
  const user = getSessionUser();
  if (!user) throw new Error("Sign in first.");
  if (next.length < 6) throw new Error("Password must be at least 6 characters.");
  const currentHash = await hashPassword(current);
  if (user.passwordHash !== currentHash) throw new Error("Current password is wrong.");
  const nextHash = await hashPassword(next);
  mutateDesk((desk) => {
    const row = desk.users.find((u) => u.id === user.id);
    if (row) row.passwordHash = nextHash;
  });
}

export function localSignOut() {
  setSessionUserId(null);
}

export type { AccountStatus, MethodKind, PaymentDetails };
