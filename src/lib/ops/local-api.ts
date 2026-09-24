import { toUsd } from "@/lib/ops/money";
import type {
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
import { creditLocal } from "@/lib/trading/account-local";
import {
  ensureAccount,
  loadDesk,
  mutateDesk,
  requireAdmin,
  requireUser,
} from "@/lib/desk/local-store";

const KINDS = new Set<MethodKind>(["upi", "qr", "bank", "swift"]);

function dataOf<T>(input?: { data?: T } | T): T {
  if (input && typeof input === "object" && "data" in (input as object)) {
    return ((input as { data?: T }).data ?? ({} as T));
  }
  return (input ?? ({} as T)) as T;
}

export async function getMyOps(): Promise<MeOps> {
  const user = requireUser();
  const desk = loadDesk();
  return {
    userId: user.id,
    isAdmin: desk.staff.includes(user.id),
    canClaim: desk.staff.length === 0,
    staffCount: desk.staff.length,
  };
}

export async function claimAdmin(): Promise<MeOps> {
  const user = requireUser();
  mutateDesk((desk) => {
    if (desk.staff.length === 0) desk.staff.push(user.id);
    else if (!desk.staff.includes(user.id)) throw new Error("An admin already exists.");
  });
  return getMyOps();
}

export async function getAdminOverview(): Promise<AdminOverview> {
  requireAdmin();
  const desk = loadDesk();
  const today = new Date().toISOString().slice(0, 10);
  return {
    users: desk.users.length,
    pending: desk.deposits.filter((d) => d.status === "pending").length,
    paperAum: Object.values(desk.accounts).reduce((n, a) => n + (a.balance || 0), 0),
    approvedToday: desk.deposits.filter(
      (d) => d.status === "approved" && (d.reviewedAt || "").startsWith(today),
    ).length,
  };
}

export async function listCurrencies(): Promise<CurrencyRow[]> {
  requireUser();
  return loadDesk().currencies.slice().sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function listPaymentMethods(input?: { data?: { all?: boolean } }) {
  const user = requireUser();
  const all = Boolean(dataOf(input)?.all);
  const desk = loadDesk();
  const admin = desk.staff.includes(user.id);
  const rows = all && admin ? desk.methods : desk.methods.filter((m) => m.enabled);
  return rows.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

export async function listMyDeposits(): Promise<DepositRequest[]> {
  const user = requireUser();
  return loadDesk()
    .deposits.filter((d) => d.userId === user.id)
    .slice()
    .sort((a, b) => b.id - a.id)
    .slice(0, 40);
}

export async function createDepositRequest(input: {
  data: { methodId: number; amount: number; payerName: string; reference: string; note?: string };
}) {
  const user = requireUser();
  const payload = dataOf(input);
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount.");
  const payerName = String(payload.payerName || "").trim().slice(0, 80);
  const reference = String(payload.reference || "").trim().slice(0, 80);
  if (payerName.length < 2) throw new Error("Enter the name on the transfer.");
  if (reference.length < 4) throw new Error("Enter UTR / UPI / wire reference.");

  let usd = 0;
  let id = 0;
  mutateDesk((desk) => {
    const book = ensureAccount(user.id, desk);
    if (book.status === "frozen") throw new Error("Account is frozen.");
    const pending = desk.deposits.filter((d) => d.userId === user.id && d.status === "pending");
    if (pending.length >= 5) throw new Error("You already have 5 pending requests.");
    const method = desk.methods.find((m) => m.id === Number(payload.methodId) && m.enabled);
    if (!method) throw new Error("That payment method is off.");
    const ccy = desk.currencies.find((c) => c.code === method.currency && c.enabled);
    if (!ccy) throw new Error("Currency is disabled.");
    usd = toUsd(amount, ccy.unitsPerUsd);
    if (usd < MIN_REQUEST_USD) throw new Error("Amount is too small.");
    if (usd > MAX_REQUEST_USD) throw new Error("Amount is above the $100,000 request cap.");
    if (book.balance + usd > MAX_BALANCE) throw new Error("This would exceed the wallet cap.");
    id = desk.nextDepositId++;
    desk.deposits.unshift({
      id,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      methodId: method.id,
      methodKind: method.kind,
      methodTitle: method.title,
      amount,
      currency: method.currency,
      usdCredit: usd,
      payerName,
      reference,
      note: String(payload.note || "").trim().slice(0, 200) || null,
      status: "pending",
      adminNote: null,
      createdAt: new Date().toISOString(),
      reviewedAt: null,
    });
  });
  return { id, usdCredit: usd };
}

export async function listAllDeposits(input?: { data?: { status?: string } }) {
  requireAdmin();
  const status = dataOf(input)?.status;
  const rows = loadDesk().deposits;
  const filtered =
    status === "approved" || status === "rejected" || status === "pending"
      ? rows.filter((d) => d.status === status)
      : rows;
  return filtered.slice().sort((a, b) => b.id - a.id).slice(0, 200);
}

export async function reviewDeposit(input: {
  data: { id: number; docId?: string; action: "approve" | "reject"; usdCredit?: number; adminNote?: string };
}) {
  const admin = requireAdmin();
  const payload = dataOf(input);
  const id = Number(payload.id);
  const desk0 = loadDesk();
  const row = desk0.deposits.find((d) => d.id === id);
  if (!row) throw new Error("Request not found.");
  if (row.status !== "pending") throw new Error("Already reviewed.");
  const note = String(payload.adminNote || "").trim().slice(0, 200) || null;

  if (payload.action === "reject") {
    mutateDesk((desk) => {
      const d = desk.deposits.find((x) => x.id === id);
      if (!d) return;
      d.status = "rejected";
      d.adminNote = note;
      d.reviewedAt = new Date().toISOString();
    });
    return { ok: true as const, status: "rejected" as const };
  }

  const usd =
    payload.usdCredit != null && Number.isFinite(Number(payload.usdCredit))
      ? Number(Number(payload.usdCredit).toFixed(2))
      : row.usdCredit;
  if (usd < MIN_REQUEST_USD) throw new Error("Credit is too small.");
  if (usd > MAX_REQUEST_USD) throw new Error("Credit is above the request cap.");
  creditLocal(row.userId, usd, "deposit", `Approved #${id} · ${row.currency} ${row.amount}`);
  mutateDesk((desk) => {
    const d = desk.deposits.find((x) => x.id === id);
    if (!d) return;
    d.status = "approved";
    d.usdCredit = usd;
    d.adminNote = note;
    d.reviewedAt = new Date().toISOString();
  });
  void admin;
  return { ok: true as const, status: "approved" as const, usdCredit: usd };
}

export async function listDeskUsers(): Promise<DeskUser[]> {
  requireAdmin();
  const desk = loadDesk();
  return desk.users
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((u) => {
      const book = desk.accounts[u.id];
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin ?? null,
        balance: book?.balance ?? 0,
        status: book?.status === "frozen" ? "frozen" : "active",
        role: desk.staff.includes(u.id) ? "admin" : "user",
        pendingDeposits: desk.deposits.filter((d) => d.userId === u.id && d.status === "pending")
          .length,
        openPositions: book?.positions?.length ?? 0,
      };
    });
}

export async function adminCredit(input: { data: { userId: string; amount: number; note?: string } }) {
  requireAdmin();
  const payload = dataOf(input);
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount === 0) throw new Error("Enter a non-zero amount.");
  if (Math.abs(amount) > MAX_BALANCE) throw new Error("Amount is too large.");
  const target = String(payload.userId || "").slice(0, 80);
  if (!target) throw new Error("Missing user.");
  const note = String(payload.note || "").trim().slice(0, 200) || "Admin adjustment";
  const balance = creditLocal(target, Number(amount.toFixed(2)), amount > 0 ? "credit" : "debit", note);
  return { balance };
}

export async function setUserFrozen(input: { data: { userId: string; frozen: boolean } }) {
  requireAdmin();
  const payload = dataOf(input);
  const target = String(payload.userId || "").slice(0, 80);
  mutateDesk((desk) => {
    const book = ensureAccount(target, desk);
    book.status = payload.frozen ? "frozen" : "active";
  });
  return { status: payload.frozen ? "frozen" : "active" };
}

export async function setUserAdmin(input: { data: { userId: string; admin: boolean } }) {
  const me = requireAdmin();
  const payload = dataOf(input);
  const target = String(payload.userId || "").slice(0, 80);
  mutateDesk((desk) => {
    if (payload.admin) {
      if (!desk.staff.includes(target)) desk.staff.push(target);
      return;
    }
    if (target === me.id) throw new Error("You cannot demote yourself.");
    if (desk.staff.length <= 1) throw new Error("Keep at least one admin.");
    desk.staff = desk.staff.filter((id) => id !== target);
  });
  return { role: payload.admin ? ("admin" as const) : ("user" as const) };
}

export async function saveCurrency(input: {
  data: { code: string; name: string; symbol: string; unitsPerUsd: number; enabled: boolean };
}) {
  requireAdmin();
  const payload = dataOf(input);
  const code = String(payload.code || "").trim().toUpperCase().slice(0, 8);
  if (!/^[A-Z]{3,8}$/.test(code)) throw new Error("Use a 3–8 letter currency code.");
  const name = String(payload.name || "").trim().slice(0, 40) || code;
  const symbol = String(payload.symbol || "").trim().slice(0, 8) || code;
  const units = Number(payload.unitsPerUsd);
  if (!Number.isFinite(units) || units <= 0) throw new Error("Rate must be greater than 0.");
  mutateDesk((desk) => {
    const existing = desk.currencies.find((c) => c.code === code);
    if (existing) {
      existing.name = name;
      existing.symbol = symbol;
      existing.unitsPerUsd = units;
      existing.enabled = Boolean(payload.enabled);
    } else {
      desk.currencies.push({
        code,
        name,
        symbol,
        unitsPerUsd: units,
        enabled: Boolean(payload.enabled),
        sortOrder: desk.currencies.length,
      });
    }
  });
  return { ok: true as const };
}

export async function savePaymentMethod(input: {
  data: {
    id?: number;
    kind: MethodKind;
    title: string;
    currency: string;
    details: PaymentDetails;
    enabled: boolean;
  };
}) {
  requireAdmin();
  const payload = dataOf(input);
  if (!KINDS.has(payload.kind)) throw new Error("Unknown method type.");
  const title = String(payload.title || "").trim().slice(0, 60);
  if (title.length < 2) throw new Error("Give the method a name.");
  const currency = String(payload.currency || "USD").trim().toUpperCase().slice(0, 8);
  let id = payload.id ?? 0;
  mutateDesk((desk) => {
    if (payload.id) {
      const row = desk.methods.find((m) => m.id === Number(payload.id));
      if (!row) throw new Error("Method not found.");
      row.kind = payload.kind;
      row.title = title;
      row.currency = currency;
      row.details = payload.details ?? {};
      row.enabled = Boolean(payload.enabled);
      id = row.id;
      return;
    }
    id = desk.nextMethodId++;
    desk.methods.push({
      id,
      kind: payload.kind,
      title,
      currency,
      details: payload.details ?? {},
      enabled: Boolean(payload.enabled),
      sortOrder: desk.methods.length,
    });
  });
  return { id };
}

export async function deletePaymentMethod(input: { data: number } | number) {
  requireAdmin();
  const id = Number(dataOf(input));
  mutateDesk((desk) => {
    desk.methods = desk.methods.filter((m) => m.id !== id);
  });
  return { ok: true as const };
}
