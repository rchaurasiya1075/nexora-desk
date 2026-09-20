import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { market } from "@/lib/market/engine";
import { getInstrument } from "@/lib/market/instruments";
import { useMarketTick } from "@/lib/market/use-market";
import {
  positionPnl,
  useTradeStore,
  type Position,
} from "@/lib/trading/store";
import { cn, formatMoney, formatPrice, formatSigned } from "@/lib/utils";

export function PositionsPanel() {
  useMarketTick();
  const positions = useTradeStore((s) => s.positions);
  const pending = useTradeStore((s) => s.pending);
  const history = useTradeStore((s) => s.history);
  const closePosition = useTradeStore((s) => s.closePosition);
  const cancelPending = useTradeStore((s) => s.cancelPending);
  const select = useTradeStore((s) => s.select);

  return (
    <Tabs defaultValue="open" className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <TabsList>
          <TabsTrigger value="open">Positions ({positions.length})</TabsTrigger>
          <TabsTrigger value="pending">Orders ({pending.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="open" className="min-h-0 flex-1 overflow-auto">
        {positions.length === 0 ? (
          <Empty text="No open positions. Use Buy or Sell to get filled at the live bid/ask." />
        ) : (
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead className="sticky top-0 bg-bg-elevated text-subtle">
              <tr>
                {["Market", "Side", "Lots", "Entry", "Mark", "P/L", "SL / TP", ""].map(
                  (h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <OpenRow
                  key={p.id}
                  pos={p}
                  onClose={() => {
                    const r = closePosition(p.id);
                    if (!r.ok) toast.error(r.error);
                    else toast.success(useTradeStore.getState().lastToast ?? "Closed");
                  }}
                  onFocus={() => select(p.symbol)}
                />
              ))}
            </tbody>
          </table>
        )}
      </TabsContent>
      <TabsContent value="pending" className="min-h-0 flex-1 overflow-auto">
        {pending.length === 0 ? (
          <Empty text="No working orders. Switch the ticket to Limit or Stop." />
        ) : (
          <ul className="divide-y divide-border">
            {pending.map((o) => {
              const inst = getInstrument(o.symbol);
              return (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-3 px-3 py-3 text-[12px]"
                >
                  <button type="button" className="text-left" onClick={() => select(o.symbol)}>
                    <p className="font-medium text-fg">
                      {inst.display} · {o.kind} {o.side}
                    </p>
                    <p className="text-muted">
                      {o.lots} lots @ {formatPrice(o.price, inst.digits)}
                    </p>
                  </button>
                  <Button size="sm" variant="outline" onClick={() => cancelPending(o.id)}>
                    Cancel
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </TabsContent>
      <TabsContent value="history" className="min-h-0 flex-1 overflow-auto">
        {history.length === 0 ? (
          <Empty text="Closed trades will land here with realised P/L." />
        ) : (
          <ul className="divide-y divide-border">
            {history.map((h) => {
              const inst = getInstrument(h.symbol);
              const up = h.pnl >= 0;
              return (
                <li
                  key={h.id}
                  className="flex items-center justify-between gap-3 px-3 py-3 text-[12px]"
                >
                  <div>
                    <p className="font-medium text-fg">
                      {inst.display} · {h.side} {h.lots}
                    </p>
                    <p className="text-muted">
                      {formatPrice(h.entry, inst.digits)} → {formatPrice(h.exit, inst.digits)}
                    </p>
                  </div>
                  <p className={cn("num font-medium", up ? "text-buy" : "text-sell")}>
                    {formatSigned(h.pnl)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}

function OpenRow({
  pos,
  onClose,
  onFocus,
}: {
  pos: Position;
  onClose: () => void;
  onFocus: () => void;
}) {
  const inst = getInstrument(pos.symbol);
  const q = market.getQuote(pos.symbol);
  const pnl = positionPnl(pos, q.bid, q.ask);
  const mark = pos.side === "buy" ? q.bid : q.ask;
  const up = pnl >= 0;
  const updateSlTp = useTradeStore((s) => s.updateSlTp);
  const [sl, setSl] = useState(pos.sl?.toString() ?? "");
  const [tp, setTp] = useState(pos.tp?.toString() ?? "");

  return (
    <tr className="border-t border-border text-fg">
      <td className="px-3 py-2">
        <button type="button" onClick={onFocus} className="text-left font-medium">
          {inst.display}
        </button>
      </td>
      <td className={cn("px-3 py-2 uppercase", pos.side === "buy" ? "text-buy" : "text-sell")}>
        {pos.side}
      </td>
      <td className="px-3 py-2 num">{pos.lots.toFixed(2)}</td>
      <td className="px-3 py-2 num">{formatPrice(pos.entry, inst.digits)}</td>
      <td className="px-3 py-2 num">{formatPrice(mark, inst.digits)}</td>
      <td className={cn("px-3 py-2 num font-medium", up ? "text-buy" : "text-sell")}>
        {formatMoney(pnl)}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <Input
            value={sl}
            onChange={(e) => setSl(e.target.value)}
            onBlur={() =>
              updateSlTp(pos.id, sl ? Number(sl) : null, tp ? Number(tp) : pos.tp)
            }
            className="h-8 w-20 px-2"
            placeholder="SL"
          />
          <Input
            value={tp}
            onChange={(e) => setTp(e.target.value)}
            onBlur={() =>
              updateSlTp(pos.id, sl ? Number(sl) : pos.sl, tp ? Number(tp) : null)
            }
            className="h-8 w-20 px-2"
            placeholder="TP"
          />
        </div>
      </td>
      <td className="px-3 py-2 text-right">
        <Button size="sm" variant="outline" onClick={onClose}>
          Close
        </Button>
      </td>
    </tr>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-8 text-center text-sm text-muted">{text}</p>;
}
