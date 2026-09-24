import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  LayoutGrid,
  Newspaper,
  PanelRight,
  Settings,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AccountBar } from "./account-bar";
import { CandleChart } from "./candle-chart";
import { DepositDesk } from "./deposit-desk";
import { NewsDesk } from "./news-desk";
import { OrderTicket } from "./order-ticket";
import { PositionsPanel } from "./positions-panel";
import { Watchlist } from "./watchlist";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useTradeStore, type Side } from "@/lib/trading/store";
import { market } from "@/lib/market/engine";
import { getInstrument } from "@/lib/market/instruments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Workspace = "default" | "analysis" | "browse" | "settings";
type MobilePane = "markets" | "chart" | "positions" | "trade" | "more";

export function Terminal() {
  const selected = useTradeStore((s) => s.selected);
  const select = useTradeStore((s) => s.select);
  const onTick = useTradeStore((s) => s.onTick);
  const hydrated = useTradeStore((s) => s.hydrated);
  const hydrateFromServer = useTradeStore((s) => s.hydrateFromServer);
  const loadPrefs = useTradeStore((s) => s.loadPrefs);
  const balance = useTradeStore((s) => s.balance);
  const positions = useTradeStore((s) => s.positions);
  const oneClick = useTradeStore((s) => s.oneClick);
  const clickSize = useTradeStore((s) => s.clickSize);
  const placeMarket = useTradeStore((s) => s.placeMarket);
  const lastToast = useTradeStore((s) => s.lastToast);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace>("default");
  const [mobile, setMobile] = useState<MobilePane>("markets");

  const needsFunds = hydrated && balance <= 0 && positions.length === 0;
  const inst = getInstrument(selected);

  useEffect(() => {
    market.start();
    loadPrefs();
    void hydrateFromServer();
  }, [hydrateFromServer, loadPrefs]);

  useEffect(() => {
    if (needsFunds) setDepositOpen(true);
  }, [needsFunds]);

  useEffect(() => {
    return market.subscribe(() => onTick());
  }, [onTick]);

  useEffect(() => {
    if (lastToast) toast.message(lastToast);
  }, [lastToast]);

  function trade(symbol: string, side: Side) {
    select(symbol);
    if (oneClick) {
      const result = placeMarket({
        symbol,
        side,
        lots: clickSize,
        sl: null,
        tp: null,
      });
      if (!result.ok) toast.error(result.error);
      return;
    }
    setTicketOpen(true);
    setMobile("trade");
  }

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <AccountBar onDeposit={() => setDepositOpen(true)} />
      <Sheet open={depositOpen} onOpenChange={setDepositOpen}>
        <SheetContent title="Add funds" side="right">
          <DepositDesk />
        </SheetContent>
      </Sheet>
      <WorkspaceTabs
        workspace={workspace}
        onWorkspace={setWorkspace}
        symbol={inst.display}
      />

      <div className="hidden min-h-0 flex-1 lg:grid lg:grid-cols-[280px_minmax(0,1fr)_260px] lg:grid-rows-[minmax(0,1fr)_220px]">
        {(workspace === "default" || workspace === "browse") && (
          <aside className="min-h-0 border-r border-border [grid-column:1] [grid-row:1/3]">
            <Watchlist onTrade={trade} />
          </aside>
        )}
        <section
          className={cn(
            "flex min-h-0 flex-col [grid-row:1]",
            workspace === "analysis" || workspace === "settings"
              ? "[grid-column:1/4]"
              : "[grid-column:2/4]",
          )}
        >
          {workspace === "settings" ? (
            <PlatformSettings />
          ) : (
            <CandleChart symbol={selected} onTrade={(side) => trade(selected, side)} />
          )}
        </section>
        <div
          className={cn(
            "min-h-0 border-t border-border bg-bg-elevated [grid-row:2]",
            workspace === "analysis" || workspace === "settings"
              ? "[grid-column:1/3]"
              : "[grid-column:2]",
          )}
        >
          <PositionsPanel />
        </div>
        <aside className="min-h-0 border-l border-t border-border [grid-column:3] [grid-row:2]">
          <NewsDesk />
        </aside>
      </div>

      <Sheet open={ticketOpen} onOpenChange={setTicketOpen}>
        <SheetContent title={`Deal ticket · ${inst.display}`} side="right">
          <div className="h-full">
            <OrderTicket />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        <div className="min-h-0 flex-1">
          {mobile === "markets" && <Watchlist onTrade={trade} />}
          {mobile === "chart" && (
            <CandleChart symbol={selected} onTrade={(side) => trade(selected, side)} />
          )}
          {mobile === "positions" && (
            <div className="h-full bg-bg-elevated">
              <PositionsPanel />
            </div>
          )}
          {mobile === "trade" && <OrderTicket />}
          {mobile === "more" && (
            <div className="space-y-2 p-4">
              <Button className="w-full" onClick={() => setDepositOpen(true)}>
                Add funds
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/account">Account</Link>
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/news">News</Link>
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/admin">Admin</Link>
              </Button>
              <PlatformSettings />
            </div>
          )}
        </div>
        <nav className="grid grid-cols-5 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)]">
          {(
            [
              ["markets", LayoutGrid, "Markets"],
              ["chart", BarChart3, "Chart"],
              ["positions", Newspaper, "Positions"],
              ["trade", PanelRight, "Trade"],
              ["more", Wallet, "More"],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMobile(id)}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] text-muted",
                mobile === id && "text-fg",
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>
      {!hydrated && <span className="sr-only">Loading account</span>}
    </div>
  );
}

function WorkspaceTabs({
  workspace,
  onWorkspace,
  symbol,
}: {
  workspace: Workspace;
  onWorkspace: (w: Workspace) => void;
  symbol: string;
}) {
  const tabs: Array<{ id: Workspace; label: string }> = [
    { id: "browse", label: "Browse markets" },
    { id: "default", label: "Default workspace" },
    { id: "analysis", label: symbol },
    { id: "settings", label: "Platform settings" },
  ];
  return (
    <div className="hidden h-9 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-bg-elevated px-2 lg:flex">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onWorkspace(t.id)}
          className={cn(
            "h-7 shrink-0 rounded-sm px-3 text-[12px] text-muted",
            workspace === t.id && "bg-bg text-fg shadow-[var(--shadow-border)]",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function PlatformSettings() {
  const pricing = useTradeStore((s) => s.pricing);
  const setPricing = useTradeStore((s) => s.setPricing);
  const oneClick = useTradeStore((s) => s.oneClick);
  const setOneClick = useTradeStore((s) => s.setOneClick);
  const clickSize = useTradeStore((s) => s.clickSize);
  const setClickSize = useTradeStore((s) => s.setClickSize);
  return (
    <div className="space-y-6 overflow-y-auto p-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-subtle">Platform settings</p>
        <h2 className="mt-1 font-display text-2xl">How this desk fills</h2>
      </div>
      <div>
        <p className="text-[12px] text-muted">Pricing book</p>
        <div className="mt-2 flex gap-2">
          <Button
            variant={pricing === "standard" ? "default" : "outline"}
            size="sm"
            onClick={() => setPricing("standard")}
          >
            Standard
          </Button>
          <Button
            variant={pricing === "raw" ? "default" : "outline"}
            size="sm"
            onClick={() => setPricing("raw")}
          >
            RAW
          </Button>
        </div>
      </div>
      <div>
        <p className="text-[12px] text-muted">1-click trading</p>
        <Button
          className="mt-2"
          variant={oneClick ? "buy" : "outline"}
          size="sm"
          onClick={() => setOneClick(!oneClick)}
        >
          {oneClick ? "On" : "Off"}
        </Button>
        <p className="mt-2 max-w-sm text-[12px] text-muted">
          When on, tapping Sell or Buy on the watchlist or chart fills immediately
          at the live bid/ask using the size below.
        </p>
      </div>
      <label className="block max-w-xs">
        <span className="mb-1.5 block text-[12px] text-muted">1-click size (lots)</span>
        <Input
          inputMode="decimal"
          value={String(clickSize)}
          onChange={(e) => setClickSize(Number(e.target.value) || 0.01)}
        />
      </label>
      <p className="flex items-center gap-2 text-[12px] text-muted">
        <Settings className="size-3.5" />
        Layouts save on this device. Orders save to your signed-in account.
      </p>
    </div>
  );
}
