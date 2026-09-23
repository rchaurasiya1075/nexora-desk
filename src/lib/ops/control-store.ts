import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { market } from "@/lib/market/engine";
import { getInstrument, INSTRUMENTS } from "@/lib/market/instruments";
import {
  appendLedger,
  ensureAccount,
  loadDesk,
  mutateDesk,
} from "@/lib/desk/local-store";
import { creditLocal } from "@/lib/trading/account-local";
import type { Side } from "@/lib/trading/store";

const KEY = "sikkaaa.control.v1";

export type PricePin = {
  price: number;
  paused: boolean;
  manual: boolean;
};

export type PriceChange = {
  symbol: string;
  at: string;
  oldPrice: number;
  newPrice: number;
  by: string;
};

export type AuditRow = {
  id: string;
  at: string;
  admin: string;
  action: string;
  target: string;
  details: string;
};

export type Withdrawal = {
  id: string;
  userId: string;
  userName: string;
  email: string;
  amount: number;
  note: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

export type DeskSettings = {
  siteName: string;
  slogan: string;
  timezone: string;
  supportEmail: string;
  inrPerUsd: number;
  tradingEnabled: boolean;
  manualMode: boolean;
  paper: boolean;
};

export type SupportNote = {
  id: string;
  userId: string;
  email: string;
  message: string;
  at: string;
  status: "open" | "closed";
};

type ControlState = {
  pins: Record<string, PricePin>;
  priceLog: PriceChange[];
  audit: AuditRow[];
  withdrawals: Withdrawal[];
  support: SupportNote[];
  settings: DeskSettings;
};

const DEFAULTS: ControlState = {
  pins: {},
  priceLog: [],
  audit: [],
  withdrawals: [],
  support: [],
  settings: {
    siteName: "Sikkaaa",
    slogan: "See the price. Take the trade.",
    timezone: "Asia/Kolkata",
    supportEmail: "supportus@sikkaaa.in",
    inrPerUsd: 83.5,
    tradingEnabled: true,
    manualMode: true,
    paper: true,
  },
};

let booted = false;
const listeners = new Set<() => void>();

function load(): ControlState {
  if (typeof window === "undefined") return structuredClone(DEFAULTS);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw) as ControlState;
    return {
      ...structuredClone(DEFAULTS),
      ...parsed,
      settings: { ...DEFAULTS.settings, ...parsed.settings },
      pins: parsed.pins ?? {},
      priceLog: parsed.priceLog ?? [],
      audit: parsed.audit ?? [],
      withdrawals: parsed.withdrawals ?? [],
      support: parsed.support ?? [],
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function save(next: ControlState) {
  localStorage.setItem(KEY, JSON.stringify(next));
  for (const fn of listeners) fn();
  void pushRemote(next);
}

function applyPins(pins: Record<string, PricePin>) {
  for (const inst of INSTRUMENTS) {
    const pin = pins[inst.symbol];
    market.setPaused(inst.symbol, !!pin?.paused);
    if (pin?.manual && pin.price > 0) market.setManualPrice(inst.symbol, pin.price);
    else market.clearManualPrice(inst.symbol);
  }
}

async function pushRemote(state: ControlState) {
  try {
    await setDoc(
      doc(db, "desk", "markets"),
      {
        pins: state.pins,
        settings: state.settings,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch {
    /* rules or offline — local tape still holds */
  }
}

export function bootControl() {
  if (booted || typeof window === "undefined") return;
  booted = true;
  applyPins(load().pins);
  try {
    onSnapshot(doc(db, "desk", "markets"), (snap) => {
      if (!snap.exists()) return;
      const remote = snap.data() as { pins?: Record<string, PricePin> };
      if (!remote.pins) return;
      const local = load();
      local.pins = remote.pins;
      localStorage.setItem(KEY, JSON.stringify(local));
      applyPins(remote.pins);
      for (const fn of listeners) fn();
    });
  } catch {
    /* firestore optional */
  }
}

export function subscribeControl(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function readControl() {
  return load();
}

export function audit(admin: string, action: string, target: string, details: string) {
  const state = load();
  state.audit.unshift({
    id: `AUD-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    admin,
    action,
    target,
    details: details.slice(0, 240),
  });
  state.audit = state.audit.slice(0, 300);
  save(state);
}

export function setMarketPrice(symbol: string, price: number, by: string) {
  const inst = getInstrument(symbol);
  const state = load();
  const old = market.getQuote(symbol)?.mid ?? inst.base;
  state.pins[symbol] = {
    price,
    paused: state.pins[symbol]?.paused ?? false,
    manual: true,
  };
  state.priceLog.unshift({
    symbol,
    at: new Date().toISOString(),
    oldPrice: old,
    newPrice: price,
    by,
  });
  state.priceLog = state.priceLog.slice(0, 200);
  state.settings.manualMode = true;
  save(state);
  market.setManualPrice(symbol, price);
  audit(by, "PRICE", symbol, `${old} → ${price}`);
}

export function nudgePrice(symbol: string, delta: number, by: string) {
  const mid = market.getQuote(symbol)?.mid ?? getInstrument(symbol).base;
  setMarketPrice(symbol, Number((mid + delta).toFixed(getInstrument(symbol).digits)), by);
}

export function setMarketPaused(symbol: string, paused: boolean, by: string) {
  const state = load();
  const prev = state.pins[symbol];
  state.pins[symbol] = {
    price: prev?.price ?? market.getQuote(symbol)?.mid ?? getInstrument(symbol).base,
    paused,
    manual: prev?.manual ?? false,
  };
  save(state);
  market.setPaused(symbol, paused);
  audit(by, paused ? "PAUSE" : "RESUME", symbol, paused ? "Market paused" : "Market live");
}

export function releasePrice(symbol: string, by: string) {
  const state = load();
  if (state.pins[symbol]) state.pins[symbol] = { ...state.pins[symbol], manual: false };
  save(state);
  market.clearManualPrice(symbol);
  audit(by, "RELEASE", symbol, "Manual price released");
}

export function saveSettings(patch: Partial<DeskSettings>, by: string) {
  const state = load();
  state.settings = { ...state.settings, ...patch };
  if (patch.inrPerUsd && patch.inrPerUsd > 0) {
    mutateDesk((desk) => {
      const row = desk.currencies.find((c) => c.code === "INR");
      if (row) row.unitsPerUsd = patch.inrPerUsd!;
    });
  }
  save(state);
  audit(by, "SETTINGS", "desk", JSON.stringify(patch).slice(0, 180));
}

export function requestWithdrawal(input: {
  userId: string;
  userName: string;
  email: string;
  amount: number;
  note: string;
}) {
  if (input.amount <= 0) throw new Error("Enter an amount.");
  const state = load();
  state.withdrawals.unshift({
    id: `WD-${Date.now().toString(36)}`,
    userId: input.userId,
    userName: input.userName,
    email: input.email,
    amount: Number(input.amount.toFixed(2)),
    note: input.note.slice(0, 160),
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  save(state);
}

export function reviewWithdrawal(id: string, action: "approve" | "reject", by: string) {
  const state = load();
  const row = state.withdrawals.find((w) => w.id === id);
  if (!row || row.status !== "pending") throw new Error("Request not found.");
  if (action === "approve") {
    creditLocal(row.userId, -row.amount, "debit", `Withdrawal ${row.id}`);
  }
  row.status = action === "approve" ? "approved" : "rejected";
  save(state);
  audit(by, "WITHDRAWAL", row.id, `${action} $${row.amount} · ${row.email}`);
}

export function addSupport(note: Omit<SupportNote, "id" | "at" | "status">) {
  const state = load();
  state.support.unshift({
    ...note,
    id: `SUP-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    status: "open",
  });
  save(state);
}

export function closeSupport(id: string, by: string) {
  const state = load();
  const row = state.support.find((s) => s.id === id);
  if (!row) return;
  row.status = "closed";
  save(state);
  audit(by, "SUPPORT", id, "Closed");
}

function tradeId() {
  return `TRD-${Date.now().toString(36).toUpperCase()}`;
}

export function adminOpenTrade(input: {
  userId: string;
  symbol: string;
  side: Side;
  quantity: number;
  entry: number;
  sl: number | null;
  tp: number | null;
  note: string;
  by: string;
}) {
  const inst = getInstrument(input.symbol);
  const id = tradeId();
  mutateDesk((desk) => {
    const book = ensureAccount(input.userId, desk);
    if (book.status === "frozen") throw new Error("Account is suspended.");
    book.positions.push({
      id,
      symbol: input.symbol,
      side: input.side,
      lots: input.quantity,
      entry: input.entry,
      sl: input.sl,
      tp: input.tp,
      openedAt: Date.now(),
      commission: 0,
      leverage: inst.leverage,
    });
    appendLedger(desk, input.userId, "TRADE_OPEN", 0, `${id} ${input.side} ${input.symbol} @ ${input.entry}. ${input.note}`);
  });
  audit(input.by, "TRADE_OPEN", id, `${input.side} ${input.quantity} ${input.symbol} @ ${input.entry}`);
  return id;
}

export function adminCloseTrade(input: {
  userId: string;
  tradeId: string;
  exit: number;
  reason: string;
  by: string;
}) {
  let pnl = 0;
  mutateDesk((desk) => {
    const book = ensureAccount(input.userId, desk);
    const idx = book.positions.findIndex((p) => p.id === input.tradeId);
    if (idx < 0) throw new Error("Open trade not found.");
    const pos = book.positions[idx]!;
    const inst = getInstrument(pos.symbol);
    const dir = pos.side === "buy" ? 1 : -1;
    pnl = (input.exit - pos.entry) * dir * inst.contractSize * pos.lots;
    book.positions.splice(idx, 1);
    book.history.unshift({
      id: pos.id,
      symbol: pos.symbol,
      side: pos.side,
      lots: pos.lots,
      entry: pos.entry,
      exit: input.exit,
      pnl,
      commission: pos.commission,
      openedAt: pos.openedAt,
      closedAt: Date.now(),
    });
    book.history = book.history.slice(0, 80);
    book.balance = Number((book.balance + pnl).toFixed(2));
    appendLedger(
      desk,
      input.userId,
      "TRADE_CLOSE",
      pnl,
      `${pos.id} close @ ${input.exit}. ${input.reason}`,
    );
  });
  audit(input.by, "TRADE_CLOSE", input.tradeId, `${input.reason} · P/L ${pnl.toFixed(2)}`);
  return pnl;
}

export function adminEditEntry(input: {
  userId: string;
  tradeId: string;
  entry: number;
  reason: string;
  by: string;
}) {
  let previous = 0;
  mutateDesk((desk) => {
    const book = ensureAccount(input.userId, desk);
    const pos = book.positions.find((p) => p.id === input.tradeId);
    if (!pos) throw new Error("Open trade not found.");
    previous = pos.entry;
    pos.entry = input.entry;
    appendLedger(
      desk,
      input.userId,
      "ADMIN_ADJUSTMENT",
      0,
      `${pos.id} entry ${previous} → ${input.entry}. ${input.reason}`,
    );
  });
  audit(
    input.by,
    "TRADE_EDIT",
    input.tradeId,
    `Entry ${previous} → ${input.entry}. ${input.reason}`,
  );
}

export function listOpenTrades() {
  const desk = loadDesk();
  return desk.users.flatMap((user) => {
    const book = desk.accounts[user.id];
    return (book?.positions ?? []).map((p) => ({ ...p, userId: user.id, userName: user.name, email: user.email }));
  });
}

export function listClosedTrades() {
  const desk = loadDesk();
  return desk.users.flatMap((user) => {
    const book = desk.accounts[user.id];
    return (book?.history ?? []).map((p) => ({ ...p, userId: user.id, userName: user.name, email: user.email }));
  });
}

export function listAllLedger() {
  const desk = loadDesk();
  const rows = Object.entries(desk.ledger).flatMap(([userId, entries]) => {
    const user = desk.users.find((u) => u.id === userId);
    return entries.map((e) => ({
      ...e,
      userId,
      userName: user?.name ?? userId,
      email: user?.email ?? "",
    }));
  });
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
