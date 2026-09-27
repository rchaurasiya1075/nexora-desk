import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Sparkline } from "@/components/trade/sparkline";
import { market } from "@/lib/market/engine";
import { FEATURED_SYMBOLS, getInstrument } from "@/lib/market/instruments";
import { useMarketTick } from "@/lib/market/use-market";
import { useDeskSession } from "@/lib/firebase/session";
import { positionPnl, useTradeStore } from "@/lib/trading/store";
import { formatMoney, formatPct, formatPrice, formatSigned } from "@/lib/utils";

export function HomeScreen() {
  useMarketTick();
  const { user } = useDeskSession();
  const balance = useTradeStore((s) => s.balance);
  const positions = useTradeStore((s) => s.positions);
  const history = useTradeStore((s) => s.history);
  const floating = positions.reduce((sum, pos) => {
    const q = market.getQuote(pos.symbol);
    return sum + positionPnl(pos, q.bid, q.ask);
  }, 0);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today = history
    .filter((row) => row.closedAt >= start.getTime())
    .reduce((sum, row) => sum + row.pnl, 0);
  const initial = (user?.name || user?.email || "S").slice(0, 1).toUpperCase();
  const pnl = today + floating;

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <div className="flex items-center justify-between">
        <Link to="/account" className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg">
            {initial}
          </span>
          <span>
            <span className="block text-sm">{user?.name || "Guest"}</span>
            <span className="text-[11px] uppercase tracking-[0.14em] text-accent">Demo account</span>
          </span>
        </Link>
        <Link to="/account" className="flex size-10 items-center justify-center rounded-full bg-bg-subtle text-muted" aria-label="Notifications">
          <Bell className="size-4" />
        </Link>
      </div>

      <section className="relative mt-5 overflow-hidden rounded-2xl border border-border bg-bg-elevated p-5">
        <div className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full bg-accent/20 blur-2xl" />
        <p className="text-[11px] uppercase tracking-[0.18em] text-subtle">Total equity</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight">{formatMoney(balance)}</p>
        <p className={`mt-2 text-sm font-medium ${pnl >= 0 ? "text-buy" : "text-sell"}`}>
          Today's P/L {formatSigned(pnl)}
        </p>
        <p className="mt-2 text-xs text-muted">Paper desk. Not a live-money broker.</p>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link to="/trade" className="flex h-14 items-center justify-center rounded-2xl bg-accent text-sm font-semibold text-accent-fg transition-transform active:scale-[0.98]">
          Trade
        </Link>
        <Link to="/trade" search={{ view: "positions" }} className="flex h-14 items-center justify-center rounded-2xl bg-bg-subtle text-sm font-medium transition-transform active:scale-[0.98]">
          Positions
        </Link>
      </div>

      <div className="mt-6 flex items-end justify-between">
        <h2 className="text-sm font-medium">Popular markets</h2>
        <Link to="/markets" className="text-xs text-accent">See all</Link>
      </div>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-2 snap-x">
        {FEATURED_SYMBOLS.map((symbol) => {
          const inst = getInstrument(symbol);
          const q = market.getQuote(symbol);
          const up = q.changePct >= 0;
          const spark = market.getCandles(symbol, "15m").slice(-24).map((c) => c.c);
          return (
            <Link
              key={symbol}
              to="/trade"
              search={{ symbol }}
              className="snap-start w-44 shrink-0 rounded-2xl border border-border bg-bg-elevated p-3 transition-transform active:scale-[0.98]"
            >
              <span className="block text-sm font-medium">{inst.display}</span>
              <span className="mt-2 block text-lg font-semibold num">{formatPrice(q.mid, inst.digits)}</span>
              <span className="mt-2 flex items-center justify-between">
                <Sparkline values={spark} up={up} />
                <span className={up ? "text-xs text-buy" : "text-xs text-sell"}>{formatPct(q.changePct)}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
