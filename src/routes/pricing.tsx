import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { market } from "@/lib/market/engine";
import { INSTRUMENTS, getInstrument } from "@/lib/market/instruments";
import { useMarketTick } from "@/lib/market/use-market";
import { commissionCost, requiredMargin, spreadCost } from "@/lib/trading/store";
import { formatMoney } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({ component: PricingPage });

export function PricingPage() {
  useEffect(() => {
    market.start();
  }, []);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-subtle">Pricing</p>
        <h1 className="mt-2 max-w-3xl font-display text-4xl md:text-5xl">
          This desk is free. A live broker is not.
        </h1>
        <p className="mt-4 max-w-2xl text-muted">
          Three numbers matter: what Sikkaaa costs (nothing), what a real
          FOREX.com-style account costs to open, and what each trade costs in
          spread. All rupee figures use live USD/INR on this desk.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <CostCard
            kicker="Sikkaaa demo"
            title="₹0"
            copy="Sign in, request UPI/bank funding, wait for admin approval. Paper USD only. No live withdrawal."
          />
          <CostCard
            kicker="Live broker min. deposit"
            title="~$100"
            copy="Typical FOREX.com-style minimum. About ₹8,800 at 88.4. They recommend $2,500 (≈ ₹2.2 lakh) so margin actually works."
          />
          <CostCard
            kicker="1.00 lot EUR/USD"
            title="~$10"
            copy="Standard 1.0 pip. RAW is ~0.2 pip + $7 round-turn. Same ballpark unless you scalp."
          />
        </div>

        <Calculator />
        <Books />
        <RealWorld />
        <IndiaNote />

        <div className="mt-16 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/trade">Trade the demo</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/markets">View live prices</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function CostCard({
  kicker,
  title,
  copy,
}: {
  kicker: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="rounded-xl bg-bg-elevated p-6 shadow-[var(--shadow-border)]">
      <p className="text-[11px] uppercase tracking-wide text-subtle">{kicker}</p>
      <p className="mt-3 font-display text-4xl">{title}</p>
      <p className="mt-3 text-sm text-muted">{copy}</p>
    </div>
  );
}

function Calculator() {
  useMarketTick();
  const [symbol, setSymbol] = useState("EURUSD");
  const [lots, setLots] = useState("0.10");
  const inst = getInstrument(symbol);
  const size = Math.max(0, Number(lots) || 0);
  const usdInr = market.getQuote("USDINR").mid;
  const q = market.getQuote(symbol);

  const rows = useMemo(() => {
    const stdSpread = spreadCost(inst, size, "standard");
    const rawSpread = spreadCost(inst, size, "raw");
    const rawComm = commissionCost(inst, size, "raw") * 2;
    const margin = requiredMargin(inst, size, q.ask);
    return { stdSpread, rawSpread, rawComm, rawAllIn: rawSpread + rawComm, margin };
  }, [inst, size, q.ask]);

  return (
    <section className="mt-16 rounded-xl bg-bg-elevated p-6 shadow-[var(--shadow-border)] md:p-8">
      <h2 className="font-display text-3xl">Cost of one trade</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Pick a market and a lot size. This is the money that leaves the account
        the moment you click Buy or Sell — spread you pay immediately, plus RAW
        commission.
      </p>
      <div className="mt-6 grid gap-3 md:grid-cols-[1.4fr_0.6fr]">
        <label className="block">
          <span className="mb-1.5 block text-[12px] text-muted">Market</span>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="h-11 w-full rounded-sm bg-bg-subtle px-3 text-sm text-fg shadow-[var(--shadow-border)] outline-none"
          >
            {INSTRUMENTS.map((i) => (
              <option key={i.symbol} value={i.symbol}>
                {i.display} — {i.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] text-muted">Lots</span>
          <Input value={lots} onChange={(e) => setLots(e.target.value)} inputMode="decimal" />
        </label>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-[12px] text-subtle">
            <tr className="border-b border-border">
              <th className="py-2 font-medium">Book</th>
              <th className="py-2 font-medium">USD</th>
              <th className="py-2 font-medium">INR</th>
            </tr>
          </thead>
          <tbody className="num">
            <CalcRow
              k="Standard — spread only"
              usd={rows.stdSpread}
              inr={rows.stdSpread * usdInr}
            />
            <CalcRow
              k="RAW — spread + round-turn commission"
              usd={rows.rawAllIn}
              inr={rows.rawAllIn * usdInr}
            />
            <CalcRow k="Margin to open" usd={rows.margin} inr={rows.margin * usdInr} />
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[12px] text-subtle">
        USD/INR {usdInr.toFixed(3)} · {inst.leverage}:1 · contract {inst.contractSize.toLocaleString()}{" "}
        per lot. P/L after entry is separate — this table is the friction, not the
        market bet.
      </p>
    </section>
  );
}

function CalcRow({ k, usd, inr }: { k: string; usd: number; inr: number }) {
  return (
    <tr className="border-b border-border">
      <td className="py-3 text-muted">{k}</td>
      <td className="py-3 text-fg">{formatMoney(usd)}</td>
      <td className="py-3 text-fg">
        ₹{inr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
      </td>
    </tr>
  );
}

function Books() {
  return (
    <section className="mt-16 grid gap-4 md:grid-cols-2">
      <div className="rounded-xl bg-bg-elevated p-6 shadow-[var(--shadow-border)]">
        <p className="text-[11px] uppercase tracking-wide text-subtle">Standard</p>
        <h3 className="mt-2 font-display text-3xl">Spread only</h3>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          <li>EUR/USD typical 1.0 pip · GBP/USD 1.3 · XAU/USD $0.32</li>
          <li>Share CFDs 0 commission</li>
          <li>Better if you trade infrequently</li>
        </ul>
      </div>
      <div className="rounded-xl bg-bg-elevated p-6 shadow-[var(--shadow-border)]">
        <p className="text-[11px] uppercase tracking-wide text-subtle">RAW</p>
        <h3 className="mt-2 font-display text-3xl">From 0.2 pips + $3.50/side</h3>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          <li>$7 round-turn per FX lot ($3.50 each way), modelled on live RAW books</li>
          <li>Gold and indices: tighter spread, no extra ticket</li>
          <li>Better if you scalp majors</li>
        </ul>
      </div>
    </section>
  );
}

function RealWorld() {
  return (
    <section className="mt-16">
      <h2 className="font-display text-3xl">If you opened a live account like FOREX.com</h2>
      <div className="mt-6 overflow-x-auto rounded-xl bg-bg-elevated shadow-[var(--shadow-border)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-[12px] text-subtle">
            <tr className="border-b border-border">
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Typical live cost</th>
              <th className="px-4 py-3 font-medium">INR (indicative)</th>
            </tr>
          </thead>
          <tbody className="text-muted">
            <tr className="border-b border-border">
              <td className="px-4 py-3">Account opening</td>
              <td className="px-4 py-3 text-fg">$0</td>
              <td className="px-4 py-3">₹0</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-4 py-3">Minimum deposit</td>
              <td className="px-4 py-3 text-fg">$100 (they prefer $2,500)</td>
              <td className="px-4 py-3">₹8,800 / ₹2.21 lakh</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-4 py-3">Deposit fee</td>
              <td className="px-4 py-3 text-fg">Usually $0 (card / local)</td>
              <td className="px-4 py-3">₹0</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-4 py-3">International wire out</td>
              <td className="px-4 py-3 text-fg">$25–$40</td>
              <td className="px-4 py-3">₹2,200–₹3,500</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-4 py-3">Inactivity (after ~12 months)</td>
              <td className="px-4 py-3 text-fg">~$15 / month</td>
              <td className="px-4 py-3">₹1,300 / month</td>
            </tr>
            <tr>
              <td className="px-4 py-3">Platform (web / MT5)</td>
              <td className="px-4 py-3 text-fg">$0</td>
              <td className="px-4 py-3">₹0</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-subtle">
        Live figures are typical 2026 retail terms for a FOREX.com-style broker,
        not a quote. Spreads move with the tape.
      </p>
    </section>
  );
}

function IndiaNote() {
  return (
    <section className="mt-16 rounded-xl bg-bg-elevated p-6 shadow-[var(--shadow-border)] md:p-8">
      <h2 className="font-display text-3xl">From India, Gurugram</h2>
      <div className="mt-4 space-y-3 text-sm text-muted">
        <p>
          Retail offshore forex/CFD accounts are generally not permitted for
          Indian residents under FEMA and RBI rules. Sending money to an
          overseas broker for leveraged FX is the expensive part — and often
          the illegal one. This demo does not open that door.
        </p>
        <p>
          Building a real licensed broker is a different universe: regulatory
          capital (often $1 lakh+ equivalent abroad, far more for a bank-grade
          India licence), liquidity, and a dealing desk. Software alone is the
          cheap line item. Sikkaaa is the software line item, running as paper.
        </p>
        <p>
          If you only wanted to learn the buttons, the tape, and what a pip
          costs in rupees — you are already on the right product. Hit Start
          trading. Risk $0.
        </p>
      </div>
    </section>
  );
}
