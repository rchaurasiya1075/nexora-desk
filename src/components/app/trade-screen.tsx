import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { TradingViewChart } from "@/components/trade/tv-chart";
import { rememberPair } from "@/components/app/markets-screen";
import { market } from "@/lib/market/engine";
import { INSTRUMENTS, getInstrument } from "@/lib/market/instruments";
import { useMarketTick } from "@/lib/market/use-market";
import { positionPnl, requiredMargin, useTradeStore, type HoldStyle, type OrderKind, type Side } from "@/lib/trading/store";
import { formatMoney, formatPct, formatPrice, formatSigned } from "@/lib/utils";

const LEVS = [1, 10, 50, 100];

export function TradeScreen({ symbol, side: intent }: { symbol?: string; side?: Side }) {
  useMarketTick();
  const navigate = useNavigate();
  const selected = useTradeStore((s) => s.selected);
  const select = useTradeStore((s) => s.select);
  const balance = useTradeStore((s) => s.balance);
  const positions = useTradeStore((s) => s.positions);
  const placeMarket = useTradeStore((s) => s.placeMarket);
  const placePending = useTradeStore((s) => s.placePending);
  const [amount, setAmount] = useState("100");
  const [pending, setPending] = useState<Side | null>(null);
  const [placed, setPlaced] = useState<{ side: Side; price: number; amount: number } | null>(null);
  const [full, setFull] = useState(false);
  const [kind, setKind] = useState<OrderKind>("market");
  const [hold, setHold] = useState<HoldStyle>("intraday");
  const [lev, setLev] = useState(50);
  const [trigger, setTrigger] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");

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
  const lots = useMemo(
    () => lotsFor(inst, Number.isFinite(usd) ? usd : 0, quote.ask, lev),
    [inst, usd, quote.ask, lev],
  );
  const margin = requiredMargin(inst, lots, quote.ask, lev);
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
    const slN = sl.trim() ? Number(sl) : null;
    const tpN = tp.trim() ? Number(tp) : null;
    if ((sl.trim() && !Number.isFinite(slN)) || (tp.trim() && !Number.isFinite(tpN))) {
      toast.error("Stop loss and take profit must be prices.");
      return;
    }
    if (kind === "market") {
      const res = placeMarket({
        symbol: selected,
        side: pending,
        lots,
        sl: slN,
        tp: tpN,
        style: hold,
        leverage: lev,
      });
      if (!res.ok) {
        toast.error(res.error);
        setPending(null);
        return;
      }
      const price = pending === "buy" ? quote.ask : quote.bid;
      setPlaced({ side: pending, price, amount: usd });
    } else {
      const price = Number(trigger);
      if (!Number.isFinite(price) || price <= 0) {
        toast.error("Enter the limit or stop price.");
        return;
      }
      const res = placePending({
        symbol: selected,
        side: pending,
        kind,
        lots,
        price,
        sl: slN,
        tp: tpN,
        style: hold,
        leverage: lev,
      });
      if (!res.ok) {
        toast.error(res.error);
        setPending(null);
        return;
      }
      setPlaced({ side: pending, price, amount: usd });
    }
    setPending(null);
    rememberPair(selected);
  }

  return (
    <div className="-mb-28 flex h-[calc(100dvh-8.6rem)] flex-col px-3 pt-2 md:mb-0 md:h-[calc(100dvh-1.5rem)] md:px-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <select
            value={selected}
            onChange={(e) => {
              select(e.target.value);
              rememberPair(e.target.value);
            }}
            className="block max-w-[11rem] bg-transparent text-xl font-medium outline-none"
          >
            {INSTRUMENTS.map((item) => (
              <option key={item.symbol} value={item.symbol}>
                {item.display}
              </option>
            ))}
          </select>
          <p className="num text-2xl font-medium leading-none">{formatPrice(quote.mid, inst.digits)}</p>
          <p className={quote.changePct >= 0 ? "text-xs text-buy" : "text-xs text-sell"}>{formatPct(quote.changePct)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-subtle">Balance</p>
          <p className="num text-base">{formatMoney(balance)}</p>
          <button type="button" onClick={() => setFull((v) => !v)} className="mt-1 text-xs text-muted underline">
            {full ? "Exit" : "Full chart"}
          </button>
        </div>
      </div>

      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {(["market", "limit", "stop"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setKind(item)} className={chip(kind === item)}>
            {item === "market" ? "Market" : item === "limit" ? "Limit" : "Stop"}
          </button>
        ))}
        <span className="w-2 shrink-0" />
        <button type="button" onClick={() => setHold("intraday")} className={chip(hold === "intraday")}>
          Intraday
        </button>
        <button type="button" onClick={() => setHold("carry")} className={chip(hold === "carry")}>
          Carry
        </button>
        <span className="w-2 shrink-0" />
        {LEVS.map((n) => (
          <button key={n} type="button" onClick={() => setLev(n)} className={chip(lev === n)}>
            {n}x
          </button>
        ))}
      </div>

      <div className={full ? "fixed inset-0 z-40 bg-bg" : "relative mt-1 min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10"}>
        {full && (
          <button type="button" onClick={() => setFull(false)} className="absolute right-3 top-3 z-10 rounded-full bg-black/60 px-3 py-1 text-xs">
            Exit
          </button>
        )}
        <TradingViewChart symbol={selected} />
      </div>

      <section className="shrink-0 space-y-2 pt-2">
        {kind !== "market" && (
          <input
            inputMode="decimal"
            value={trigger}
            placeholder={kind === "limit" ? "Limit price" : "Stop trigger"}
            onChange={(e) => setTrigger(e.target.value)}
            className="h-10 w-full rounded-full bg-white/10 px-4 text-center text-sm outline-none"
          />
        )}
        <div className="grid grid-cols-2 gap-2">
          <input
            inputMode="decimal"
            value={sl}
            placeholder="Stop loss"
            onChange={(e) => setSl(e.target.value)}
            className="h-9 rounded-full bg-white/10 px-3 text-center text-xs outline-none"
          />
          <input
            inputMode="decimal"
            value={tp}
            placeholder="Take profit"
            onChange={(e) => setTp(e.target.value)}
            className="h-9 rounded-full bg-white/10 px-3 text-center text-xs outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="h-10 w-10 rounded-full bg-white/10 text-lg" onClick={() => setAmount(String(Math.max(10, (Number(amount) || 0) - 50)))}>
            −
          </button>
          <div className="flex h-10 min-w-0 flex-1 items-center justify-center rounded-full bg-white/10 px-3">
            <span className="text-muted">$</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-24 bg-transparent text-center text-base font-medium outline-none"
            />
          </div>
          <button type="button" className="h-10 w-10 rounded-full bg-white/10 text-lg" onClick={() => setAmount(String((Number(amount) || 0) + 50))}>
            +
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => ask("buy")} className="h-12 rounded-full bg-[#d8f3e4] text-sm font-semibold text-[#146c43] active:scale-[0.98]">
            BUY {formatPrice(quote.ask, inst.digits)}
          </button>
          <button type="button" onClick={() => ask("sell")} className="h-12 rounded-full bg-[#fde2e0] text-sm font-semibold text-[#b42318] active:scale-[0.98]">
            SELL {formatPrice(quote.bid, inst.digits)}
          </button>
        </div>
        {mine.length > 0 && (
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className={floating >= 0 ? "text-buy" : "text-sell"}>Open P/L {formatSigned(floating)}</span>
            <Link to="/trade" search={{ view: "positions" }} className="text-muted underline">
              Positions
            </Link>
          </div>
        )}
      </section>
      {pending && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 md:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-bg p-5 shadow-2xl">
            <p className="text-xs uppercase tracking-[0.16em] text-subtle">Confirm</p>
            <h2 className="mt-2 font-display text-4xl">
              {pending.toUpperCase()} {inst.display}
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <Row k="Type" v={kind === "market" ? "Market" : kind === "limit" ? "Limit" : "Stop"} />
              <Row k="Style" v={hold === "intraday" ? "Intraday" : "Carry forward"} />
              <Row k="Leverage" v={`${lev}x`} />
              <Row k="Price" v={kind === "market" ? formatPrice(pending === "buy" ? quote.ask : quote.bid, inst.digits) : trigger || "—"} />
              <Row k="Amount" v={formatMoney(usd)} />
              <Row k="Margin" v={formatMoney(margin)} />
              <Row k="Stop loss" v={sl || "—"} />
              <Row k="Take profit" v={tp || "—"} />
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

function lotsFor(inst: ReturnType<typeof getInstrument>, usd: number, price: number, leverage: number) {
  if (!Number.isFinite(usd) || usd <= 0 || price <= 0) return 0.01;
  const used = leverage > 0 ? leverage : inst.leverage;
  const lots = (usd * used) / (inst.contractSize * price);
  return Math.min(50, Math.max(0.01, Math.round(lots * 100) / 100));
}

function chip(on: boolean) {
  return `shrink-0 rounded-full px-2.5 py-1 text-[11px] ${on ? "bg-white text-[#111214]" : "bg-white/10 text-muted"}`;
}
