import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { TradingViewChart } from "@/components/trade/tv-chart";
import { rememberPair } from "@/components/app/markets-screen";
import { market } from "@/lib/market/engine";
import { INSTRUMENTS, getInstrument } from "@/lib/market/instruments";
import { useMarketTick } from "@/lib/market/use-market";
import { positionPnl, requiredMargin, useTradeStore, type Side } from "@/lib/trading/store";
import { formatMoney, formatPct, formatPrice, formatSigned } from "@/lib/utils";

const QUICK = [50, 100, 250, 500, 1000];
const CHIPS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD"];

export function TradeScreen({ symbol, side: intent }: { symbol?: string; side?: Side }) {
  useMarketTick();
  const navigate = useNavigate();
  const selected = useTradeStore((s) => s.selected);
  const select = useTradeStore((s) => s.select);
  const balance = useTradeStore((s) => s.balance);
  const positions = useTradeStore((s) => s.positions);
  const placeMarket = useTradeStore((s) => s.placeMarket);
  const closePosition = useTradeStore((s) => s.closePosition);
  const [amount, setAmount] = useState("100");
  const [pending, setPending] = useState<Side | null>(null);
  const [placed, setPlaced] = useState<{ side: Side; price: number; amount: number } | null>(null);
  const [full, setFull] = useState(false);

  const opened = useRef("");

  useEffect(() => {
    if (!symbol) return;
    const known = INSTRUMENTS.some((inst) => inst.symbol === symbol);
    if (!known) return;
    select(symbol);
    rememberPair(symbol);
  }, [symbol, select]);

  useEffect(() => {
    if (!intent) return;
    const key = `${symbol ?? ""}:${intent}`;
    if (opened.current === key) return;
    opened.current = key;
    setPending(intent);
  }, [intent, symbol]);

  const inst = getInstrument(selected);
  const quote = market.getQuote(selected);
  const usd = Number(amount);
  const lots = useMemo(() => lotsFor(inst, Number.isFinite(usd) ? usd : 0, quote.ask), [inst, usd, quote.ask]);
  const margin = requiredMargin(inst, lots, quote.ask);
  const mine = positions.filter((pos) => pos.symbol === selected);
  const floating = mine.reduce((sum, pos) => sum + positionPnl(pos, quote.bid, quote.ask), 0);

  function ask(side: Side) {
    if (!Number.isFinite(usd) || usd <= 0) {
      toast.error("Enter an amount in USD.");
      return;
    }
    setPending(side);
  }

  function confirm() {
    if (!pending) return;
    const res = placeMarket({ symbol: selected, side: pending, lots, sl: null, tp: null });
    if (!res.ok) {
      toast.error(res.error);
      setPending(null);
      return;
    }
    const price = pending === "buy" ? quote.ask : quote.bid;
    setPlaced({ side: pending, price, amount: usd });
    setPending(null);
    rememberPair(selected);
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[1fr_320px]">
      <section className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <label className="text-[11px] uppercase tracking-[0.16em] text-subtle">Paper trade</label>
            <select
              value={selected}
              onChange={(e) => {
                select(e.target.value);
                rememberPair(e.target.value);
              }}
              className="mt-1 block bg-transparent text-3xl font-medium outline-none"
            >
              {INSTRUMENTS.map((item) => (
                <option key={item.symbol} value={item.symbol}>
                  {item.display}
                </option>
              ))}
            </select>
            <p className="num mt-1 text-3xl font-medium">{formatPrice(quote.mid, inst.digits)}</p>
            <p className={quote.changePct >= 0 ? "text-sm text-buy" : "text-sm text-sell"}>{formatPct(quote.changePct)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-subtle">Balance</p>
            <p className="num text-lg">{formatMoney(balance)}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {CHIPS.map((symbol) => (
            <button
              key={symbol}
              type="button"
              onClick={() => {
                select(symbol);
                rememberPair(symbol);
              }}
              className={`shrink-0 rounded-full px-3 py-1 text-xs ${selected === symbol ? "bg-fg text-bg" : "bg-bg-subtle text-muted"}`}
            >
              {getInstrument(symbol).display}
            </button>
          ))}
        </div>
        <div className={full ? "fixed inset-0 z-50 flex flex-col bg-bg" : "mt-4 h-[68vh] overflow-hidden rounded-xl border border-border lg:h-[520px]"}>
          <div className="flex h-10 shrink-0 items-center justify-between px-3">
            <span className="text-[11px] uppercase tracking-[0.14em] text-subtle">Chart · zoom and indicators</span>
            <button type="button" onClick={() => setFull((v) => !v)} className="text-xs text-fg underline">
              {full ? "Exit full chart" : "Full chart"}
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <TradingViewChart symbol={selected} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-subtle">Amount</p>
        <div className="mt-2 flex items-center rounded-2xl bg-bg-subtle">
          <button
            type="button"
            className="h-14 w-12 text-lg text-muted"
            onClick={() => setAmount(String(Math.max(10, (Number(amount) || 0) - 50)))}
          >
            −
          </button>
          <span className="text-muted">$</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-14 w-full bg-transparent px-2 text-center text-lg font-semibold outline-none"
          />
          <button
            type="button"
            className="h-14 w-12 text-lg text-muted"
            onClick={() => setAmount(String((Number(amount) || 0) + 50))}
          >
            +
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK.map((n) => (
            <button key={n} type="button" onClick={() => setAmount(String(n))} className="rounded-full bg-bg-subtle px-2.5 py-1 text-xs text-muted">
              ${n}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          About {formatMoney(margin)} margin · {lots.toFixed(2)} lots
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => ask("buy")} className="h-[4.5rem] rounded-2xl bg-white text-[#111214] transition-transform active:scale-[0.98]">
            <span className="block text-xs font-medium tracking-wide">BUY</span>
            <span className="num text-lg font-semibold">{formatPrice(quote.ask, inst.digits)}</span>
          </button>
          <button type="button" onClick={() => ask("sell")} className="h-[4.5rem] rounded-2xl border border-white/15 bg-white/5 text-fg transition-transform active:scale-[0.98]">
            <span className="block text-xs font-medium tracking-wide">SELL</span>
            <span className="num text-lg font-semibold">{formatPrice(quote.bid, inst.digits)}</span>
          </button>
        </div>
        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.16em] text-subtle">Open on this pair</p>
          {mine.length === 0 && <p className="mt-2 text-sm text-muted">Nothing open yet.</p>}
          {mine.map((pos) => {
            const q = market.getQuote(pos.symbol);
            const pnl = positionPnl(pos, q.bid, q.ask);
            return (
              <div key={pos.id} className="mt-2 flex items-center justify-between gap-2 text-sm">
                <span>
                  {pos.side.toUpperCase()} {formatMoney(Number(amount) || 0)}
                  <span className={pnl >= 0 ? "ml-2 text-buy" : "ml-2 text-sell"}>{formatSigned(pnl)}</span>
                </span>
                <button
                  type="button"
                  className="rounded-lg border border-border px-3 py-1.5 text-xs"
                  onClick={() => closePosition(pos.id)}
                >
                  Close
                </button>
              </div>
            );
          })}
          <Link to="/trade" search={{ view: "positions" }} className="mt-3 inline-block text-xs text-muted underline">
            All positions
          </Link>
        </div>
      </section>

      {mine.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-20 mx-auto flex max-w-3xl items-center justify-between border-t border-border bg-bg/95 px-4 py-2 text-sm backdrop-blur md:bottom-0 md:left-56">
          <span className="text-muted">Open {inst.display}</span>
          <span className={floating >= 0 ? "font-semibold text-buy" : "font-semibold text-sell"}>{formatSigned(floating)}</span>
        </div>
      )}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 md:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-bg p-5 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.16em] text-subtle">Confirm</p>
            <h2 className="mt-2 font-display text-4xl">
              {pending.toUpperCase()} {inst.display}
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <Row k="Price" v={formatPrice(pending === "buy" ? quote.ask : quote.bid, inst.digits)} />
              <Row k="Amount" v={formatMoney(usd)} />
              <Row k="Direction" v={pending.toUpperCase()} />
            </dl>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button type="button" className="h-12 rounded-xl border border-border" onClick={() => setPending(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="h-12 rounded-xl bg-white font-semibold text-[#111214]"
                onClick={confirm}
              >
                Confirm {pending.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}

      {placed && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 md:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-bg p-5 text-center">
            <p className="text-sm text-buy">Order placed</p>
            <h2 className="mt-2 font-display text-3xl">{placed.side.toUpperCase()} ORDER PLACED</h2>
            <p className="mt-3 text-sm text-muted">
              {inst.display} · {placed.side.toUpperCase()} {formatMoney(placed.amount)}
            </p>
            <p className="num mt-1">Entry {formatPrice(placed.price, inst.digits)}</p>
            <button
              type="button"
              className="mt-6 h-12 w-full rounded-xl bg-fg text-bg"
              onClick={() => {
                setPlaced(null);
                void navigate({ to: "/trade", search: { view: "positions" } });
              }}
            >
              View position
            </button>
            <button type="button" className="mt-2 h-10 w-full text-sm text-muted" onClick={() => setPlaced(null)}>
              Keep trading
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function lotsFor(inst: ReturnType<typeof getInstrument>, usd: number, price: number) {
  if (!Number.isFinite(usd) || usd <= 0 || price <= 0) return 0.01;
  const lots = (usd * inst.leverage) / (inst.contractSize * price);
  return Math.min(50, Math.max(0.01, Math.round(lots * 100) / 100));
}
