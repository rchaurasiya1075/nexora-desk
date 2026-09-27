import { getInstrument } from "@/lib/market/instruments";
import { market } from "@/lib/market/engine";
import { useTradeStore } from "@/lib/trading/store";

export type QuickSide = "call" | "put";
export type QuickBet = {
  id: string;
  symbol: string;
  side: QuickSide;
  stake: number;
  payout: number;
  entry: number;
  expiry: number;
  status: "open" | "win" | "loss" | "tie";
  settle: number | null;
  posted: boolean;
};

const KEY = "morgan.quick.v1";
const listeners = new Set<() => void>();
let cache: QuickBet[] | null = null;

function read(): QuickBet[] {
  if (cache) return cache;
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) || "[]") as QuickBet[];
    cache = (Array.isArray(rows) ? rows : []).map((bet) => ({
      ...bet,
      posted: bet.posted ?? bet.status !== "open",
    }));
  } catch {
    cache = [];
  }
  return cache;
}

function write(rows: QuickBet[]) {
  cache = rows.slice(0, 40);
  localStorage.setItem(KEY, JSON.stringify(cache));
  listeners.forEach((fn) => fn());
}

export function quickBets() {
  return read();
}

export function subscribeQuick(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function payoutRate(symbol: string) {
  const kind = getInstrument(symbol).assetClass;
  if (kind === "crypto") return 0.8;
  if (kind === "metals" || kind === "energy") return 0.82;
  return 0.88;
}

export function openQuickBet(input: { symbol: string; side: QuickSide; stake: number; seconds: number }) {
  const state = useTradeStore.getState();
  if (state.status === "frozen") return { ok: false as const, error: "Account is frozen." };
  if (!Number.isFinite(input.stake) || input.stake < 1) return { ok: false as const, error: "Minimum amount is $1." };
  if (input.stake > state.balance) return { ok: false as const, error: "Not enough balance." };
  const quote = market.getQuote(input.symbol);
  const bet: QuickBet = {
    id: Math.random().toString(36).slice(2, 10),
    symbol: input.symbol,
    side: input.side,
    stake: Number(input.stake.toFixed(2)),
    payout: payoutRate(input.symbol),
    entry: quote.mid,
    expiry: Date.now() + input.seconds * 1000,
    status: "open",
    settle: null,
    posted: false,
  };
  state.adjustCash(-bet.stake);
  write([bet, ...read()]);
  return { ok: true as const, bet };
}

export function settleQuick() {
  const rows = read();
  const now = Date.now();
  let changed = false;
  for (const bet of rows) {
    if (bet.status !== "open" || bet.expiry > now) continue;
    const px = market.getQuote(bet.symbol).mid;
    const up = px > bet.entry;
    const down = px < bet.entry;
    bet.settle = px;
    if (!up && !down) bet.status = "tie";
    else if ((bet.side === "call" && up) || (bet.side === "put" && down)) bet.status = "win";
    else bet.status = "loss";
    changed = true;
  }
  if (changed) write(rows);
  let paid = false;
  for (const bet of read()) {
    if (bet.posted || bet.status === "open") continue;
    bet.posted = true;
    paid = true;
    if (bet.status === "tie") useTradeStore.getState().adjustCash(bet.stake);
    else if (bet.status === "win") useTradeStore.getState().adjustCash(Number((bet.stake * (1 + bet.payout)).toFixed(2)));
  }
  if (paid) write(read());
}
