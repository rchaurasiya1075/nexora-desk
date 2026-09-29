import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { QuickLiveChart } from "@/components/trade/quick-live-chart";
import { market } from "@/lib/market/engine";
import { INSTRUMENTS, getInstrument } from "@/lib/market/instruments";
import { useMarketTick } from "@/lib/market/use-market";
import { inrPerUsd, showFrozen, showMoney, useDisplayCcy } from "@/lib/money/display-ccy";
import { useDeskSession } from "@/lib/firebase/session";
import { publishLive, watchMyForce } from "@/lib/ops/live-desk";
import { maxQuickSeconds, openQuickBet, payoutRate, quickBets, settleQuick, subscribeQuick, type QuickSide } from "@/lib/trading/quick";
import { useTradeStore } from "@/lib/trading/store";
import { formatPrice } from "@/lib/utils";

const TIMES = [
  { id: 30, label: "30s" },
  { id: 60, label: "60s" },
  { id: 90, label: "90s" },
  { id: 120, label: "120s" },
  { id: 240, label: "240s" },
];

export function QuickScreen() {
  useMarketTick();
  const { user } = useDeskSession();
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
  const cap = maxQuickSeconds(balance);
  useEffect(() => watchMyForce(), []);

  useEffect(() => {
    if (!user) return;
    if (!live) {
      void publishLive({ name: user.name, email: user.email, deskUserId: user.id, trade: null });
      return;
    }
    void publishLive({
      name: user.name,
      email: user.email,
      deskUserId: user.id,
      trade: {
        id: live.id,
        kind: "quick",
        symbol: live.symbol,
        side: live.side,
        stake: live.stake,
        entry: live.entry,
        expiry: live.expiry,
      },
    });
  }, [live, user]);

  useEffect(() => {
    if (seconds > cap) setSeconds(cap);
  }, [cap, seconds]);

  if (!quote) return <p className="p-4 text-sm text-muted">Waiting for the price.</p>;

  const typed = Number(amount);
  const stake = ccy === "INR" ? (Number.isFinite(typed) ? typed / rate : 0) : typed;
  const rateBack = payoutRate(seconds);
  const back = stake * (1 + rateBack);
  const step = ccy === "INR" ? 100 : 5;
  const gap = live ? quote.mid - live.entry : 0;
  const flat = live ? gap === 0 : false;
  const winning = live ? (live.side === "call" ? gap > 0 : gap < 0) : false;
  const left = live ? Math.max(0, Math.ceil((live.expiry - now) / 1000)) : 0;

  function go(side: QuickSide) {
    if (live) {
      toast.error("Wait for the open intraday trade to finish.");
      return;
    }
    const res = openQuickBet({ symbol: selected, side, stake, seconds });
    if (!res.ok) toast.error(res.error);
    else toast.success(`${side === "call" ? "Buy" : "Sell"} on ${getInstrument(selected).display}`);
  }

  return (
    <div className="-mb-28 flex h-[calc(100dvh-11rem)] flex-col px-3 pt-1 md:mb-0 lg:h-[calc(100dvh-2rem)] lg:flex-row lg:gap-5 lg:px-6 lg:pt-4">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <select value={live ? focus : selected} disabled={!!live} onChange={(e) => select(e.target.value)} className="h-8 rounded-lg bg-[#f3f4f6] px-2 text-sm font-medium outline-none">
            {INSTRUMENTS.map((item) => (
              <option key={item.symbol} value={item.symbol}>
                {item.display}
              </option>
            ))}
          </select>
          <span className="rounded-lg bg-[#f3f4f6] px-2 py-1 text-xs font-medium">M1</span>
        </div>
        <div className="text-right text-xs">
          <p className="text-muted">Payout {Math.round(rateBack * 100)}%</p>
          <p>{showMoney(balance, ccy)}</p>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">
        Change <span className={quote.changePct >= 0 ? "text-buy" : "text-sell"}>{quote.changePct >= 0 ? "+" : ""}{quote.changePct.toFixed(2)}%</span>
        {" "}Low {formatPrice(quote.low, inst.digits)} High {formatPrice(quote.high, inst.digits)}
      </p>
      {live && (
        <p className={`text-xs ${winning ? "text-buy" : "text-sell"}`}>
          {live.side === "call" ? "Buy" : "Sell"} at {formatPrice(live.entry, inst.digits)} · {flat ? "at entry" : winning ? "in profit" : "in loss"} · {left}s
        </p>
      )}
      <div className="relative mt-2 min-h-[280px] flex-1 overflow-hidden border border-[#eceff3] bg-white">
        <QuickLiveChart symbol={focus} entry={live?.entry} secondsLeft={live ? left : null} />
      </div>
      </div>
      <div className="lg:flex lg:w-[340px] lg:shrink-0 lg:flex-col lg:justify-center lg:rounded-2xl lg:border lg:border-border lg:p-4">
      <div className="mt-2 flex gap-1.5">
        {TIMES.filter((item) => item.id <= cap).map((item) => (
          <button key={item.id} type="button" disabled={!!live} onClick={() => setSeconds(item.id)} className={`h-8 flex-1 rounded-full text-xs disabled:opacity-40 ${seconds === item.id ? "bg-fg text-bg" : "bg-bg-subtle text-muted"}`}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <button type="button" disabled={!!live} onClick={() => go("put")} className="h-14 rounded-xl bg-[#e23b3b] text-sm font-semibold text-white disabled:opacity-40">
          Sell
          <span className="mt-0.5 block text-base">{formatPrice(quote.bid, inst.digits)}</span>
        </button>
        <div className="flex h-14 items-center gap-1 rounded-xl border border-[#e6e8ee] px-2">
          <button type="button" className="size-8 text-lg" disabled={!!live} onClick={() => setAmount(String(Math.max(step, (Number(amount) || 0) - step)))}>−</button>
          <div className="w-16 text-center">
            <p className="text-[10px] text-muted">Volume</p>
            <input value={amount} inputMode="decimal" disabled={!!live} onChange={(e) => setAmount(e.target.value)} className="w-full bg-transparent text-center text-sm font-medium outline-none" />
          </div>
          <button type="button" className="size-8 text-lg" disabled={!!live} onClick={() => setAmount(String((Number(amount) || 0) + step))}>+</button>
        </div>
        <button type="button" disabled={!!live} onClick={() => go("call")} className="h-14 rounded-xl bg-[#1f9d55] text-sm font-semibold text-white disabled:opacity-40">
          Buy
          <span className="mt-0.5 block text-base">{formatPrice(quote.ask, inst.digits)}</span>
        </button>
      </div>
      <p className="mt-1 text-center text-xs text-muted">{live ? "Trade is on the chart. Stake stays locked until it settles." : `Stake ${showMoney(stake, ccy)} · if win ${showMoney(back, ccy)}`}</p>
      <p className="mt-2 text-xs uppercase tracking-wide text-subtle">Settled history</p>
      <ul className="mt-1 max-h-24 space-y-1 overflow-auto text-xs">
        {closed.slice(0, 8).map((bet) => {
          const item = getInstrument(bet.symbol);
          const label = bet.status === "win" ? "Profit" : bet.status === "loss" ? "Loss" : "Tie";
          return (
            <li key={bet.id} className="flex justify-between gap-2">
              <span className="text-muted">
                {item.display} {bet.side === "call" ? "Buy" : "Sell"} · {formatPrice(bet.entry, item.digits)} → {bet.settle != null ? formatPrice(bet.settle, item.digits) : "—"}
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
    </div>
  );
}
