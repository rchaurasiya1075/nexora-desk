import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { TradingViewChart } from "@/components/trade/tv-chart";
import { market } from "@/lib/market/engine";
import { INSTRUMENTS, getInstrument } from "@/lib/market/instruments";
import { useMarketTick } from "@/lib/market/use-market";
import { inrPerUsd, showMoney, useDisplayCcy } from "@/lib/money/display-ccy";
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

  const inst = getInstrument(selected);
  const quote = market.getQuote(selected);
  if (!quote) return <p className="p-4 text-sm text-muted">Waiting for the price.</p>;
  const typed = Number(amount);
  const stake = ccy === "INR" ? (Number.isFinite(typed) ? typed / rate : 0) : typed;
  const rateBack = payoutRate(selected);
  const back = stake * (1 + rateBack);
  const step = ccy === "INR" ? 100 : 5;

  function go(side: QuickSide) {
    const res = openQuickBet({ symbol: selected, side, stake, seconds });
    if (!res.ok) toast.error(res.error);
    else toast.success(side === "call" ? "Higher placed" : "Lower placed");
  }

  return (
    <div className="-mb-28 flex h-[calc(100dvh-11rem)] flex-col px-3 pt-1 md:mb-0 md:h-[calc(100dvh-4rem)]">
      <div className="flex items-center justify-between gap-2">
        <select value={selected} onChange={(e) => select(e.target.value)} className="bg-transparent text-lg font-medium outline-none">
          {INSTRUMENTS.map((item) => (
            <option key={item.symbol} value={item.symbol}>
              {item.display}
            </option>
          ))}
        </select>
        <div className="text-right text-xs">
          <p>Payout {Math.round(rateBack * 100)}%</p>
          <p className="text-muted">{showMoney(balance, ccy)}</p>
        </div>
      </div>
      <p className="num text-xl">{formatPrice(quote.mid, inst.digits)}</p>
      <div className="relative mt-2 min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10">
        <TradingViewChart symbol={selected} />
      </div>
      <div className="mt-2 flex gap-1.5">
        {TIMES.map((item) => (
          <button key={item.id} type="button" onClick={() => setSeconds(item.id)} className={`h-8 flex-1 rounded-full text-xs ${seconds === item.id ? "bg-white text-[#111214]" : "bg-white/10 text-muted"}`}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" className="h-10 w-10 rounded-full bg-white/10" onClick={() => setAmount(String(Math.max(step, (Number(amount) || 0) - step)))}>−</button>
        <div className="flex h-10 flex-1 items-center justify-center rounded-full bg-white/10">
          <span className="text-muted">{ccy === "INR" ? "₹" : "$"}</span>
          <input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} className="w-24 bg-transparent text-center outline-none" />
        </div>
        <button type="button" className="h-10 w-10 rounded-full bg-white/10" onClick={() => setAmount(String((Number(amount) || 0) + step))}>+</button>
      </div>
      <p className="mt-1 text-center text-xs text-muted">If win {showMoney(back, ccy)}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => go("call")} className="h-12 rounded-full bg-[#d8f3e4] text-sm font-semibold text-[#146c43]">
          Higher
        </button>
        <button type="button" onClick={() => go("put")} className="h-12 rounded-full bg-[#fde2e0] text-sm font-semibold text-[#b42318]">
          Lower
        </button>
      </div>
      <ul className="mt-2 max-h-24 space-y-1 overflow-auto text-xs">
        {bets.slice(0, 4).map((bet) => {
          const left = Math.max(0, Math.ceil((bet.expiry - now) / 1000));
          const item = getInstrument(bet.symbol);
          return (
            <li key={bet.id} className="flex justify-between text-muted">
              <span>
                {item.display} {bet.side === "call" ? "Higher" : "Lower"} {showMoney(bet.stake, ccy)}
              </span>
              <span className={bet.status === "win" ? "text-buy" : bet.status === "loss" ? "text-sell" : "text-fg"}>
                {bet.status === "open" ? `${left}s` : bet.status.toUpperCase()}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
