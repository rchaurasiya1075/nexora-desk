import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { market } from "@/lib/market/engine";
import { INSTRUMENTS } from "@/lib/market/instruments";
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
  const recent = readRecent();
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return INSTRUMENTS.filter((inst) => {
      if (!needle) return true;
      return (
        inst.display.toLowerCase().includes(needle) ||
        inst.name.toLowerCase().includes(needle) ||
        inst.symbol.toLowerCase().includes(needle)
      );
    });
  }, [q]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-display text-3xl">Markets</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search forex pair"
        className="mt-4 h-11 w-full rounded-xl border border-border bg-transparent px-3 text-sm outline-none"
      />
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
                <span className="block text-sm">{inst.display}</span>
                <span className="text-[11px] text-muted">{inst.name}</span>
              </Link>
              <span className="text-right">
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
