import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LayoutGrid, PanelRight, CircleDollarSign } from "lucide-react";
import { AccountBar } from "./account-bar";
import { CandleChart } from "./candle-chart";
import { DepositDesk } from "./deposit-desk";
import { OrderTicket } from "./order-ticket";
import { PositionsPanel } from "./positions-panel";
import { Watchlist } from "./watchlist";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useTradeStore } from "@/lib/trading/store";
import { market } from "@/lib/market/engine";
import { Button } from "@/components/ui/button";

export function Terminal() {
  const selected = useTradeStore((s) => s.selected);
  const onTick = useTradeStore((s) => s.onTick);
  const hydrated = useTradeStore((s) => s.hydrated);
  const hydrateFromServer = useTradeStore((s) => s.hydrateFromServer);
  const balance = useTradeStore((s) => s.balance);
  const positions = useTradeStore((s) => s.positions);
  const [listOpen, setListOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);

  const needsFunds = hydrated && balance <= 0 && positions.length === 0;

  useEffect(() => {
    market.start();
    void hydrateFromServer();
  }, [hydrateFromServer]);

  useEffect(() => {
    if (needsFunds) setDepositOpen(true);
  }, [needsFunds]);

  useEffect(() => {
    return market.subscribe(() => onTick());
  }, [onTick]);

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <AccountBar onDeposit={() => setDepositOpen(true)} />
      <Sheet open={depositOpen} onOpenChange={setDepositOpen}>
        <SheetContent title="Deposit" side="right">
          <DepositDesk />
        </SheetContent>
      </Sheet>
      <div className="hidden min-h-0 flex-1 lg:grid lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside className="min-h-0 border-r border-border bg-bg-elevated">
          <Watchlist />
        </aside>
        <section className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-[1.4]">
            <CandleChart symbol={selected} />
          </div>
          <div className="h-[220px] border-t border-border bg-bg-elevated">
            <PositionsPanel />
          </div>
        </section>
        <aside className="min-h-0 border-l border-border bg-bg-elevated">
          <OrderTicket />
        </aside>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        <div className="min-h-0 flex-1">
          <CandleChart symbol={selected} />
        </div>
        <div className="h-[38%] min-h-[180px] border-t border-border bg-bg-elevated">
          <PositionsPanel />
        </div>
        <div className="flex gap-2 border-t border-border p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <Sheet open={listOpen} onOpenChange={setListOpen}>
            <SheetTrigger asChild>
              <Button variant="muted" className="flex-1">
                <LayoutGrid className="size-4" />
                Markets
              </Button>
            </SheetTrigger>
            <SheetContent title="Markets" side="bottom">
              <div className="h-[70dvh]">
                <Watchlist onPick={() => setListOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <Sheet open={ticketOpen} onOpenChange={setTicketOpen}>
            <SheetTrigger asChild>
              <Button className="flex-[1.4]">
                <PanelRight className="size-4" />
                Trade
              </Button>
            </SheetTrigger>
            <SheetContent title="Ticket" side="bottom">
              <div className="h-[70dvh]">
                <OrderTicket />
              </div>
            </SheetContent>
          </Sheet>
          <Button variant="outline" className="flex-1" asChild>
            <Link to="/account">
              <CircleDollarSign className="size-4" />
              Funds
            </Link>
          </Button>
        </div>
      </div>
      {!hydrated && <span className="sr-only">Loading account</span>}
    </div>
  );
}
