import { FEATURED_SYMBOLS, getInstrument } from "@/lib/market/instruments";
import { market } from "@/lib/market/engine";
import { useMarketTick } from "@/lib/market/use-market";
import { cn, formatPrice } from "@/lib/utils";

export function TickerTape() {
  useMarketTick();
  const items = [...FEATURED_SYMBOLS, ...FEATURED_SYMBOLS, ...FEATURED_SYMBOLS];
  return (
    <div className="overflow-hidden border-y border-border bg-bg-elevated">
      <div className="tape-track flex w-max">
        {items.map((sym, i) => {
          const inst = getInstrument(sym);
          const q = market.getQuote(sym);
          const up = q.change >= 0;
          return (
            <div
              key={`${sym}-${i}`}
              className="flex items-center gap-3 px-6 py-3 text-sm"
            >
              <span className="text-muted">{inst.display}</span>
              <span className="num text-fg">{formatPrice(q.mid, inst.digits)}</span>
              <span className={cn("num text-[12px]", up ? "text-buy" : "text-sell")}>
                {up ? "+" : ""}
                {q.changePct.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
