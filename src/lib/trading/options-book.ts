import { market } from "@/lib/market/engine";
import { useTradeStore } from "@/lib/trading/store";

export type OptionSide = "call" | "put";
export type OptionBet = {
  id: string;
  symbol: string;
  side: OptionSide;
  strike: number;
  premium: number;
  expiry: number;
  status: "open" | "win" | "loss";
  settle: number | null;
  credit: number;
};

const KEY = "morgan.options.v1";
const listeners = new Set<() => void>();
let cache: OptionBet[] | null = null;

function read(): OptionBet[] {
  if (cache) return cache;
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) || "[]") as OptionBet[];
    cache = Array.isArray(rows) ? rows : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(rows: OptionBet[]) {
  cache = rows.slice(0, 40);
  localStorage.setItem(KEY, JSON.stringify(cache));
  listeners.forEach((fn) => fn());
}

export function optionBets() {
  return read();
}

export function subscribeOptions(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function strikesAround(price: number) {
  const step = price >= 1000 ? price * 0.002 : price >= 50 ? 0.25 : price * 0.001;
  return [-2, -1, 0, 1, 2].map((k) => Number((price + k * step).toFixed(price >= 100 ? 2 : 5)));
}

export function openOption(input: { symbol: string; side: OptionSide; strike: number; premium: number }) {
  const state = useTradeStore.getState();
  if (state.status === "frozen") return { ok: false as const, error: "Account is frozen." };
  if (input.premium < 1) return { ok: false as const, error: "Minimum premium is $1." };
  if (input.premium > state.balance) return { ok: false as const, error: "Not enough balance." };
  const bet: OptionBet = {
    id: Math.random().toString(36).slice(2, 10),
    symbol: input.symbol,
    side: input.side,
    strike: input.strike,
    premium: Number(input.premium.toFixed(2)),
    expiry: Date.now() + 5 * 60 * 1000,
    status: "open",
    settle: null,
    credit: 0,
  };
  state.adjustCash(-bet.premium);
  write([bet, ...read()]);
  return { ok: true as const };
}

export function settleOptions() {
  const rows = read();
  const now = Date.now();
  let changed = false;
  for (const bet of rows) {
    if (bet.status !== "open" || bet.expiry > now) continue;
    const px = market.getQuote(bet.symbol).mid;
    const intrinsic = bet.side === "call" ? Math.max(0, px - bet.strike) : Math.max(0, bet.strike - px);
    const multiple = bet.strike > 0 ? Math.min(3, (intrinsic / bet.strike) * 40) : 0;
    bet.settle = px;
    bet.credit = multiple > 0 ? Number((bet.premium * (1 + multiple)).toFixed(2)) : 0;
    bet.status = bet.credit > 0 ? "win" : "loss";
    if (bet.credit > 0) useTradeStore.getState().adjustCash(bet.credit);
    changed = true;
  }
  if (changed) write(rows);
}
