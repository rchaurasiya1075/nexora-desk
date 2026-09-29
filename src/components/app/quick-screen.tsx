import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { QuickLiveChart } from "@/components/trade/quick-live-chart";
import { market } from "@/lib/market/engine";
import { INSTRUMENTS, getInstrument } from "@/lib/market/instruments";
import { useMarketTick } from "@/lib/market/use-market";
import { inrPerUsd, showFrozen, showMoney, useDisplayCcy } from "@/lib/money/display-ccy";
import { openQuickBet, payoutRate, quickBets, settleQuick, subscribeQuick, type QuickSide } from "@/lib/trading/quick";
import { useTradeStore } from "@/lib/trading/store";
import { formatPrice } from "@/lib/utils";

const TIMES = [
  { id: 30, label: "30s" },
  { id: 60, label: "1m" },
  { id: 300, label: "5m" },
];

export function QuickScreen() {
  useMarketTick();
  const ccy = useDisplayCcy();
  const rate = inrPerUsd();
  const selected = useTradeStore((s) => s.selected);
  const select = useTradeStore((s) => s.select);
  const balance = useTradeStore((s) => s.balance);
  const bets = useSyncExternalStore(subscribeQuick, quickBets, () => []);
  const [seconds, setSeconds] = useState(60);
  const [amount, setAmount] = useState(ccy === "INR" ? "500" : "10");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      settleQuick();
      setNow(Date.now());
    }, 250);
    return () => clearInterval(t);
  }, []);

  const live = bets.find((bet) => bet.status === "open");
  const closed = bets.filter((bet) => bet.status !== "open");
  const focus = live?.symbol ?? selected;
  const inst = getInstrument(focus);
  const quote = market.getQuote(focus);

  if (!quote) return <p className="p-4 text-sm text-muted">Waiting for the price.</p>;

  const typed = Number(amount);
  const stake = ccy === "INR" ? (Number.isFinite(typed) ? typed / rate : 0) : typed;
  const rateBack = payoutRate(focus);
  const back = stake * (1 + rateBack);
  const step = ccy === "INR" ? 100 : 5;
  const above = live ? quote.mid > live.entry : false;
  const winning = live ? (live.side === "call" ? quote.mid > live.entry : quote.mid < live.entry) : false;
  const left = live ? Math.max(0, Math.ceil((live.expiry - now) / 1000)) : 0;

  function go(side: QuickSide) {
    if (live) {
      toast.error("Wait for the open quick trade to finish.");
      return;
    }
    const res = openQuickBet({ symbol: selected, side, stake, seconds });
    if (!res.ok) toast.error(res.error);
    else toast.success(`${side === "call" ? "Higher" : "Lower"} on ${getInstrument(selected).display}`);
  }

  return (
    <div className="-mb-28 flex h-[calc(100dvh-11rem)] flex-col px-3 pt-1 md:mb-0 md:h-[calc(100dvh-4rem)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-subtle">This trade · {inst.display}</p>
          <p className="num text-2xl font-medium leading-none">{formatPrice(quote.mid, inst.digits)}</p>
        </div>
        <div className="text-right text-xs">
          <p>Payout {Math.round(rateBack * 100)}%</p>
          <p className="text-muted">Balance {showMoney(balance, ccy)}</p>
        </div>
      </div>
      {!live && (
        <select value={selected} onChange={(e) => select(e.target.value)} className="mt-1 bg-transparent text-sm text-muted outline-none">
          {INSTRUMENTS.map((item) => (
            <option key={item.symbol} value={item.symbol}>
              {item.display}
            </option>
          ))}
        </select>
      )}
      {live && (
        <p className={`text-sm ${winning ? "text-buy" : "text-sell"}`}>
          {live.side === "call" ? "Higher" : "Lower"} · entry {formatPrice(live.entry, inst.digits)} · price is {above ? "above" : "below"} · {winning ? "winning" : "losing"} · {left}s · stake {showFrozen(live.stake, ccy, live.fx).replace(/^\+/, "")} locked
        </p>
      )}
      <div className="relative mt-2 min-h-[240px] flex-1 overflow-hidden rounded-xl border border-white/10">
        <QuickLiveChart symbol={focus} entry={live?.entry} />
      </div>
      <div className="mt-2 flex gap-1.5">
        {TIMES.map((item) => (
          <button key={item.id} type="button" disabled={!!live} onClick={() => setSeconds(item.id)} className={`h-8 flex-1 rounded-full text-xs disabled:opacity-40 ${seconds === item.id ? "bg-white text-[#111214]" : "bg-white/10 text-muted"}`}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" className="h-10 w-10 rounded-full bg-white/10" disabled={!!live} onClick={() => setAmount(String(Math.max(step, (Number(amount) || 0) - step)))}>−</button>
        <div className="flex h-10 flex-1 items-center justify-center rounded-full bg-white/10">
          <span className="text-muted">{ccy === "INR" ? "₹" : "$"}</span>
          <input value={amount} inputMode="decimal" disabled={!!live} onChange={(e) => setAmount(e.target.value)} className="w-24 bg-transparent text-center outline-none" />
        </div>
        <button type="button" className="h-10 w-10 rounded-full bg-white/10" disabled={!!live} onClick={() => setAmount(String((Number(amount) || 0) + step))}>+</button>
      </div>
      <p className="mt-1 text-center text-xs text-muted">{live ? "Stake is locked until this trade ends." : `If win ${showMoney(back, ccy)}`}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" disabled={!!live} onClick={() => go("call")} className="h-12 rounded-full bg-[#d8f3e4] text-sm font-semibold text-[#146c43] disabled:opacity-40">
          Higher
        </button>
        <button type="button" disabled={!!live} onClick={() => go("put")} className="h-12 rounded-full bg-[#fde2e0] text-sm font-semibold text-[#b42318] disabled:opacity-40">
          Lower
        </button>
      </div>
      <p className="mt-2 text-xs uppercase tracking-wide text-subtle">Settled history</p>
      <ul className="mt-1 max-h-24 space-y-1 overflow-auto text-xs">
        {closed.slice(0, 8).map((bet) => {
          const item = getInstrument(bet.symbol);
          const label = bet.status === "win" ? "Profit" : bet.status === "loss" ? "Loss" : "Tie";
          return (
            <li key={bet.id} className="flex justify-between gap-2">
              <span className="text-muted">
                {item.display} {bet.side === "call" ? "Higher" : "Lower"} · {formatPrice(bet.entry, item.digits)} → {bet.settle != null ? formatPrice(bet.settle, item.digits) : "—"}
              </span>
              <span className={bet.status === "win" ? "text-buy" : bet.status === "loss" ? "text-sell" : "text-fg"}>
                {label} {showFrozen(bet.result, ccy, bet.fx)}
              </span>
            </li>
          );
        })}
        {closed.length === 0 && <li className="text-muted">Finished trades stay here. The result does not move.</li>}
      </ul>
    </div>
  );
}
