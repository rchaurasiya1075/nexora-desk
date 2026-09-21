import type {
  AccountStatus,
  CurrencyRow,
  DepositRequest,
  MethodKind,
  PaymentDetails,
  PaymentMethod,
} from "@/lib/ops/types";
import type { AccountBook, LedgerRow } from "@/lib/trading/account-local";

const DESK_KEY = "nexora.desk.v1";
const SESSION_KEY = "nexora.session.v1";

export type LocalUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
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

const listeners = new Set<() => void>();

function seed(): DeskState {
  const methods: PaymentMethod[] = [
    {
      id: 1,
      kind: "upi",
      title: "UPI",
      currency: "INR",
      details: { vpa: "nexora@upi", payee: "Nexora Markets", note: "NEXORA desk" },
      enabled: true,
      sortOrder: 0,
    },
    {
      id: 2,
      kind: "qr",
      title: "UPI QR",
      currency: "INR",
      details: { vpa: "nexora@upi", payee: "Nexora Markets", note: "Scan to pay" },
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
        accountName: "Nexora Markets",
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
        accountName: "Nexora Markets Ltd",
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
  if (typeof window === "undefined") return seed();
  try {
    const raw = window.localStorage.getItem(DESK_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as DeskState;
    if (!parsed || !Array.isArray(parsed.users)) return seed();
    return parsed;
  } catch {
    return seed();
  }
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
    return window.sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setSessionUserId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.sessionStorage.setItem(SESSION_KEY, id);
    else window.sessionStorage.removeItem(SESSION_KEY);
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

export type { AccountStatus, MethodKind, PaymentDetails };
