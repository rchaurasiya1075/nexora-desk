import { Link } from "@tanstack/react-router";
import { market } from "@/lib/market/engine";
import { FEATURED_SYMBOLS, getInstrument } from "@/lib/market/instruments";
import { useMarketTick } from "@/lib/market/use-market";
import { positionPnl, useTradeStore } from "@/lib/trading/store";
import { formatMoney, formatPct, formatPrice, formatSigned } from "@/lib/utils";

export function HomeScreen() {
  useMarketTick();
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <p className="text-[11px] uppercase tracking-[0.18em] text-subtle">Paper trading balance</p>
      <p className="mt-2 font-display text-5xl">{formatMoney(balance)}</p>
      <p className={`mt-2 text-sm ${today + floating >= 0 ? "text-buy" : "text-sell"}`}>
        Today {formatSigned(today + floating)}
      </p>
      <p className="mt-1 text-xs text-muted">Demo account. Orders stay on this desk. Not a live broker.</p>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Link to="/trade" className="flex h-14 items-center justify-center rounded-xl bg-fg text-sm font-medium text-bg">
          Trade
        </Link>
        <Link to="/markets" className="flex h-14 items-center justify-center rounded-xl bg-bg-subtle text-sm">
          Markets
        </Link>
        <Link to="/trade" search={{ view: "positions" }} className="flex h-14 items-center justify-center rounded-xl bg-bg-subtle text-sm">
          Positions
        </Link>
        <Link to="/account" className="flex h-14 items-center justify-center rounded-xl bg-bg-subtle text-sm">
          History
        </Link>
      </div>

      <h2 className="mt-8 text-sm font-medium">Popular markets</h2>
      <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
        {FEATURED_SYMBOLS.map((symbol) => {
          const inst = getInstrument(symbol);
          const q = market.getQuote(symbol);
          const up = q.changePct >= 0;
          return (
            <li key={symbol}>
              <Link
                to="/trade"
                search={{ symbol }}
                className="flex items-center justify-between px-4 py-3"
              >
                <span>
                  <span className="block text-sm">{inst.display}</span>
                  <span className="text-[11px] text-muted">{inst.name}</span>
                </span>
                <span className="text-right">
                  <span className="block num text-sm">{formatPrice(q.mid, inst.digits)}</span>
                  <span className={up ? "text-buy text-xs" : "text-sell text-xs"}>{formatPct(q.changePct)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
