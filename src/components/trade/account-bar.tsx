import { Link } from "@tanstack/react-router";
import { Bell, CircleHelp, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/site-header";
import { useDeskSession } from "@/lib/firebase/session";
import { useOps } from "@/lib/ops/use-ops";
import { useMarketTick } from "@/lib/market/use-market";
import { market } from "@/lib/market/engine";
import { snapshot, useTradeStore, MARGIN_CALL } from "@/lib/trading/store";
import { cn, formatMoney, formatSigned } from "@/lib/utils";

export function AccountBar({ onDeposit }: { onDeposit: () => void }) {
  useMarketTick();
  const { user, signOutDesk } = useDeskSession();
  const ops = useOps();
  const balance = useTradeStore((s) => s.balance);
  const positions = useTradeStore((s) => s.positions);
  const pricing = useTradeStore((s) => s.pricing);
  const setPricing = useTradeStore((s) => s.setPricing);
  const oneClick = useTradeStore((s) => s.oneClick);
  const setOneClick = useTradeStore((s) => s.setOneClick);
  const status = useTradeStore((s) => s.status);
  const alerts = useTradeStore((s) => s.alerts);
  const snap = snapshot({ balance, positions });
  const warn = Number.isFinite(snap.marginLevel) && snap.marginLevel < MARGIN_CALL;
  const acctNo = user?.id ? `SK-${user.id.slice(-8).toUpperCase()}` : "SK-DEMO";
  const live = market.feedLive;

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 bg-desk px-3 text-desk-fg">
      <Logo compact />
      <Link to="/" className="hidden font-display text-base tracking-tight sm:block">
        Sikkaaa
      </Link>
      <div className="hidden items-center gap-2 border-l border-desk-line pl-3 lg:flex">
        <span className="size-1.5 rounded-full bg-buy" />
        <div className="leading-tight">
          <p className="text-[11px] text-desk-fg">{user?.name ?? "Trader"}</p>
          <p className="text-[10px] text-desk-muted">
            {status === "frozen" ? "Frozen" : "Active"} · {acctNo}
          </p>
        </div>
      </div>
      {live && (
        <span className="hidden rounded-sm bg-buy/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-buy md:inline">
          Live
        </span>
      )}
      <div className="ml-auto flex min-w-0 items-center gap-4 overflow-x-auto text-[11px] num">
        <Stat label="Available to trade" value={formatMoney(Math.max(0, snap.free))} />
        <Stat
          label="Net equity"
          value={formatMoney(snap.equity)}
          tone={snap.floating >= 0 ? "buy" : "sell"}
        />
        <Stat label="Cash (USD)" value={formatMoney(balance)} className="hidden md:flex" />
        <Stat
          label="Unrealised P/L"
          value={formatSigned(snap.floating)}
          tone={snap.floating >= 0 ? "buy" : "sell"}
        />
        <Stat
          label="Total margin"
          value={formatMoney(snap.used)}
          className="hidden lg:flex"
          tone={warn ? "sell" : undefined}
        />
      </div>
      <div className="hidden items-center rounded-sm bg-desk-line p-0.5 sm:flex">
        <button
          type="button"
          onClick={() => {
            setPricing("standard");
            toast.message("Standard — spread only");
          }}
          className={cn(
            "h-7 rounded-sm px-2 text-[11px] text-desk-muted",
            pricing === "standard" && "bg-bg-subtle text-desk-fg",
          )}
        >
          Standard
        </button>
        <button
          type="button"
          onClick={() => {
            setPricing("raw");
            toast.message("RAW — from 0.0 pips + commission");
          }}
          className={cn(
            "h-7 rounded-sm px-2 text-[11px] text-desk-muted",
            pricing === "raw" && "bg-bg-subtle text-desk-fg",
          )}
        >
          RAW
        </button>
      </div>
      <Button size="sm" variant="buy" className="h-8 shrink-0 px-3 text-[12px]" onClick={onDeposit}>
        + Add funds
      </Button>
      <button
        type="button"
        onClick={() => {
          setOneClick(!oneClick);
          toast.message(oneClick ? "1-click trading off" : "1-click trading on — tap Sell/Buy to fill");
        }}
        className="hidden items-center gap-2 sm:flex"
        aria-pressed={oneClick}
      >
        <span
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors duration-150",
            oneClick ? "bg-buy" : "bg-desk-line",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-4 rounded-full bg-desk-fg transition-transform duration-150",
              oneClick ? "translate-x-4" : "translate-x-0.5",
            )}
          />
        </span>
        <span className="text-[10px] uppercase tracking-wide text-desk-muted">
          1-click {oneClick ? "on" : "off"}
        </span>
      </button>
      {ops.isAdmin && (
        <Link to="/admin" className="hidden text-[11px] text-desk-muted hover:text-desk-fg lg:block">
          Admin
        </Link>
      )}
      <Link
        to="/account"
        className="relative flex size-8 items-center justify-center rounded-sm text-desk-muted hover:text-desk-fg"
        aria-label="Alerts"
      >
        <Bell className="size-4" />
        {alerts.length > 0 && (
          <span className="absolute right-1 top-1 size-1.5 rounded-full bg-sell" />
        )}
      </Link>
      <Link
        to="/news"
        className="hidden size-8 items-center justify-center rounded-sm text-desk-muted hover:text-desk-fg md:flex"
        aria-label="Help"
      >
        <CircleHelp className="size-4" />
      </Link>
      <button
        type="button"
        className="flex size-8 items-center justify-center rounded-sm text-desk-muted hover:text-desk-fg"
        aria-label="Sign out"
        onClick={() => void signOutDesk()}
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: string;
  tone?: "buy" | "sell";
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col leading-tight", className)}>
      <span className="truncate text-[10px] text-desk-muted">{label}</span>
      <span
        className={cn(
          "truncate text-[12px] text-desk-fg",
          tone === "buy" && "text-buy",
          tone === "sell" && "text-sell",
        )}
      >
        {value}
      </span>
    </div>
  );
}
