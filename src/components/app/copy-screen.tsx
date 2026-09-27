import { toast } from "sonner";
import { market } from "@/lib/market/engine";
import { getInstrument } from "@/lib/market/instruments";
import { useMarketTick } from "@/lib/market/use-market";
import { showSigned, useDisplayCcy } from "@/lib/money/display-ccy";
import { positionPnl, useTradeStore, type Side } from "@/lib/trading/store";
import { formatPct, formatPrice } from "@/lib/utils";

const MASTERS: { name: string; symbol: string; side: Side; win: number; note: string }[] = [
  { name: "Aarav Shah", symbol: "EURUSD", side: "buy", win: 68, note: "London open" },
  { name: "Meera Iyer", symbol: "XAUUSD", side: "buy", win: 64, note: "Gold swing" },
  { name: "Kabir Menon", symbol: "USDJPY", side: "sell", win: 61, note: "Asia range" },
  { name: "Nina Cole", symbol: "BTCUSD", side: "buy", win: 59, note: "Crypto momentum" },
];

export function CopyScreen() {
  useMarketTick();
  const ccy = useDisplayCcy();
  const placeMarket = useTradeStore((s) => s.placeMarket);
  const positions = useTradeStore((s) => s.positions);
  const floating = positions.reduce((sum, pos) => {
    const q = market.getQuote(pos.symbol);
    return sum + positionPnl(pos, q.bid, q.ask);
  }, 0);

  function copy(master: (typeof MASTERS)[number]) {
    const inst = getInstrument(master.symbol);
    const price = market.getQuote(master.symbol).ask;
    const lots = Math.min(50, Math.max(0.01, Math.round(((25 * inst.leverage) / (inst.contractSize * price)) * 100) / 100));
    const res = placeMarket({
      symbol: master.symbol,
      side: master.side,
      lots,
      sl: null,
      tp: null,
      style: "intraday",
      leverage: inst.leverage,
    });
    if (!res.ok) toast.error(res.error);
    else toast.success(`Copied ${master.name} · ${master.side.toUpperCase()} ${inst.display}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-3">
      <h1 className="text-2xl font-medium">Copy</h1>
      <p className="mt-1 text-sm text-muted">One tap copies that trader’s current signal into your account. About $25 of margin.</p>
      <p className={`mt-3 text-sm ${floating >= 0 ? "text-buy" : "text-sell"}`}>Your open P/L {showSigned(floating, ccy)}</p>
      <ul className="mt-4 space-y-3">
        {MASTERS.map((master) => {
          const inst = getInstrument(master.symbol);
          const q = market.getQuote(master.symbol);
          return (
            <li key={master.name} className="rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{master.name}</p>
                  <p className="text-xs text-muted">
                    {inst.display} · {master.side.toUpperCase()} · Win {master.win}% · {master.note}
                  </p>
                  <p className="num mt-1 text-sm">
                    {formatPrice(q.mid, inst.digits)} <span className={q.changePct >= 0 ? "text-buy" : "text-sell"}>{formatPct(q.changePct)}</span>
                  </p>
                </div>
                <button type="button" onClick={() => copy(master)} className="h-10 shrink-0 rounded-full bg-white px-4 text-sm font-semibold text-[#111214]">
                  Copy
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
