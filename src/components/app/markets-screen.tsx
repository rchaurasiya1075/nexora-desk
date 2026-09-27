import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Sparkline } from "@/components/trade/sparkline";
import { market } from "@/lib/market/engine";
import { INSTRUMENTS, type AssetClass } from "@/lib/market/instruments";
import { useMarketTick } from "@/lib/market/use-market";
import { formatPct, formatPrice } from "@/lib/utils";

const RECENT_KEY = "sikkaaa.recent.pairs";

export function readRecent() {
  try {
    const rows = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as string[];
    return Array.isArray(rows) ? rows.slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function rememberPair(symbol: string) {
  const next = [symbol, ...readRecent().filter((item) => item !== symbol)].slice(0, 6);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function MarketsScreen() {
  useMarketTick();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | AssetClass>("all");
  const recent = readRecent();
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return INSTRUMENTS.filter((inst) => {
      if (filter !== "all" && inst.assetClass !== filter) return false;
      if (!needle) return true;
      return (
        inst.display.toLowerCase().includes(needle) ||
        inst.name.toLowerCase().includes(needle) ||
        inst.symbol.toLowerCase().includes(needle)
      );
    });
  }, [q, filter]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-3xl font-semibold tracking-tight">Markets</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search forex, gold, crypto"
        className="mt-4 h-12 w-full rounded-2xl border border-border bg-bg-elevated px-4 text-sm outline-none focus:border-accent"
      />
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {(
          [
            ["all", "All"],
            ["forex", "Forex"],
            ["metals", "Metals"],
            ["crypto", "Crypto"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${filter === id ? "bg-accent text-accent-fg" : "bg-bg-subtle text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {recent.length > 0 && !q && (
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {recent.map((symbol) => {
            const inst = INSTRUMENTS.find((item) => item.symbol === symbol);
            if (!inst) return null;
            return (
              <Link
                key={symbol}
                to="/trade"
                search={{ symbol }}
                className="shrink-0 rounded-full bg-bg-subtle px-3 py-1.5 text-xs"
              >
                {inst.display}
              </Link>
            );
          })}
        </div>
      )}
      <ul className="mt-4 divide-y divide-border">
        {rows.map((inst) => {
          const quote = market.getQuote(inst.symbol);
          const up = quote.changePct >= 0;
          return (
            <li key={inst.symbol} className="flex items-center gap-3 py-3">
              <Link to="/trade" search={{ symbol: inst.symbol }} className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{inst.display}</span>
                <span className="text-[11px] text-muted">
                  Bid {formatPrice(quote.bid, inst.digits)} · Ask {formatPrice(quote.ask, inst.digits)}
                </span>
              </Link>
              <Sparkline values={market.getCandles(inst.symbol, "15m").slice(-18).map((c) => c.c)} up={up} />
              <span className="w-24 text-right">
                <span className="block num text-sm">{formatPrice(quote.mid, inst.digits)}</span>
                <span className={up ? "text-xs text-buy" : "text-xs text-sell"}>{formatPct(quote.changePct)}</span>
              </span>
              <Link
                to="/trade"
                search={{ symbol: inst.symbol }}
                className="rounded-lg bg-fg px-3 py-2 text-xs text-bg"
              >
                Trade
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
