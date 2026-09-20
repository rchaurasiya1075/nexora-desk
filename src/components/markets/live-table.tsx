import { Link } from "@tanstack/react-router";
import { INSTRUMENTS, type AssetClass, ASSET_LABEL } from "@/lib/market/instruments";
import { market } from "@/lib/market/engine";
import { useMarketTick } from "@/lib/market/use-market";
import { useTradeStore } from "@/lib/trading/store";
import { Sparkline } from "@/components/trade/sparkline";
import { Button } from "@/components/ui/button";
import { cn, formatPrice } from "@/lib/utils";

export function LiveTable({ assetClass }: { assetClass?: AssetClass }) {
  useMarketTick();
  const select = useTradeStore((s) => s.select);
  const pricing = useTradeStore((s) => s.pricing);
  const rows = assetClass
    ? INSTRUMENTS.filter((i) => i.assetClass === assetClass)
    : INSTRUMENTS;

  return (
    <div className="overflow-x-auto rounded-xl bg-bg-elevated shadow-[var(--shadow-border)]">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-[12px] text-subtle">
          <tr className="border-b border-border">
            <th className="px-4 py-3 font-medium">Market</th>
            <th className="px-4 py-3 font-medium">Sell</th>
            <th className="px-4 py-3 font-medium">Buy</th>
            <th className="px-4 py-3 font-medium">Spread</th>
            <th className="px-4 py-3 font-medium">Change</th>
            <th className="px-4 py-3 font-medium"></th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((inst) => {
            const q = market.getQuote(inst.symbol);
            const spread = pricing === "raw" ? inst.spreadRaw : inst.spreadStd;
            const up = q.change >= 0;
            return (
              <tr key={inst.symbol} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-fg">{inst.display}</div>
                  <div className="text-[12px] text-muted">
                    {inst.name} · {ASSET_LABEL[inst.assetClass]}
                  </div>
                </td>
                <td className="px-4 py-3 num text-sell">{formatPrice(q.bid, inst.digits)}</td>
                <td className="px-4 py-3 num text-buy">{formatPrice(q.ask, inst.digits)}</td>
                <td className="px-4 py-3 num text-muted">{spread.toFixed(inst.digits)}</td>
                <td className={cn("px-4 py-3 num", up ? "text-buy" : "text-sell")}>
                  {up ? "+" : ""}
                  {q.changePct.toFixed(2)}%
                </td>
                <td className="px-4 py-3">
                  <Sparkline values={market.getSpark(inst.symbol)} up={up} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button asChild size="sm">
                    <Link to="/trade" onClick={() => select(inst.symbol)}>
                      Trade
                    </Link>
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
