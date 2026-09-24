import { useMemo, useState } from "react";
import {
  ASSET_LABEL,
  INSTRUMENTS,
  type AssetClass,
} from "@/lib/market/instruments";
import { market } from "@/lib/market/engine";
import { useMarketTick } from "@/lib/market/use-market";
import { useTradeStore, type Side } from "@/lib/trading/store";
import { cn, formatPrice } from "@/lib/utils";
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

const POPULAR = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD", "US100", "USOIL"];

export function Watchlist({
  onPick,
  onTrade,
}: {
  onPick?: () => void;
  onTrade?: (symbol: string, side: Side) => void;
}) {
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

  const grouped =
    filter === "all" && !q.trim()
      ? [
          { label: "Popular markets", items: rows.filter((i) => POPULAR.includes(i.symbol)) },
          { label: "All markets", items: rows.filter((i) => !POPULAR.includes(i.symbol)) },
        ]
      : [{ label: filter === "all" ? "Markets" : ASSET_LABEL[filter], items: rows }];

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-elevated">
      <div className="border-b border-border px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search markets"
            className="h-9 w-full rounded-sm bg-bg pl-8 pr-3 text-[12px] text-fg outline-none shadow-[var(--shadow-border)] placeholder:text-subtle"
          />
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto">
          {CLASSES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilter(c)}
              className={cn(
                "h-7 shrink-0 rounded-sm px-2 text-[11px] text-muted",
                filter === c && "bg-bg-subtle text-fg",
              )}
            >
              {c === "all" ? "All" : ASSET_LABEL[c]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_72px_72px_56px] border-b border-border px-3 py-1.5 text-[10px] uppercase tracking-wide text-subtle">
        <span>Market</span>
        <span className="text-right">Sell</span>
        <span className="text-right">Buy</span>
        <span className="text-right">Chg</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {grouped.map((g) => (
          <div key={g.label}>
            <p className="sticky top-0 z-10 bg-bg-elevated px-3 py-1.5 text-[10px] uppercase tracking-wide text-subtle">
              {g.label}
            </p>
            {g.items.map((inst) => {
              const quote = market.getQuote(inst.symbol);
              const active = selected === inst.symbol;
              const up = quote.change >= 0;
              return (
                <div
                  key={inst.symbol}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_72px_72px_56px] items-center border-b border-border px-3 py-1.5 text-[12px]",
                    active && "bg-bg-subtle",
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => {
                      select(inst.symbol);
                      onPick?.();
                    }}
                  >
                    <span className="block truncate font-medium text-fg">{inst.display}</span>
                    <span className="block text-[10px] text-subtle">
                      {ASSET_LABEL[inst.assetClass]}
                      {quote.live ? " · Live" : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="text-right num text-sell hover:underline"
                    onClick={() => onTrade?.(inst.symbol, "sell")}
                  >
                    {formatPrice(quote.bid, inst.digits)}
                  </button>
                  <button
                    type="button"
                    className="text-right num text-buy hover:underline"
                    onClick={() => onTrade?.(inst.symbol, "buy")}
                  >
                    {formatPrice(quote.ask, inst.digits)}
                  </button>
                  <span className={cn("text-right num", up ? "text-buy" : "text-sell")}>
                    {up ? "+" : ""}
                    {quote.changePct.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
        {rows.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted">No markets match.</p>
        )}
      </div>
    </div>
  );
}
