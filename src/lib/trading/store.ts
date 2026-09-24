import { create } from "zustand";
import { getInstrument, type Instrument } from "@/lib/market/instruments";
import { market, type AccountPricing } from "@/lib/market/engine";
import { loadAccount, saveBook } from "@/lib/trading/account-api";
import {
  MARGIN_CALL,
  STARTING_BALANCE,
  STOP_OUT,
} from "@/lib/trading/constants";

export type Side = "buy" | "sell";
export type OrderKind = "market" | "limit" | "stop";
export type Position = {
  id: string;
  symbol: string;
  side: Side;
  lots: number;
  entry: number;
  sl: number | null;
  tp: number | null;
  openedAt: number;
  commission: number;
  leverage: number;
};
export type PendingOrder = {
  id: string;
  symbol: string;
  side: Side;
  kind: "limit" | "stop";
  lots: number;
  price: number;
  sl: number | null;
  tp: number | null;
  createdAt: number;
};
export type HistoryRow = {
  id: string;
  symbol: string;
  side: Side;
  lots: number;
  entry: number;
  exit: number;
  pnl: number;
  commission: number;
  openedAt: number;
  closedAt: number;
};

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function notional(inst: Instrument, lots: number, price: number) {
  return inst.contractSize * lots * price;
}

export function requiredMargin(inst: Instrument, lots: number, price: number) {
  return notional(inst, lots, price) / inst.leverage;
}

export function positionPnl(pos: Position, bid: number, ask: number) {
  const inst = getInstrument(pos.symbol);
  const close = pos.side === "buy" ? bid : ask;
  const dir = pos.side === "buy" ? 1 : -1;
  return (close - pos.entry) * dir * inst.contractSize * pos.lots;
}

export function pipValue(inst: Instrument, lots: number) {
  return inst.pip * inst.contractSize * lots;
}

export function spreadCost(inst: Instrument, lots: number, pricing: AccountPricing) {
  const spread = pricing === "raw" ? inst.spreadRaw : inst.spreadStd;
  return spread * inst.contractSize * lots;
}

export function commissionCost(inst: Instrument, lots: number, pricing: AccountPricing) {
  if (pricing !== "raw") return 0;
  return inst.commissionRaw * lots;
}

type BookSlice = {
  balance: number;
  status: "active" | "frozen";
  pricing: AccountPricing;
  selected: string;
  positions: Position[];
  pending: PendingOrder[];
  history: HistoryRow[];
};

type TradeState = BookSlice & {
  hydrated: boolean;
  lastToast: string | null;
  setHydrated: () => void;
  applyBook: (book: BookSlice) => void;
  hydrateFromServer: () => Promise<void>;
  persistNow: () => void;
  loadPrefs: () => void;
  select: (symbol: string) => void;
  setPricing: (mode: AccountPricing) => void;
  resetDemo: () => void;
  placeMarket: (input: {
    symbol: string;
    side: Side;
    lots: number;
    sl: number | null;
    tp: number | null;
  }) => { ok: true; id: string } | { ok: false; error: string };
  placePending: (input: {
    symbol: string;
    side: Side;
    kind: "limit" | "stop";
    lots: number;
    price: number;
    sl: number | null;
    tp: number | null;
  }) => { ok: true; id: string } | { ok: false; error: string };
  closePosition: (id: string, lots?: number) => { ok: true } | { ok: false; error: string };
  updateSlTp: (id: string, sl: number | null, tp: number | null) => void;
  cancelPending: (id: string) => void;
  oneClick: boolean;
  clickSize: number;
  setOneClick: (on: boolean) => void;
  setClickSize: (n: number) => void;
  alerts: PriceAlert[];
  addAlert: (symbol: string, price: number, want: "above" | "below") => void;
  removeAlert: (id: string) => void;
  onTick: () => void;
};

export type PriceAlert = {
  id: string;
  symbol: string;
  price: number;
  want: "above" | "below";
  createdAt: number;
};

function openPosition(
  input: {
    symbol: string;
    side: Side;
    lots: number;
    sl: number | null;
    tp: number | null;
  },
  pricing: AccountPricing,
): Position {
  const inst = getInstrument(input.symbol);
  const q = market.getQuote(input.symbol);
  const entry = input.side === "buy" ? q.ask : q.bid;
  return {
    id: uid(),
    symbol: input.symbol,
    side: input.side,
    lots: input.lots,
    entry,
    sl: input.sl,
    tp: input.tp,
    openedAt: Date.now(),
    commission: commissionCost(inst, input.lots, pricing),
    leverage: inst.leverage,
  };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function readPref<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const s = useTradeStore.getState();
    void saveBook({
      data: {
        balance: s.balance,
        status: s.status,
        pricing: s.pricing,
        selected: s.selected,
        positions: s.positions,
        pending: s.pending,
        history: s.history,
      },
    }).catch(() => undefined);
  }, 450);
}

function blocked(state: TradeState): string | null {
  if (state.status === "frozen") return "Account is frozen. An admin must unlock it.";
  if (state.balance <= 0 && state.positions.length === 0) {
    return "Submit a deposit. Trading unlocks after admin approval.";
  }
  return null;
}

export const useTradeStore = create<TradeState>()((set, get) => ({
  hydrated: false,
  balance: STARTING_BALANCE,
  status: "active",
  pricing: "standard",
  selected: "EURUSD",
  positions: [],
  pending: [],
  history: [],
  lastToast: null,
  oneClick: false,
  clickSize: 0.1,
  alerts: [],
  setHydrated: () => set({ hydrated: true }),
  applyBook: (book) => {
    market.setPricing(book.pricing);
    set({
      balance: book.balance,
      status: book.status,
      pricing: book.pricing,
      selected: book.selected || get().selected,
      positions: book.positions,
      pending: book.pending,
      history: book.history,
      hydrated: true,
    });
  },
  hydrateFromServer: async () => {
    try {
      const book = await loadAccount();
      get().applyBook(book);
    } catch {
      set({ hydrated: true });
    }
  },
  persistNow: () => scheduleSave(),
  loadPrefs: () => {
    set({
      oneClick: readPref("nx-1click", false),
      clickSize: readPref("nx-click-size", 0.1),
      alerts: readPref<PriceAlert[]>("nx-alerts", []),
    });
  },
  select: (symbol) => {
    set({ selected: symbol });
    scheduleSave();
  },
  setPricing: (mode) => {
    market.setPricing(mode);
    set({ pricing: mode });
    scheduleSave();
  },
  resetDemo: () => {
    set({
      positions: [],
      pending: [],
      lastToast: "Open positions flattened. Cash stays on the account.",
    });
    scheduleSave();
  },
  placeMarket: (input) => {
    if (input.lots < 0.01) return { ok: false, error: "Minimum size is 0.01 lots." };
    if (input.lots > 50) return { ok: false, error: "Maximum size is 50 lots." };
    const freeze = blocked(get());
    if (freeze) return { ok: false, error: freeze };
    const inst = getInstrument(input.symbol);
    const q = market.getQuote(input.symbol);
    const entry = input.side === "buy" ? q.ask : q.bid;
    const margin = requiredMargin(inst, input.lots, entry);
    const { equity, free } = snapshot(get());
    if (margin > free) {
      return {
        ok: false,
        error: `Not enough free margin. Need ${margin.toFixed(2)}, free ${free.toFixed(2)}.`,
      };
    }
    if (equity <= 0) return { ok: false, error: "Account is blown. Request another deposit." };
    const pos = openPosition(input, get().pricing);
    set({
      positions: [...get().positions, pos],
      balance: get().balance - pos.commission,
      lastToast: `${input.side === "buy" ? "Bought" : "Sold"} ${input.lots} ${inst.display} @ ${entry.toFixed(inst.digits)}`,
    });
    scheduleSave();
    return { ok: true, id: pos.id };
  },
  placePending: (input) => {
    if (input.lots < 0.01) return { ok: false, error: "Minimum size is 0.01 lots." };
    if (input.price <= 0) return { ok: false, error: "Enter a valid trigger price." };
    const freeze = blocked(get());
    if (freeze) return { ok: false, error: freeze };
    const order: PendingOrder = {
      id: uid(),
      ...input,
      createdAt: Date.now(),
    };
    set({
      pending: [...get().pending, order],
      lastToast: `${input.kind} ${input.side} ${input.lots} ${input.symbol} @ ${input.price}`,
    });
    scheduleSave();
    return { ok: true, id: order.id };
  },
  closePosition: (id, lots) => {
    const pos = get().positions.find((p) => p.id === id);
    if (!pos) return { ok: false, error: "Position not found." };
    const closeLots = lots && lots < pos.lots - 0.001 ? lots : pos.lots;
    const inst = getInstrument(pos.symbol);
    const q = market.getQuote(pos.symbol);
    const pnl = positionPnl({ ...pos, lots: closeLots }, q.bid, q.ask);
    const exit = pos.side === "buy" ? q.bid : q.ask;
    const commission = commissionCost(inst, closeLots, get().pricing);
    const row: HistoryRow = {
      id: uid(),
      symbol: pos.symbol,
      side: pos.side,
      lots: closeLots,
      entry: pos.entry,
      exit,
      pnl: pnl - commission,
      commission,
      openedAt: pos.openedAt,
      closedAt: Date.now(),
    };
    const remaining = pos.lots - closeLots;
    set({
      balance: get().balance + pnl - commission,
      positions:
        remaining > 0.001
          ? get().positions.map((p) =>
              p.id === id ? { ...p, lots: remaining } : p,
            )
          : get().positions.filter((p) => p.id !== id),
      history: [row, ...get().history].slice(0, 80),
      lastToast: `Closed ${closeLots} ${inst.display}  P/L ${pnl - commission >= 0 ? "+" : ""}${(pnl - commission).toFixed(2)}`,
    });
    scheduleSave();
    return { ok: true };
  },
  updateSlTp: (id, sl, tp) => {
    set({
      positions: get().positions.map((p) => (p.id === id ? { ...p, sl, tp } : p)),
    });
    scheduleSave();
  },
  cancelPending: (id) => {
    set({ pending: get().pending.filter((o) => o.id !== id) });
    scheduleSave();
  },
  setOneClick: (on) => {
    writePref("nx-1click", on);
    set({ oneClick: on });
  },
  setClickSize: (n) => {
    const size = Math.min(50, Math.max(0.01, n));
    writePref("nx-click-size", size);
    set({ clickSize: size });
  },
  addAlert: (symbol, price, want) => {
    if (!(price > 0)) return;
    const next: PriceAlert[] = [
      ...get().alerts,
      { id: uid(), symbol, price, want, createdAt: Date.now() },
    ].slice(-24);
    writePref("nx-alerts", next);
    set({ alerts: next, lastToast: `Alert set on ${symbol} ${want} ${price}` });
  },
  removeAlert: (id) => {
    const next = get().alerts.filter((a) => a.id !== id);
    writePref("nx-alerts", next);
    set({ alerts: next });
  },
  onTick: () => {
    const state = get();
    if (state.positions.length === 0 && state.pending.length === 0) return;

    const filled: PendingOrder[] = [];
    for (const order of state.pending) {
      const q = market.getQuote(order.symbol);
      const hit =
        order.kind === "limit"
          ? order.side === "buy"
            ? q.ask <= order.price
            : q.bid >= order.price
          : order.side === "buy"
            ? q.ask >= order.price
            : q.bid <= order.price;
      if (hit) filled.push(order);
    }

    let dirty = false;

    if (filled.length) {
      let positions = state.positions;
      let pending = state.pending;
      let balance = state.balance;
      let toast = state.lastToast;
      for (const order of filled) {
        const inst = getInstrument(order.symbol);
        const q = market.getQuote(order.symbol);
        const entry = order.side === "buy" ? q.ask : q.bid;
        const margin = requiredMargin(inst, order.lots, entry);
        const snap = snapshot({ ...state, positions, balance });
        if (margin > snap.free) {
          pending = pending.filter((p) => p.id !== order.id);
          toast = `Order ${order.symbol} cancelled — not enough margin.`;
          dirty = true;
          continue;
        }
        const pos = openPosition(order, state.pricing);
        pos.entry = entry;
        positions = [...positions, pos];
        pending = pending.filter((p) => p.id !== order.id);
        balance -= pos.commission;
        toast = `Filled ${order.kind} ${order.symbol}`;
        dirty = true;
      }
      set({ positions, pending, balance, lastToast: toast });
    }

    const afterFill = get();
    let positions = afterFill.positions;
    let balance = afterFill.balance;
    let history = afterFill.history;
    let toast = afterFill.lastToast;
    const still: Position[] = [];

    for (const pos of positions) {
      const q = market.getQuote(pos.symbol);
      const bid = q.bid;
      const ask = q.ask;
      const hitSl =
        pos.sl != null &&
        (pos.side === "buy" ? bid <= pos.sl : ask >= pos.sl);
      const hitTp =
        pos.tp != null &&
        (pos.side === "buy" ? bid >= pos.tp : ask <= pos.tp);
      if (!hitSl && !hitTp) {
        still.push(pos);
        continue;
      }
      const pnl = positionPnl(pos, bid, ask);
      const exit = pos.side === "buy" ? bid : ask;
      history = [
        {
          id: uid(),
          symbol: pos.symbol,
          side: pos.side,
          lots: pos.lots,
          entry: pos.entry,
          exit,
          pnl,
          commission: 0,
          openedAt: pos.openedAt,
          closedAt: Date.now(),
        },
        ...history,
      ].slice(0, 80);
      balance += pnl;
      toast = hitSl
        ? `Stop hit on ${pos.symbol}`
        : `Take profit hit on ${pos.symbol}`;
      dirty = true;
    }

    if (still.length !== positions.length) {
      set({ positions: still, balance, history, lastToast: toast });
    }

    const live = get();
    const snap = snapshot(live);
    if (live.positions.length && snap.marginLevel < STOP_OUT && snap.used > 0) {
      let bal = live.balance;
      let hist = live.history;
      for (const pos of live.positions) {
        const q = market.getQuote(pos.symbol);
        const pnl = positionPnl(pos, q.bid, q.ask);
        bal += pnl;
        hist = [
          {
            id: uid(),
            symbol: pos.symbol,
            side: pos.side,
            lots: pos.lots,
            entry: pos.entry,
            exit: pos.side === "buy" ? q.bid : q.ask,
            pnl,
            commission: 0,
            openedAt: pos.openedAt,
            closedAt: Date.now(),
          },
          ...hist,
        ];
      }
      set({
        positions: [],
        pending: [],
        balance: bal,
        history: hist.slice(0, 80),
        lastToast: "Stop-out: margin level fell below 50%. All positions closed.",
      });
      dirty = true;
    }

    if (dirty) scheduleSave();

    const liveAlerts = get();
    if (liveAlerts.alerts.length) {
      const hit: PriceAlert[] = [];
      for (const alert of liveAlerts.alerts) {
        const q = market.getQuote(alert.symbol);
        if (!q) continue;
        const crossed =
          alert.want === "above" ? q.mid >= alert.price : q.mid <= alert.price;
        if (crossed) hit.push(alert);
      }
      if (hit.length) {
        const remain = liveAlerts.alerts.filter((a) => !hit.some((h) => h.id === a.id));
        writePref("nx-alerts", remain);
        const first = hit[0]!;
        set({
          alerts: remain,
          lastToast: `Price alert: ${first.symbol} ${first.want} ${first.price}`,
        });
      }
    }
  },
}));

export function snapshot(state: {
  balance: number;
  positions: Position[];
}) {
  let floating = 0;
  let used = 0;
  for (const pos of state.positions) {
    const q = market.getQuote(pos.symbol);
    const inst = getInstrument(pos.symbol);
    floating += positionPnl(pos, q.bid, q.ask);
    used += requiredMargin(inst, pos.lots, pos.entry);
  }
  const equity = state.balance + floating;
  const free = equity - used;
  const marginLevel = used > 0 ? (equity / used) * 100 : Infinity;
  return { floating, used, equity, free, marginLevel };
}

export { STARTING_BALANCE, STOP_OUT, MARGIN_CALL };
