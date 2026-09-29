import { market } from "@/lib/market/engine";
import { inrPerUsd } from "@/lib/money/display-ccy";
import { currentForce } from "@/lib/ops/live-desk";
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
  result: number;
  fx: number;
  forced?: boolean;
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
      result: typeof bet.result === "number" ? bet.result : bet.status === "win" ? bet.stake * bet.payout : bet.status === "loss" ? -bet.stake : 0,
      fx: bet.fx || 88.42,
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

export function payoutRate(seconds = 30) {
  if (seconds >= 240) return 2;
  if (seconds >= 120) return 1;
  if (seconds >= 90) return 0.6;
  if (seconds >= 60) return 0.3;
  return 0.15;
}

export function maxQuickSeconds(balance: number) {
  if (balance >= 20000) return 240;
  if (balance >= 10000) return 120;
  if (balance >= 5000) return 90;
  if (balance >= 3000) return 60;
  return 30;
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
    payout: payoutRate(input.seconds),
    entry: quote.mid,
    expiry: Date.now() + input.seconds * 1000,
    status: "open",
    settle: null,
    result: 0,
    fx: inrPerUsd(),
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
    if (bet.status !== "open") continue;
    const px = market.getQuote(bet.symbol).mid;
    const forced = currentForce();
    const useForce = !!(forced && forced.betId === bet.id && Number.isFinite(forced.usd));
    if (!useForce && bet.expiry > now) continue;
    if (useForce && forced) {
      bet.settle = px;
      bet.fx = bet.fx || inrPerUsd();
      bet.result = Number(forced.usd.toFixed(2));
      bet.status = bet.result > 0 ? "win" : bet.result < 0 ? "loss" : "tie";
      bet.forced = true;
      changed = true;
      continue;
    }
    const up = px > bet.entry;
    const down = px < bet.entry;
    bet.settle = px;
    bet.fx = bet.fx || inrPerUsd();
    if (!up && !down) {
      bet.status = "tie";
      bet.result = 0;
    } else if ((bet.side === "call" && up) || (bet.side === "put" && down)) {
      bet.status = "win";
      bet.result = Number((bet.stake * bet.payout).toFixed(2));
    } else {
      bet.status = "loss";
      bet.result = Number((-bet.stake).toFixed(2));
    }
    changed = true;
  }
  if (changed) write(rows);
  let paid = false;
  for (const bet of read()) {
    if (bet.posted || bet.status === "open") continue;
    bet.posted = true;
    paid = true;
    if (bet.forced) useTradeStore.getState().adjustCash(Number((bet.stake + bet.result).toFixed(2)));
    else if (bet.status === "tie") useTradeStore.getState().adjustCash(bet.stake);
    else if (bet.status === "win") useTradeStore.getState().adjustCash(Number((bet.stake * (1 + bet.payout)).toFixed(2)));
  }
  if (paid) write(read());
}
