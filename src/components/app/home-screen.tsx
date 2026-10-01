import { Link } from "@tanstack/react-router";
import { Bell, Search, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EMPTY_PAY, watchPayDesk, type PayDesk } from "@/lib/ops/p2p";
import { market } from "@/lib/market/engine";
import { INSTRUMENTS, getInstrument, type Instrument } from "@/lib/market/instruments";
import { useMarketTick } from "@/lib/market/use-market";
import { useDeskSession } from "@/lib/firebase/session";
import { ARTICLES } from "@/lib/news";
import { useTradeStore } from "@/lib/trading/store";
import { Logo } from "@/components/layout/site-header";
import { CurrencyToggle, showMoney, showSigned, useDisplayCcy } from "@/lib/money/display-ccy";
import { formatPct, formatPrice } from "@/lib/utils";

const HOME = ["EURUSD", "GBPUSD", "XAUUSD", "USDINR", "EURINR", "BTCUSD"];

export function HomeScreen() {
  useMarketTick();
  const { user } = useDeskSession();
  const balance = useTradeStore((s) => s.balance);
  const history = useTradeStore((s) => s.history);
  const [filter, setFilter] = useState<"all" | "forex" | "gold" | "gainers" | "inr">("all");
  const ccy = useDisplayCcy();
  const [story, setStory] = useState<"news" | "movers" | "gold" | null>(null);
  const [pay, setPay] = useState<PayDesk>(EMPTY_PAY);
  useEffect(() => watchPayDesk(setPay), []);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today = history.filter((row) => row.closedAt >= start.getTime()).reduce((sum, row) => sum + row.pnl, 0);
  const pnl = today;
  const pnlPct = balance > 0 ? (pnl / balance) * 100 : 0;
  const initial = (user?.name || user?.email || "S").slice(0, 1).toUpperCase();
  const eur = market.getQuote("EURUSD");
  const bias = Math.max(8, Math.min(92, Math.round(50 + eur.changePct * 18)));
  const bullish = eur.changePct >= 0;

  const cards = useMemo(() => {
    const pool = HOME.map((symbol) => getInstrument(symbol));
    if (filter === "forex") return pool.filter((inst) => inst.assetClass === "forex");
    if (filter === "gold") return pool.filter((inst) => inst.assetClass === "metals");
    if (filter === "inr") return INSTRUMENTS.filter((inst) => inst.symbol.endsWith("INR"));
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
    <div className="mx-auto max-w-lg px-4 pb-6 pt-3 lg:max-w-6xl lg:px-8 lg:pt-6">
      <header className="flex items-center justify-between">
        <span className="lg:hidden">
          <Logo compact />
        </span>
        <p className="hidden text-sm text-muted lg:block">Home</p>
        <div className="flex items-center gap-1.5">
          <CurrencyToggle />
          <Link to="/support" className="flex h-8 items-center rounded-full bg-bg-subtle px-2.5 text-[11px] font-medium">
            Support
          </Link>
          <Link to="/markets" className="flex size-8 items-center justify-center rounded-full bg-bg-subtle" aria-label="Search markets">
            <Search className="size-3.5" />
          </Link>
          <button type="button" onClick={() => setStory("news")} className="flex size-8 items-center justify-center rounded-full bg-bg-subtle" aria-label="News">
            <Bell className="size-3.5" />
          </button>
          <Link to="/account" className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-fg" aria-label="Profile">
            {user ? initial : <UserRound className="size-3.5" />}
          </Link>
        </div>
      </header>

      <div className="flex flex-col lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-10">
      <div>
      <section className="mt-5">
        <p className="text-[11px] text-subtle">Main balance</p>
        <p className="mt-1 text-[28px] font-semibold leading-none tracking-tight">{showMoney(balance, ccy)}</p>
        <p className={`mt-1.5 text-xs ${pnl >= 0 ? "text-buy" : "text-sell"}`}>
          Settled today {showSigned(pnl, ccy)} ({formatPct(pnlPct)})
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link to="/trade" search={{ desk: "quick" }} className="flex h-9 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-accent-fg">
            Binary
          </Link>
          <Link to="/trade" search={{ desk: "swing" }} className="flex h-9 items-center justify-center rounded-lg bg-bg-subtle text-xs font-medium">
            Swing Trade
          </Link>
        </div>
      </section>

      {(pay.eventTitle || pay.eventImage) && (
        <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-bg-elevated">
          {pay.eventImage && <img src={pay.eventImage} alt="" className="max-h-28 w-full object-cover" />}
          <div className="px-1 py-3">
            <p className="text-[11px] text-subtle">Daily event</p>
            <p className="mt-0.5 text-sm font-medium">{pay.eventTitle}</p>
            {pay.eventText && <p className="mt-1 text-sm text-muted">{pay.eventText}</p>}
          </div>
        </section>
      )}

      <h2 className="mt-7 text-[13px] font-medium text-fg">Stories</h2>
      <div className="mt-2 flex gap-5">
        <StoryBubble label="News" onClick={() => setStory("news")} />
        <StoryBubble label="Movers" onClick={() => setStory("movers")} />
        <StoryBubble label="Gold" onClick={() => setStory("gold")} />
      </div>

      </div>

      <div className="lg:rounded-2xl lg:border lg:border-border lg:p-5">
      <h2 className="mt-7 text-[13px] font-medium lg:mt-0">Watchlist</h2>
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {(
          [
            ["all", "All"],
            ["forex", "Forex"],
            ["gold", "Gold"],
            ["inr", "INR"],
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
      <div className="mt-1 divide-y divide-border">
        {cards.map((inst) => (
          <PairRow key={inst.symbol} inst={inst} />
        ))}
      </div>

      <section className="mt-6">
        <p className="text-[13px] font-medium">Market sentiment</p>
        <p className="mt-1 text-xs text-muted">
          <span className={bullish ? "text-buy" : "text-sell"}>{bias}%</span> {bullish ? "bullish" : "bearish"} on EUR/USD
        </p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-bg-subtle">
          <div className={`h-full ${bullish ? "bg-buy" : "bg-sell"}`} style={{ width: `${bias}%` }} />
        </div>
      </section>
      </div>
      </div>

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

function StoryBubble({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-12 flex-col items-center gap-1">
      <span className="flex size-11 items-center justify-center rounded-full border border-border text-[11px] font-medium">
        {label.slice(0, 1)}
      </span>
      <span className="text-[10px] text-muted">{label}</span>
    </button>
  );
}

function PairRow({ inst }: { inst: Instrument }) {
  const q = market.getQuote(inst.symbol);
  const up = q.changePct >= 0;
  return (
    <div className="flex items-center gap-3 py-3">
      <Link to="/trade" search={{ symbol: inst.symbol }} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{inst.display}</p>
        <p className={`text-xs ${up ? "text-buy" : "text-sell"}`}>{formatPct(q.changePct)}</p>
      </Link>
      <p className="num text-sm font-medium">{formatPrice(q.mid, inst.digits)}</p>
      <Link to="/trade" search={{ symbol: inst.symbol, side: "buy" }} className="flex h-7 w-12 items-center justify-center rounded-md bg-[#00b386] text-[11px] font-semibold text-white">
        Buy
      </Link>
      <Link to="/trade" search={{ symbol: inst.symbol, side: "sell" }} className="flex h-7 w-12 items-center justify-center rounded-md bg-[#eb5b3c] text-[11px] font-semibold text-white">
        Sell
      </Link>
    </div>
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
