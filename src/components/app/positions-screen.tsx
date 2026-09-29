import { useState, useSyncExternalStore } from "react";
import { market } from "@/lib/market/engine";
import { getInstrument } from "@/lib/market/instruments";
import { useMarketTick } from "@/lib/market/use-market";
import { optionBets, subscribeOptions } from "@/lib/trading/options-book";
import { quickBets, subscribeQuick } from "@/lib/trading/quick";
import { positionPnl, useTradeStore } from "@/lib/trading/store";
import { showFrozen, showSigned, useDisplayCcy } from "@/lib/money/display-ccy";
import { formatPrice } from "@/lib/utils";
import { toast } from "sonner";

export function PositionsScreen() {
  useMarketTick();
  const positions = useTradeStore((s) => s.positions);
  const pending = useTradeStore((s) => s.pending);
  const history = useTradeStore((s) => s.history);
  const quick = useSyncExternalStore(subscribeQuick, quickBets, () => []);
  const options = useSyncExternalStore(subscribeOptions, optionBets, () => []);
  const closePosition = useTradeStore((s) => s.closePosition);
  const cancelPending = useTradeStore((s) => s.cancelPending);
  const [tab, setTab] = useState<"open" | "closed">("open");
  const ccy = useDisplayCcy();
  const floating = positions.reduce((sum, pos) => {
    const q = market.getQuote(pos.symbol);
    return sum + positionPnl(pos, q.bid, q.ask);
  }, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:max-w-5xl lg:px-8">
      <h1 className="text-3xl font-medium">Positions</h1>
      {positions.length > 0 && (
        <p className={`mt-2 text-sm ${floating >= 0 ? "text-buy" : "text-sell"}`}>
          Open P/L {showSigned(floating, ccy)}
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 rounded-2xl bg-bg-subtle p-1 text-sm">
        <button type="button" onClick={() => setTab("open")} className={`h-10 rounded-xl ${tab === "open" ? "bg-bg-elevated text-fg gold-ring" : "text-muted"}`}>
          Open positions
        </button>
        <button type="button" onClick={() => setTab("closed")} className={`h-10 rounded-xl ${tab === "closed" ? "bg-bg-elevated text-fg gold-ring" : "text-muted"}`}>
          Closed / history
        </button>
      </div>
      {tab === "open" && (
      <>
      <ul className="mt-4 space-y-3">
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
                    {pos.side} · {pos.lots.toFixed(2)} lot · {pos.style === "intraday" ? "Intraday" : "Carry"} · {pos.leverage || inst.leverage}x
                  </p>
                </div>
                <p className={pnl >= 0 ? "text-buy" : "text-sell"}>{showSigned(pnl, ccy)}</p>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
                <div>Entry {formatPrice(pos.entry, inst.digits)}</div>
                <div>Current {formatPrice(current, inst.digits)}</div>
                <div>Stop loss {pos.sl != null ? formatPrice(pos.sl, inst.digits) : "—"}</div>
                <div>Take profit {pos.tp != null ? formatPrice(pos.tp, inst.digits) : "—"}</div>
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
      {pending.length > 0 && (
        <ul className="mt-4 space-y-2">
          {pending.map((order) => {
            const inst = getInstrument(order.symbol);
            return (
              <li key={order.id} className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm">
                <span>
                  {inst.display} {order.kind.toUpperCase()} {order.side.toUpperCase()} @ {formatPrice(order.price, inst.digits)}
                </span>
                <button type="button" className="text-xs text-muted underline" onClick={() => cancelPending(order.id)}>
                  Cancel
                </button>
              </li>
            );
          })}
        </ul>
      )}
      </>
      )}
      {tab === "closed" && (
      <ul className="mt-4 divide-y divide-border">
        {history.map((row) => {
          const inst = getInstrument(row.symbol);
          return (
            <li key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span>
                Forex · {inst.display} {row.side.toUpperCase()} · {formatPrice(row.entry, inst.digits)} → {formatPrice(row.exit, inst.digits)}
              </span>
              <span className={row.pnl >= 0 ? "text-buy" : "text-sell"}>
                {row.pnl >= 0 ? "Profit" : "Loss"} {showFrozen(row.pnl, ccy, row.fx)}
              </span>
            </li>
          );
        })}
        {quick.filter((bet) => bet.status !== "open").map((bet) => {
          const inst = getInstrument(bet.symbol);
          return (
            <li key={bet.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span>
                Binary · {inst.display} {bet.side === "call" ? "Buy" : "Sell"} · {formatPrice(bet.entry, inst.digits)} → {bet.settle != null ? formatPrice(bet.settle, inst.digits) : "—"}
              </span>
              <span className={bet.result >= 0 ? "text-buy" : "text-sell"}>
                {bet.status === "win" ? "Profit" : bet.status === "loss" ? "Loss" : "Tie"} {showFrozen(bet.result, ccy, bet.fx)}
              </span>
            </li>
          );
        })}
        {options.filter((bet) => bet.status !== "open").map((bet) => {
          const inst = getInstrument(bet.symbol);
          const pnl = bet.status === "win" ? bet.credit - bet.premium : -bet.premium;
          return (
            <li key={bet.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span>
                Option · {inst.display} {bet.side === "call" ? "Call" : "Put"} · strike {formatPrice(bet.strike, inst.digits)}
              </span>
              <span className={pnl >= 0 ? "text-buy" : "text-sell"}>
                {pnl >= 0 ? "Profit" : "Loss"} {showSigned(pnl, ccy)}
              </span>
            </li>
          );
        })}
        {history.length === 0 && quick.every((bet) => bet.status === "open") && options.every((bet) => bet.status === "open") && (
          <p className="py-3 text-sm text-muted">Closed trades show up here.</p>
        )}
      </ul>
      )}
    </div>
  );
}
