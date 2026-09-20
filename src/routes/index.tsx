import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Clock3,
  LineChart,
  Shield,
  SlidersHorizontal,
  Smartphone,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/layout/site-header";
import { LiveTable } from "@/components/markets/live-table";
import { TickerTape } from "@/components/markets/ticker";
import { Button } from "@/components/ui/button";
import { ARTICLES } from "@/lib/news";
import { FEATURED_SYMBOLS, getInstrument } from "@/lib/market/instruments";
import { market } from "@/lib/market/engine";
import { useMarketTick } from "@/lib/market/use-market";
import { useTradeStore } from "@/lib/trading/store";
import { formatPrice } from "@/lib/utils";
import { useEffect } from "react";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  useEffect(() => {
    market.start();
  }, []);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteHeader />
      <TickerTape />
      <Hero />
      <AssetStrip />
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-subtle">Live prices</p>
            <h2 className="mt-2 font-display text-3xl md:text-4xl">Trade without waiting</h2>
          </div>
          <Button asChild variant="outline">
            <Link to="/markets">All markets</Link>
          </Button>
        </div>
        <LiveTable />
      </section>
      <Why />
      <Platforms />
      <NewsTeasers />
      <Cta />
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-[1.15fr_0.85fr] md:py-24">
      <div>
        <p className="stagger-in text-xs uppercase tracking-[0.2em] text-subtle">
          Global markets desk
        </p>
        <h1 className="stagger-in mt-4 font-display text-[clamp(2.4rem,6vw,4.6rem)] leading-[0.95] text-fg">
          More markets.
          <br />
          More hours.
          <br />
          More working trades.
        </h1>
        <p className="stagger-in mt-6 max-w-lg text-base text-muted md:text-lg">
          A full web trader in the spirit of a global FX broker — forex, gold,
          crypto, indices, oil and share CFDs. Sign in, request a deposit, wait
          for admin approval, then trade. Orders fill at the live bid and ask.
        </p>
        <div className="stagger-in mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/trade">
              Start trading
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/pricing">How much it costs</Link>
          </Button>
        </div>
        <dl className="mt-10 grid grid-cols-3 gap-4 max-w-md">
          <HeroStat k="Markets" v="32" />
          <HeroStat k="Sign-in" v="Yes" />
          <HeroStat k="Min size" v="0.01" />
        </dl>
      </div>
      <HeroTicket />
    </section>
  );
}

function HeroStat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-subtle">{k}</dt>
      <dd className="font-display text-2xl">{v}</dd>
    </div>
  );
}

function HeroTicket() {
  useMarketTick();
  const select = useTradeStore((s) => s.select);
  const inst = getInstrument("EURUSD");
  const q = market.getQuote("EURUSD");
  return (
    <div className="rounded-xl bg-bg-elevated p-2 shadow-[var(--shadow-border)]">
      <div className="rounded-lg bg-bg p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-subtle">EUR/USD · Standard</p>
            <p className="mt-2 font-display text-4xl num">{formatPrice(q.mid, inst.digits)}</p>
            <p className={`mt-1 text-sm num ${q.change >= 0 ? "text-buy" : "text-sell"}`}>
              {q.change >= 0 ? "+" : ""}
              {q.changePct.toFixed(2)}% session
            </p>
          </div>
          <span className="rounded-full bg-bg-subtle px-2 py-1 text-[11px] text-muted">
            Demo fill
          </span>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Link
            to="/trade"
            onClick={() => select("EURUSD")}
            className="flex h-14 flex-col items-center justify-center rounded-sm bg-sell text-sell-fg"
          >
            <span className="text-[11px] opacity-80">Sell {formatPrice(q.bid, 5)}</span>
            <span className="text-sm font-medium">SELL</span>
          </Link>
          <Link
            to="/trade"
            onClick={() => select("EURUSD")}
            className="flex h-14 flex-col items-center justify-center rounded-sm bg-buy text-buy-fg"
          >
            <span className="text-[11px] opacity-80">Buy {formatPrice(q.ask, 5)}</span>
            <span className="text-sm font-medium">BUY</span>
          </Link>
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-muted">
          Spread {inst.spreadStd.toFixed(5)} · 50:1 leverage · 0.10 lots ≈ $230 margin
        </p>
      </div>
    </div>
  );
}

function AssetStrip() {
  const cards = [
    {
      symbol: FEATURED_SYMBOLS[0],
      title: "Raw FX",
      copy: "Majors from 0.2 pips on RAW, or 1.0 pip spread-only on Standard.",
    },
    {
      symbol: "BTCUSD",
      title: "24/7 crypto",
      copy: "Bitcoin, ether, solana and XRP. Weekend book stays open.",
    },
    {
      symbol: "XAUUSD",
      title: "Spot gold",
      copy: "XAU/USD near $4,386 with a 7-day session on the demo desk.",
    },
    {
      symbol: "NVDA",
      title: "0-commission shares",
      copy: "NVDA, Tesla, Apple and the rest — share CFDs, no ticket fee.",
    },
    {
      symbol: "US100",
      title: "Indices",
      copy: "US Tech 100, Wall Street 30, US 500, Germany 40, UK 100.",
    },
    {
      symbol: "USOIL",
      title: "Energy",
      copy: "WTI, Brent and nat gas with $1-per-tick math on 1.00 lot WTI.",
    },
  ];
  return (
    <section className="border-y border-border bg-bg-elevated">
      <div className="mx-auto grid max-w-6xl gap-px bg-border md:grid-cols-3">
        {cards.map((c) => (
          <AssetCard key={c.title} {...c} />
        ))}
      </div>
    </section>
  );
}

function AssetCard({
  symbol,
  title,
  copy,
}: {
  symbol: string;
  title: string;
  copy: string;
}) {
  useMarketTick();
  const inst = getInstrument(symbol);
  const q = market.getQuote(symbol);
  const select = useTradeStore((s) => s.select);
  return (
    <Link
      to="/trade"
      onClick={() => select(symbol)}
      className="bg-bg-elevated p-6 transition-colors duration-150 hover:bg-bg-subtle"
    >
      <p className="text-xs uppercase tracking-wide text-subtle">{inst.display}</p>
      <h3 className="mt-3 font-display text-2xl">{title}</h3>
      <p className="mt-2 text-sm text-muted">{copy}</p>
      <p className="mt-4 num text-sm text-fg">{formatPrice(q.mid, inst.digits)}</p>
    </Link>
  );
}

function Why() {
  const items = [
    {
      icon: SlidersHorizontal,
      title: "Two pricing books",
      copy: "Standard is spread-only. RAW is tighter quotes plus $3.50 per side per FX lot — the same shape as a live RAW account.",
    },
    {
      icon: LineChart,
      title: "Working execution",
      copy: "Market, limit and stop orders. Stop-loss, take-profit, partial close, margin call at 100% and stop-out at 50%.",
    },
    {
      icon: Clock3,
      title: "Hours that match the product",
      copy: "FX 24/5 feel, gold 7-day, crypto 24/7, US share CFDs with extended hours. The demo tape never sleeps so Sunday still trades.",
    },
    {
      icon: Shield,
      title: "Risk is visible",
      copy: "Every ticket shows required margin, spread cost and the rupee equivalent using live USD/INR.",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <p className="text-xs uppercase tracking-[0.18em] text-subtle">Why this desk</p>
      <h2 className="mt-2 max-w-xl font-display text-3xl md:text-4xl">
        Built to feel like a broker, without the $100 deposit.
      </h2>
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {items.map((it) => (
          <div key={it.title} className="rounded-xl bg-bg-elevated p-6 shadow-[var(--shadow-border)]">
            <it.icon className="size-5 text-accent" />
            <h3 className="mt-4 font-display text-2xl">{it.title}</h3>
            <p className="mt-2 text-sm text-muted">{it.copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Platforms() {
  return (
    <section className="border-y border-border bg-bg-elevated">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:grid-cols-2 md:items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-subtle">Web trader</p>
          <h2 className="mt-2 font-display text-3xl md:text-4xl">
            One screen. Watchlist, chart, ticket, positions.
          </h2>
          <p className="mt-4 text-sm text-muted md:text-base">
            Desktop gets the three-pane desk. Phone gets a full-height chart, a
            positions drawer, and a ticket sheet with 44px Buy/Sell — the same
            engine underneath.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-muted">
            <li className="flex gap-2">
              <Smartphone className="mt-0.5 size-4 shrink-0 text-accent" />
              Mobile ticket, market sheet, safe-area padding
            </li>
            <li className="flex gap-2">
              <LineChart className="mt-0.5 size-4 shrink-0 text-accent" />
              Candles from 1 minute to daily with a live last price
            </li>
          </ul>
        </div>
        <div className="rounded-xl bg-bg p-5 shadow-[var(--shadow-border)]">
          <p className="text-[11px] uppercase tracking-wide text-subtle">Account bar</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-bg-subtle p-3">
              <p className="text-[11px] text-subtle">Balance</p>
              <p className="num text-lg">after deposit</p>
            </div>
            <div className="rounded-md bg-bg-subtle p-3">
              <p className="text-[11px] text-subtle">Leverage</p>
              <p className="num text-lg">up to 50:1</p>
            </div>
            <div className="rounded-md bg-bg-subtle p-3">
              <p className="text-[11px] text-subtle">Stop-out</p>
              <p className="num text-lg">50%</p>
            </div>
            <div className="rounded-md bg-bg-subtle p-3">
              <p className="text-[11px] text-subtle">Min lot</p>
              <p className="num text-lg">0.01</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function NewsTeasers() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-subtle">Desk notes</p>
          <h2 className="mt-2 font-display text-3xl">This week’s tape</h2>
        </div>
        <Button asChild variant="outline">
          <Link to="/news">All notes</Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {ARTICLES.slice(0, 3).map((a) => (
          <Link
            key={a.slug}
            to="/news"
            className="rounded-xl bg-bg-elevated p-6 shadow-[var(--shadow-border)] transition-colors duration-150 hover:bg-bg-subtle"
          >
            <p className="text-[11px] uppercase tracking-wide text-subtle">
              {a.kicker} · {a.date}
            </p>
            <h3 className="mt-3 font-display text-xl leading-snug">{a.title}</h3>
            <p className="mt-2 text-sm text-muted">{a.standfirst}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-3xl md:text-4xl">Open the demo. Fill a ticket.</h2>
          <p className="mt-3 max-w-md text-sm text-muted">
            Sign in, request UPI or bank funding, then trade after admin
            approval. Real order types. Rupee cost on every ticket.
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/trade">
            Launch web trader
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
