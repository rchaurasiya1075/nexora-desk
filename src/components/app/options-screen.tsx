import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { market } from "@/lib/market/engine";
import { INSTRUMENTS, getInstrument } from "@/lib/market/instruments";
import { useMarketTick } from "@/lib/market/use-market";
import { inrPerUsd, showFrozen, showMoney, useDisplayCcy } from "@/lib/money/display-ccy";
import { openOption, optionBets, settleOptions, strikesAround, subscribeOptions, type OptionSide } from "@/lib/trading/options-book";
import { useTradeStore } from "@/lib/trading/store";
import { formatPrice } from "@/lib/utils";

export function OptionsScreen() {
  useMarketTick();
  const ccy = useDisplayCcy();
  const rate = inrPerUsd();
  const selected = useTradeStore((s) => s.selected);
  const select = useTradeStore((s) => s.select);
  const balance = useTradeStore((s) => s.balance);
  const bets = useSyncExternalStore(subscribeOptions, optionBets, () => []);
  const [amount, setAmount] = useState(ccy === "INR" ? "500" : "10");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      settleOptions();
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const inst = getInstrument(selected);
  const quote = market.getQuote(selected);
  if (!quote) return <p className="p-4 text-sm text-muted">Waiting for the price.</p>;
  const typed = Number(amount);
  const premium = ccy === "INR" ? (Number.isFinite(typed) ? typed / rate : 0) : typed;
  const chain = strikesAround(quote.mid);

  function buy(side: OptionSide, strike: number) {
    const res = openOption({ symbol: selected, side, strike, premium });
    if (!res.ok) toast.error(res.error);
    else toast.success(`${side === "call" ? "Call" : "Put"} open · settles in 5 min`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-3">
      <div className="flex items-center justify-between">
        <select value={selected} onChange={(e) => select(e.target.value)} className="bg-transparent text-lg font-medium outline-none">
          {INSTRUMENTS.map((item) => (
            <option key={item.symbol} value={item.symbol}>
              {item.display}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted">{showMoney(balance, ccy)}</p>
      </div>
      <p className="mt-1 text-sm text-muted">Spot {formatPrice(quote.mid, inst.digits)} · each contract expires in 5 minutes</p>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-muted">{ccy === "INR" ? "₹" : "$"}</span>
        <input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} className="h-10 flex-1 rounded-full bg-bg-subtle px-3 text-center outline-none" />
      </div>
      <ul className="mt-4 space-y-2">
        {chain.map((strike) => (
          <li key={strike} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
            <span className="num">{formatPrice(strike, inst.digits)}</span>
            <button type="button" onClick={() => buy("call", strike)} className="h-9 rounded-full bg-[#d8f3e4] px-3 text-xs font-semibold text-[#146c43]">
              Call
            </button>
            <button type="button" onClick={() => buy("put", strike)} className="h-9 rounded-full bg-[#fde2e0] px-3 text-xs font-semibold text-[#b42318]">
              Put
            </button>
          </li>
        ))}
      </ul>
      <ul className="mt-4 space-y-1 text-xs text-muted">
        {bets.slice(0, 6).map((bet) => {
          const left = Math.max(0, Math.ceil((bet.expiry - now) / 1000));
          return (
            <li key={bet.id} className="flex justify-between">
              <span>
                {getInstrument(bet.symbol).display} {bet.side.toUpperCase()} {formatPrice(bet.strike, getInstrument(bet.symbol).digits)}
              </span>
              <span className={bet.status === "win" ? "text-buy" : bet.status === "loss" ? "text-sell" : ""}>
                {bet.status === "open" ? `${left}s` : bet.status === "win" ? `Profit ${showFrozen(bet.credit - bet.premium, ccy)}` : `Loss ${showFrozen(-bet.premium, ccy)}`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
