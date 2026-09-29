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

function clock(total: number) {
  const safe = Math.max(0, total);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `00:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

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

  function stepTime(dir: -1 | 1) {
    const allowed = TIMES.filter((item) => item.id <= cap);
    const index = Math.max(0, allowed.findIndex((item) => item.id === seconds));
    const next = allowed[Math.min(allowed.length - 1, Math.max(0, index + dir))];
    if (next) setSeconds(next.id);
  }

  function go(side: QuickSide) {
    if (live) {
      toast.error("Wait for the open binary trade to finish.");
      return;
    }
    const res = openQuickBet({ symbol: selected, side, stake, seconds });
    if (!res.ok) toast.error(res.error);
    else toast.success(`${side === "call" ? "Buy" : "Sell"} on ${getInstrument(selected).display}`);
  }

  return (
    <div className="-mb-28 flex h-[calc(100dvh-13.5rem)] flex-col px-3 pt-1 md:mb-0 lg:h-[calc(100dvh-2rem)] lg:flex-row lg:gap-5 lg:px-6 lg:pt-4">
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
      <div className="relative mt-2 min-h-0 flex-1 overflow-hidden bg-[#0c1424]">
        <QuickLiveChart
          symbol={focus}
          entry={live?.entry}
          openedAt={live?.openedAt ?? (live ? live.expiry - seconds * 1000 : null)}
          expiry={live?.expiry}
          stakeLabel={live ? showMoney(live.stake, ccy) : null}
          side={live?.side}
        />
      </div>
      </div>
      <div className="lg:flex lg:w-[340px] lg:shrink-0 lg:flex-col lg:justify-center lg:rounded-2xl lg:border lg:border-border lg:p-4">
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="flex h-12 items-center justify-between rounded-xl bg-[#1c2433] px-1 text-white">
          <button type="button" className="grid size-10 place-items-center text-xl" disabled={!!live} onClick={() => setAmount(String(Math.max(step, (Number(amount) || 0) - step)))}>−</button>
          <label className="min-w-0 flex-1 text-center">
            <input
              inputMode="decimal"
              value={amount}
              disabled={!!live}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              className="w-full bg-transparent text-center text-base font-semibold text-white outline-none"
              aria-label="Trade amount"
            />
            <p className="text-[10px] text-white/50">amount {ccy === "INR" ? "₹" : "$"}</p>
          </label>
          <button type="button" className="grid size-10 place-items-center text-xl" disabled={!!live} onClick={() => setAmount(String((Number(amount) || 0) + step))}>+</button>
        </div>
        <div className="flex h-12 items-center justify-between rounded-xl bg-[#1c2433] px-2 text-white">
          <button type="button" className="size-8" disabled={!!live} onClick={() => stepTime(-1)}>‹</button>
          <div className="text-center">
            <p className="text-sm font-medium">{clock(live ? left : seconds)}</p>
            <p className="text-[10px] text-white/50">auto close</p>
          </div>
          <button type="button" className="size-8" disabled={!!live} onClick={() => stepTime(1)}>›</button>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 overflow-hidden rounded-xl">
        <button type="button" disabled={!!live} onClick={() => go("put")} className="flex h-16 items-center justify-center gap-3 bg-[#3a2430] text-white disabled:opacity-40">
          <span className="text-2xl text-[#ff5a6a]">▼</span>
          <span className="text-left text-sm font-semibold leading-tight">SELL<br />{Math.round(rateBack * 100)}%</span>
        </button>
        <button type="button" disabled={!!live} onClick={() => go("call")} className="flex h-16 items-center justify-center gap-3 bg-[#16352c] text-white disabled:opacity-40">
          <span className="text-left text-sm font-semibold leading-tight">BUY<br />{Math.round(rateBack * 100)}%</span>
          <span className="text-2xl text-[#2ee59d]">▲</span>
        </button>
      </div>
      <p className="mt-1 text-center text-xs text-muted">{live ? "Trade is on the chart. Stake stays locked until it settles." : `Stake ${showMoney(stake, ccy)} · if win ${showMoney(back, ccy)}`}</p>
      <p className="mt-2 text-xs uppercase tracking-wide text-subtle">Settled history</p>
      <ul className="mt-1 max-h-12 space-y-1 overflow-auto text-xs lg:max-h-24">
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
