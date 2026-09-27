import { market } from "@/lib/market/engine";
import { getInstrument } from "@/lib/market/instruments";
import { useMarketTick } from "@/lib/market/use-market";
import { positionPnl, useTradeStore } from "@/lib/trading/store";
import { formatMoney, formatPrice, formatSigned } from "@/lib/utils";
import { toast } from "sonner";

export function PositionsScreen() {
  useMarketTick();
  const positions = useTradeStore((s) => s.positions);
  const history = useTradeStore((s) => s.history);
  const closePosition = useTradeStore((s) => s.closePosition);
  const floating = positions.reduce((sum, pos) => {
    const q = market.getQuote(pos.symbol);
    return sum + positionPnl(pos, q.bid, q.ask);
  }, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-display text-3xl">Positions</h1>
      <p className={`mt-2 text-sm ${floating >= 0 ? "text-buy" : "text-sell"}`}>
        Open P/L {formatSigned(floating)}
      </p>
      <h2 className="mt-6 text-xs uppercase tracking-[0.16em] text-subtle">Open ({positions.length})</h2>
      <ul className="mt-3 space-y-3">
        {positions.map((pos) => {
          const inst = getInstrument(pos.symbol);
          const q = market.getQuote(pos.symbol);
          const pnl = positionPnl(pos, q.bid, q.ask);
          const current = pos.side === "buy" ? q.bid : q.ask;
          return (
            <li key={pos.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm">{inst.display}</p>
                  <p className="text-xs uppercase text-muted">
                    {pos.side} · {formatMoney(pos.lots * inst.contractSize * pos.entry)}
                  </p>
                </div>
                <p className={pnl >= 0 ? "text-buy" : "text-sell"}>{formatSigned(pnl)}</p>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
                <div>Entry {formatPrice(pos.entry, inst.digits)}</div>
                <div>Current {formatPrice(current, inst.digits)}</div>
              </dl>
              <button
                type="button"
                className="mt-3 h-10 w-full rounded-lg border border-border text-sm"
                onClick={() => {
                  const res = closePosition(pos.id);
                  if (!res.ok) toast.error(res.error);
                  else toast.success("Position closed");
                }}
              >
                Close
              </button>
            </li>
          );
        })}
        {positions.length === 0 && <p className="text-sm text-muted">No open trade. Use Trade, then BUY or SELL.</p>}
      </ul>
      <h2 className="mt-8 text-xs uppercase tracking-[0.16em] text-subtle">Closed ({history.length})</h2>
      <ul className="mt-3 divide-y divide-border">
        {history.slice(0, 20).map((row) => {
          const inst = getInstrument(row.symbol);
          return (
            <li key={row.id} className="flex items-center justify-between py-3 text-sm">
              <span>
                {inst.display} {row.side.toUpperCase()}
              </span>
              <span className={row.pnl >= 0 ? "text-buy" : "text-sell"}>{formatSigned(row.pnl)}</span>
            </li>
          );
        })}
        {history.length === 0 && <p className="py-3 text-sm text-muted">Closed trades show up here.</p>}
      </ul>
    </div>
  );
}
