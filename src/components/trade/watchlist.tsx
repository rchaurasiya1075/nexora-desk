import { useMemo, useState } from "react";
import {
  ASSET_LABEL,
  INSTRUMENTS,
  type AssetClass,
  getInstrument,
} from "@/lib/market/instruments";
import { market } from "@/lib/market/engine";
import { useMarketTick } from "@/lib/market/use-market";
import { useTradeStore } from "@/lib/trading/store";
import { cn, formatPrice } from "@/lib/utils";
import { Sparkline } from "./sparkline";
import { Search } from "lucide-react";

const CLASSES: Array<AssetClass | "all"> = [
  "all",
  "forex",
  "crypto",
  "metals",
  "indices",
  "energy",
  "shares",
];

export function Watchlist({ onPick }: { onPick?: () => void }) {
  useMarketTick();
  const selected = useTradeStore((s) => s.selected);
  const select = useTradeStore((s) => s.select);
  const [filter, setFilter] = useState<AssetClass | "all">("all");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return INSTRUMENTS.filter((i) => {
      if (filter !== "all" && i.assetClass !== filter) return false;
      if (!query) return true;
      return (
        i.symbol.toLowerCase().includes(query) ||
        i.display.toLowerCase().includes(query) ||
        i.name.toLowerCase().includes(query)
      );
    });
  }, [filter, q]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search markets"
            className="h-11 w-full rounded-sm bg-bg-subtle pl-10 pr-3 text-sm text-fg outline-none shadow-[var(--shadow-border)] placeholder:text-subtle"
          />
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
          {CLASSES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilter(c)}
              className={cn(
                "h-8 shrink-0 rounded-full px-3 text-[12px] text-muted",
                filter === c && "bg-bg-subtle text-fg",
              )}
            >
              {c === "all" ? "All" : ASSET_LABEL[c]}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((inst) => {
          const quote = market.getQuote(inst.symbol);
          const spark = market.getSpark(inst.symbol);
          const active = selected === inst.symbol;
          const up = quote.change >= 0;
          return (
            <button
              key={inst.symbol}
              type="button"
              onClick={() => {
                select(inst.symbol);
                onPick?.();
              }}
              className={cn(
                "flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left transition-colors duration-150 hover:bg-bg-subtle",
                active && "bg-bg-subtle",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-fg">{inst.display}</span>
                  <span className="text-[10px] uppercase tracking-wide text-subtle">
                    {ASSET_LABEL[inst.assetClass]}
                  </span>
                </div>
                <div className="mt-0.5 flex gap-2 text-[11px] num text-muted">
                  <span>Bid {formatPrice(quote.bid, inst.digits)}</span>
                  <span>Ask {formatPrice(quote.ask, inst.digits)}</span>
                </div>
              </div>
              <Sparkline values={spark} up={up} className="hidden sm:block" />
              <div className="w-16 text-right">
                <div className={cn("text-sm num", up ? "text-buy" : "text-sell")}>
                  {formatPrice(quote.mid, inst.digits)}
                </div>
                <div className={cn("text-[11px] num", up ? "text-buy" : "text-sell")}>
                  {up ? "+" : ""}
                  {quote.changePct.toFixed(2)}%
                </div>
              </div>
            </button>
          );
        })}
        {rows.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted">No markets match.</p>
        )}
      </div>
    </div>
  );
}

export function MiniQuote({ symbol }: { symbol: string }) {
  useMarketTick();
  const inst = getInstrument(symbol);
  const q = market.getQuote(symbol);
  return (
    <div className="flex gap-2 text-xs num text-muted">
      <span className="text-sell">{formatPrice(q.bid, inst.digits)}</span>
      <span>/</span>
      <span className="text-buy">{formatPrice(q.ask, inst.digits)}</span>
    </div>
  );
}
