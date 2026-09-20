import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { SiteFooter, SiteHeader } from "@/components/layout/site-header";
import { LiveTable } from "@/components/markets/live-table";
import { TickerTape } from "@/components/markets/ticker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { market } from "@/lib/market/engine";
import { ASSET_LABEL, type AssetClass } from "@/lib/market/instruments";

export const Route = createFileRoute("/markets")({ component: MarketsPage });

const TABS: Array<{ id: "all" | AssetClass; label: string }> = [
  { id: "all", label: "All" },
  { id: "forex", label: ASSET_LABEL.forex },
  { id: "crypto", label: ASSET_LABEL.crypto },
  { id: "metals", label: ASSET_LABEL.metals },
  { id: "indices", label: ASSET_LABEL.indices },
  { id: "energy", label: ASSET_LABEL.energy },
  { id: "shares", label: ASSET_LABEL.shares },
];

function MarketsPage() {
  useEffect(() => {
    market.start();
  }, []);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteHeader />
      <TickerTape />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-subtle">Markets</p>
        <h1 className="mt-2 font-display text-4xl md:text-5xl">32 markets, one account</h1>
        <p className="mt-4 max-w-2xl text-muted">
          Indicative demo prices. Spreads follow the book you pick on the trader —
          Standard or RAW. Tap Trade to load the symbol on the desk.
        </p>
        <Tabs defaultValue="all" className="mt-10">
          <TabsList className="flex flex-wrap">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((t) => (
            <TabsContent key={t.id} value={t.id} className="mt-4">
              <LiveTable assetClass={t.id === "all" ? undefined : t.id} />
            </TabsContent>
          ))}
        </Tabs>
        <p className="mt-6 text-sm text-muted">
          Want the cost of a 0.10 lot? See the{" "}
          <Link to="/pricing" className="text-fg underline decoration-border-strong">
            pricing desk
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
