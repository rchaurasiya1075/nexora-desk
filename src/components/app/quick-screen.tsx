import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
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
  const trail = useRef<number[]>([]);
  const trailSymbol = useRef("");

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
  if (trailSymbol.current !== selected) {
    trailSymbol.current = selected;
    trail.current = market.getCandles(selected, "1m").slice(-40).map((candle) => candle.c);
  }
  const last = trail.current[trail.current.length - 1];
  if (last !== quote.mid) trail.current = [...trail.current, quote.mid].slice(-70);

  const openHere = bets.find((bet) => bet.status === "open" && bet.symbol === selected);
  const openOther = bets.find((bet) => bet.status === "open" && bet.symbol !== selected);
  const above = openHere ? quote.mid > openHere.entry : quote.mid >= (trail.current[0] ?? quote.mid);
  const winning = openHere ? (openHere.side === "call" ? quote.mid > openHere.entry : quote.mid < openHere.entry) : false;
  const typed = Number(amount);
  const stake = ccy === "INR" ? (Number.isFinite(typed) ? typed / rate : 0) : typed;
  const rateBack = payoutRate(selected);
  const back = stake * (1 + rateBack);
  const step = ccy === "INR" ? 100 : 5;
  const left = openHere ? Math.max(0, Math.ceil((openHere.expiry - now) / 1000)) : 0;

  function go(side: QuickSide) {
    const res = openQuickBet({ symbol: selected, side, stake, seconds });
    if (!res.ok) toast.error(res.error);
    else toast.success(`${side === "call" ? "Higher" : "Lower"} on ${inst.display}`);
  }

  return (
    <div className="-mb-28 flex h-[calc(100dvh-11rem)] flex-col px-3 pt-1 md:mb-0 md:h-[calc(100dvh-4rem)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-subtle">This trade</p>
          <select value={selected} onChange={(e) => select(e.target.value)} className="bg-transparent text-2xl font-medium outline-none">
            {INSTRUMENTS.map((item) => (
              <option key={item.symbol} value={item.symbol}>
                {item.display}
              </option>
            ))}
          </select>
        </div>
        <div className="text-right text-xs">
          <p>Payout {Math.round(rateBack * 100)}%</p>
          <p className="text-muted">{showMoney(balance, ccy)}</p>
        </div>
      </div>
      <p className="num text-3xl font-medium leading-none">{formatPrice(quote.mid, inst.digits)}</p>
      <p className="mt-1 text-xs text-muted">Higher or Lower is decided by this line only.</p>
      {openHere && (
        <p className={`mt-1 text-sm ${winning ? "text-buy" : "text-sell"}`}>
          {openHere.side === "call" ? "Higher" : "Lower"} at {formatPrice(openHere.entry, inst.digits)} · now {above ? "above" : "below"} · {winning ? "winning" : "losing"} · {left}s
        </p>
      )}
      {openOther && (
        <button type="button" className="mt-1 text-left text-xs text-muted underline" onClick={() => select(openOther.symbol)}>
          Open bet is on {getInstrument(openOther.symbol).display}. Show that chart.
        </button>
      )}
      <div className="relative mt-2 min-h-36 flex-1 overflow-hidden rounded-xl border border-white/10 bg-[#0b0c0f]">
        <PriceLine points={trail.current} entry={openHere?.entry} up={openHere ? winning : above} />
        {openHere && <span className="absolute left-2 top-2 text-[10px] uppercase tracking-wide text-white/70">Your entry</span>}
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
      <p className="mt-3 text-xs uppercase tracking-wide text-subtle">Quick history</p>
      <ul className="mt-1 max-h-28 space-y-1 overflow-auto text-xs">
        {bets.slice(0, 12).map((bet) => {
          const remain = Math.max(0, Math.ceil((bet.expiry - now) / 1000));
          const item = getInstrument(bet.symbol);
          const profit = bet.stake * bet.payout;
          const result =
            bet.status === "open"
              ? `${remain}s`
              : bet.status === "win"
                ? `+${showMoney(profit, ccy)}`
                : bet.status === "tie"
                  ? "tie"
                  : `−${showMoney(bet.stake, ccy)}`;
          return (
            <li key={bet.id} className="flex justify-between gap-2">
              <span className="text-muted">
                {item.display} {bet.side === "call" ? "Higher" : "Lower"} {showMoney(bet.stake, ccy)}
              </span>
              <span className={bet.status === "win" ? "text-buy" : bet.status === "loss" ? "text-sell" : "text-fg"}>{result}</span>
            </li>
          );
        })}
        {bets.length === 0 && <li className="text-muted">No quick trades yet.</li>}
      </ul>
    </div>
  );
}

function PriceLine({ points, entry, up }: { points: number[]; entry?: number; up: boolean }) {
  if (points.length < 2) return <p className="p-3 text-xs text-muted">Price line starting…</p>;
  const width = 320;
  const height = 180;
  const marks = entry == null ? points : [...points, entry];
  const min = Math.min(...marks);
  const max = Math.max(...marks);
  const span = max - min || Math.abs(min) * 0.0002 || 1;
  const yOf = (price: number) => height - ((price - min) / span) * (height - 20) - 10;
  const path = points
    .map((price, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${yOf(price).toFixed(1)}`;
    })
    .join(" ");
  const entryY = entry == null ? null : yOf(entry);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="Live price for this trade">
      {entryY != null && <line x1="0" x2={width} y1={entryY} y2={entryY} stroke="rgba(255,255,255,0.75)" strokeDasharray="5 4" />}
      <path d={path} fill="none" stroke={up ? "#7dcea0" : "#e7a19c"} strokeWidth="2.5" />
    </svg>
  );
}
