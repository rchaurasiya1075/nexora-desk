import { Link } from "@tanstack/react-router";
import { Bell, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { market } from "@/lib/market/engine";
import { INSTRUMENTS, getInstrument, type Instrument } from "@/lib/market/instruments";
import { useMarketTick } from "@/lib/market/use-market";
import { useDeskSession } from "@/lib/firebase/session";
import { ARTICLES } from "@/lib/news";
import { positionPnl, useTradeStore } from "@/lib/trading/store";
import { formatMoney, formatPct, formatPrice, formatSigned } from "@/lib/utils";

const HOME = ["EURUSD", "GBPUSD", "XAUUSD", "USDJPY", "BTCUSD", "USDCHF"];

export function HomeScreen() {
  useMarketTick();
  const { user } = useDeskSession();
  const balance = useTradeStore((s) => s.balance);
  const positions = useTradeStore((s) => s.positions);
  const history = useTradeStore((s) => s.history);
  const [filter, setFilter] = useState<"all" | "forex" | "gold" | "gainers">("all");
  const [story, setStory] = useState<"news" | "movers" | "gold" | null>(null);
  const floating = positions.reduce((sum, pos) => {
    const q = market.getQuote(pos.symbol);
    return sum + positionPnl(pos, q.bid, q.ask);
  }, 0);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today = history.filter((row) => row.closedAt >= start.getTime()).reduce((sum, row) => sum + row.pnl, 0);
  const pnl = today + floating;
  const pnlPct = balance > 0 ? (pnl / balance) * 100 : 0;
  const initial = (user?.name || user?.email || "S").slice(0, 1).toUpperCase();
  const eur = market.getQuote("EURUSD");
  const bias = Math.max(8, Math.min(92, Math.round(50 + eur.changePct * 18)));
  const bullish = eur.changePct >= 0;

  const cards = useMemo(() => {
    const pool = HOME.map((symbol) => getInstrument(symbol));
    if (filter === "forex") return pool.filter((inst) => inst.assetClass === "forex");
    if (filter === "gold") return pool.filter((inst) => inst.assetClass === "metals");
    if (filter === "gainers") {
      return [...INSTRUMENTS]
        .filter((inst) => market.getQuote(inst.symbol).changePct > 0)
        .sort((a, b) => market.getQuote(b.symbol).changePct - market.getQuote(a.symbol).changePct)
        .slice(0, 6);
    }
    return pool;
  }, [filter]);

  const movers = [...INSTRUMENTS]
    .sort((a, b) => Math.abs(market.getQuote(b.symbol).changePct) - Math.abs(market.getQuote(a.symbol).changePct))
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <header className="flex items-center justify-between">
        <span className="text-sm font-bold uppercase tracking-[0.16em]">SIKKAAA</span>
        <div className="flex items-center gap-2">
          <Link to="/markets" className="flex size-10 items-center justify-center rounded-full bg-bg-subtle" aria-label="Search markets">
            <Search className="size-4" />
          </Link>
          <button type="button" onClick={() => setStory("news")} className="flex size-10 items-center justify-center rounded-full bg-bg-subtle" aria-label="News">
            <Bell className="size-4" />
          </button>
          <Link to="/account" className="flex size-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg" aria-label="Profile">
            {user ? initial : <UserRound className="size-4" />}
          </Link>
        </div>
      </header>

      <section className="mt-5 rounded-2xl border border-border bg-bg-elevated p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-subtle">Portfolio balance</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight">{formatMoney(balance)}</p>
        <p className={`mt-2 text-sm font-medium ${pnl >= 0 ? "text-buy" : "text-sell"}`}>
          Today's P/L: {formatSigned(pnl)} ({formatPct(pnlPct)})
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link to="/trade" className="flex h-12 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-accent-fg active:scale-[0.98]">
            Quick Trade
          </Link>
          <Link to="/trade" search={{ view: "positions" }} className="flex h-12 items-center justify-center rounded-xl bg-bg-subtle text-sm font-medium active:scale-[0.98]">
            Open Positions
          </Link>
        </div>
      </section>

      <h2 className="mt-6 text-xs uppercase tracking-[0.16em] text-subtle">Market stories</h2>
      <div className="mt-3 flex gap-4">
        <StoryBubble label="Live News" tone="bg-sell" onClick={() => setStory("news")} />
        <StoryBubble label="Top Movers" tone="bg-buy" onClick={() => setStory("movers")} />
        <StoryBubble label="Gold" tone="bg-accent" onClick={() => setStory("gold")} />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-sm font-medium">Watchlist</h2>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {(
          [
            ["all", "All"],
            ["forex", "Forex"],
            ["gold", "Gold"],
            ["gainers", "Gainers"],
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
      <div className="mt-3 grid grid-cols-2 gap-2">
        {cards.map((inst) => (
          <PairCard key={inst.symbol} inst={inst} />
        ))}
      </div>

      <section className="mt-5 rounded-2xl border border-border p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-subtle">Market sentiment</p>
        <p className="mt-2 text-sm">
          <span className={bullish ? "text-buy" : "text-sell"}>{bias}%</span> session bias is {bullish ? "bullish" : "bearish"} on EUR/USD
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-subtle">
          <div className={`h-full ${bullish ? "bg-buy" : "bg-sell"}`} style={{ width: `${bias}%` }} />
        </div>
      </section>

      {story && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 md:items-center md:justify-center" onClick={() => setStory(null)}>
          <div className="screen-in w-full max-w-md rounded-2xl bg-bg-elevated p-5" onClick={(e) => e.stopPropagation()}>
            {story === "news" && (
              <>
                <p className="text-xs uppercase tracking-[0.16em] text-sell">Live news</p>
                <h3 className="mt-2 text-xl font-semibold">{ARTICLES[0]?.title}</h3>
                <p className="mt-2 text-sm text-muted">{ARTICLES[0]?.standfirst}</p>
                <Link to="/news" className="mt-4 inline-block text-sm text-accent">Open news</Link>
              </>
            )}
            {story === "movers" && (
              <>
                <p className="text-xs uppercase tracking-[0.16em] text-buy">Top movers</p>
                <ul className="mt-3 space-y-3">
                  {movers.map((inst) => {
                    const q = market.getQuote(inst.symbol);
                    return (
                      <li key={inst.symbol} className="flex justify-between text-sm">
                        <span>{inst.display}</span>
                        <span className={q.changePct >= 0 ? "text-buy" : "text-sell"}>{formatPct(q.changePct)}</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {story === "gold" && <GoldStory />}
            <button type="button" className="mt-5 h-11 w-full rounded-xl bg-bg-subtle text-sm" onClick={() => setStory(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StoryBubble({ label, tone, onClick }: { label: string; tone: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-16 flex-col items-center gap-2">
      <span className={`size-14 rounded-full p-0.5 ${tone}`}>
        <span className="flex size-full items-center justify-center rounded-full bg-bg text-[10px] font-semibold">
          {label.slice(0, 1)}
        </span>
      </span>
      <span className="text-[10px] text-muted">{label}</span>
    </button>
  );
}

function PairCard({ inst }: { inst: Instrument }) {
  const q = market.getQuote(inst.symbol);
  const up = q.changePct >= 0;
  return (
    <article className="rounded-2xl border border-border bg-bg-elevated p-3">
      <Link to="/trade" search={{ symbol: inst.symbol }}>
        <p className="text-sm font-medium">{inst.display}</p>
        <p className="mt-1 num text-lg">{formatPrice(q.mid, inst.digits)}</p>
        <p className={up ? "text-xs text-buy" : "text-xs text-sell"}>{formatPct(q.changePct)}</p>
      </Link>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <Link to="/trade" search={{ symbol: inst.symbol, side: "buy" }} className="flex h-9 items-center justify-center rounded-lg bg-buy text-[11px] font-semibold text-buy-fg">
          BUY
        </Link>
        <Link to="/trade" search={{ symbol: inst.symbol, side: "sell" }} className="flex h-9 items-center justify-center rounded-lg bg-sell text-[11px] font-semibold text-sell-fg">
          SELL
        </Link>
      </div>
    </article>
  );
}

function GoldStory() {
  const q = market.getQuote("XAUUSD");
  const inst = getInstrument("XAUUSD");
  return (
    <>
      <p className="text-xs uppercase tracking-[0.16em] text-accent">Gold</p>
      <h3 className="mt-2 text-xl font-semibold">XAU/USD {formatPrice(q.mid, inst.digits)}</h3>
      <p className={q.changePct >= 0 ? "mt-2 text-sm text-buy" : "mt-2 text-sm text-sell"}>{formatPct(q.changePct)} this session</p>
      <Link to="/trade" search={{ symbol: "XAUUSD" }} className="mt-4 inline-block text-sm text-accent">
        Trade gold
      </Link>
    </>
  );
}
