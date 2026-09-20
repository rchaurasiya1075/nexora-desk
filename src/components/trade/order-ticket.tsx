import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { market } from "@/lib/market/engine";
import { getInstrument } from "@/lib/market/instruments";
import { useMarketTick } from "@/lib/market/use-market";
import {
  commissionCost,
  requiredMargin,
  snapshot,
  spreadCost,
  useTradeStore,
  type OrderKind,
  type Side,
} from "@/lib/trading/store";
import { formatMoney, formatPrice } from "@/lib/utils";

export function OrderTicket() {
  useMarketTick();
  const symbol = useTradeStore((s) => s.selected);
  const pricing = useTradeStore((s) => s.pricing);
  const placeMarket = useTradeStore((s) => s.placeMarket);
  const placePending = useTradeStore((s) => s.placePending);
  const balance = useTradeStore((s) => s.balance);
  const positions = useTradeStore((s) => s.positions);

  const inst = getInstrument(symbol);
  const quote = market.getQuote(symbol);
  const [lots, setLots] = useState("0.10");
  const [kind, setKind] = useState<OrderKind>("market");
  const [price, setPrice] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");

  const size = Number(lots) || 0;
  const trigger = Number(price) || 0;
  const slN = sl ? Number(sl) : null;
  const tpN = tp ? Number(tp) : null;

  const stats = useMemo(() => {
    const px = kind === "market" ? quote.ask : trigger || quote.ask;
    const margin = size > 0 ? requiredMargin(inst, size, px) : 0;
    const spread = size > 0 ? spreadCost(inst, size, pricing) : 0;
    const comm = size > 0 ? commissionCost(inst, size, pricing) : 0;
    return { margin, spread, comm, total: spread + comm };
  }, [inst, size, quote.ask, kind, trigger, pricing]);

  const snap = snapshot({ balance, positions });
  const usdInr = market.getQuote("USDINR").mid;

  function submit(side: Side) {
    const parsed = Number(lots);
    if (!Number.isFinite(parsed) || parsed < 0.01) {
      toast.error("Enter at least 0.01 lots.");
      return;
    }
    const result =
      kind === "market"
        ? placeMarket({
            symbol,
            side,
            lots: parsed,
            sl: slN && slN > 0 ? slN : null,
            tp: tpN && tpN > 0 ? tpN : null,
          })
        : placePending({
            symbol,
            side,
            kind,
            lots: parsed,
            price: trigger,
            sl: slN && slN > 0 ? slN : null,
            tp: tpN && tpN > 0 ? tpN : null,
          });
    if (!result.ok) toast.error(result.error);
    else toast.success(useTradeStore.getState().lastToast ?? "Order accepted");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-subtle">Order ticket</p>
        <p className="mt-1 font-display text-xl text-fg">{inst.display}</p>
        <p className="text-xs text-muted">
          {inst.name} · {inst.leverage}:1
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <Tabs value={kind} onValueChange={(v) => setKind(v as OrderKind)}>
          <TabsList className="w-full">
            <TabsTrigger value="market" className="flex-1">
              Market
            </TabsTrigger>
            <TabsTrigger value="limit" className="flex-1">
              Limit
            </TabsTrigger>
            <TabsTrigger value="stop" className="flex-1">
              Stop
            </TabsTrigger>
          </TabsList>
          <TabsContent value={kind} className="mt-4 space-y-3">
            <div>
              <span className="mb-1.5 block text-[12px] text-muted">Size (lots)</span>
              <Input
                inputMode="decimal"
                value={lots}
                onChange={(e) => setLots(e.target.value)}
                aria-label="Size in lots"
              />
              <div className="mt-2 flex gap-1">
                {["0.01", "0.10", "0.50", "1.00"].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setLots(n)}
                    className="h-8 flex-1 rounded-sm bg-bg-subtle text-[12px] text-muted hover:text-fg"
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {kind !== "market" && (
              <Field label="Trigger price">
                <Input
                  inputMode="decimal"
                  placeholder={formatPrice(quote.mid, inst.digits)}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Field label="Stop loss">
                <Input
                  inputMode="decimal"
                  placeholder="Optional"
                  value={sl}
                  onChange={(e) => setSl(e.target.value)}
                />
              </Field>
              <Field label="Take profit">
                <Input
                  inputMode="decimal"
                  placeholder="Optional"
                  value={tp}
                  onChange={(e) => setTp(e.target.value)}
                />
              </Field>
            </div>
          </TabsContent>
        </Tabs>

        <dl className="mt-4 space-y-1.5 text-[12px] text-muted">
          <Row k="Required margin" v={formatMoney(stats.margin)} />
          <Row k="Spread cost" v={formatMoney(stats.spread)} />
          {pricing === "raw" && <Row k="Commission / side" v={formatMoney(stats.comm)} />}
          <Row k="Est. entry cost" v={formatMoney(stats.total)} />
          <Row k="In rupees" v={`₹${(stats.total * usdInr).toFixed(0)}`} />
          <Row k="Free margin" v={formatMoney(snap.free)} />
        </dl>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
        <Button variant="sell" className="h-12 flex-col gap-0 py-1" onClick={() => submit("sell")}>
          <span className="text-[11px] font-normal opacity-80">
            Sell {formatPrice(quote.bid, inst.digits)}
          </span>
          <span>SELL</span>
        </Button>
        <Button variant="buy" className="h-12 flex-col gap-0 py-1" onClick={() => submit("buy")}>
          <span className="text-[11px] font-normal opacity-80">
            Buy {formatPrice(quote.ask, inst.digits)}
          </span>
          <span>BUY</span>
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] text-muted">{label}</span>
      {children}
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{k}</dt>
      <dd className="num text-fg">{v}</dd>
    </div>
  );
}
