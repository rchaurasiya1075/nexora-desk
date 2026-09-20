import { Link } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/site-header";
import { UserButton } from "@/lib/auth/gates";
import { useMarketTick } from "@/lib/market/use-market";
import { market } from "@/lib/market/engine";
import { snapshot, useTradeStore, MARGIN_CALL } from "@/lib/trading/store";
import { cn, formatMoney, formatSigned } from "@/lib/utils";

export function AccountBar({ onDeposit }: { onDeposit: () => void }) {
  useMarketTick();
  const balance = useTradeStore((s) => s.balance);
  const positions = useTradeStore((s) => s.positions);
  const pricing = useTradeStore((s) => s.pricing);
  const setPricing = useTradeStore((s) => s.setPricing);
  const resetDemo = useTradeStore((s) => s.resetDemo);
  const status = useTradeStore((s) => s.status);
  const snap = snapshot({ balance, positions });
  const usdInr = market.getQuote("USDINR").mid;
  const warn = Number.isFinite(snap.marginLevel) && snap.marginLevel < MARGIN_CALL;

  return (
    <div className="flex h-14 items-center gap-3 border-b border-border bg-bg px-3">
      <Logo compact />
      <Link to="/" className="hidden font-display text-lg text-fg sm:block">
        Nexora
      </Link>
      <span className="hidden rounded-full bg-bg-subtle px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted lg:inline">
        Paper desk
      </span>
      {status === "frozen" && (
        <span className="rounded-full bg-sell/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sell">
          Frozen
        </span>
      )}
      <div className="ml-auto flex min-w-0 items-center gap-3 overflow-x-auto text-[11px] num">
        <Stat label="Balance" value={formatMoney(balance)} />
        <Stat
          label="Equity"
          value={formatMoney(snap.equity)}
          tone={snap.floating >= 0 ? "buy" : "sell"}
        />
        <Stat
          label="P/L"
          value={formatSigned(snap.floating)}
          tone={snap.floating >= 0 ? "buy" : "sell"}
        />
        <Stat label="Margin" value={formatMoney(snap.used)} className="hidden md:flex" />
        <Stat
          label="Level"
          value={
            Number.isFinite(snap.marginLevel) ? `${snap.marginLevel.toFixed(0)}%` : "—"
          }
          tone={warn ? "sell" : undefined}
          className="hidden md:flex"
        />
        <Stat
          label="INR eq."
          value={`₹${(snap.equity * usdInr).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          className="hidden xl:flex"
        />
      </div>
      <div className="hidden items-center gap-1 sm:flex">
        <button
          type="button"
          onClick={() => {
            setPricing("standard");
            toast.message("Standard account — spread only");
          }}
          className={cn(
            "h-8 rounded-sm px-2 text-[11px] text-muted",
            pricing === "standard" && "bg-bg-subtle text-fg",
          )}
        >
          Standard
        </button>
        <button
          type="button"
          onClick={() => {
            setPricing("raw");
            toast.message("RAW account — from 0.0 pips + commission");
          }}
          className={cn(
            "h-8 rounded-sm px-2 text-[11px] text-muted",
            pricing === "raw" && "bg-bg-subtle text-fg",
          )}
        >
          RAW
        </button>
      </div>
      <Button size="sm" variant="outline" onClick={onDeposit}>
        Deposit
      </Button>
      <button
        type="button"
        aria-label="Flatten positions"
        className="flex size-9 items-center justify-center rounded-sm text-muted hover:text-fg"
        onClick={() => {
          resetDemo();
          toast.message("Open positions flattened");
        }}
      >
        <RotateCcw className="size-4" />
      </button>
      <div className="hidden sm:block">
        <UserButton />
      </div>
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
    <div className={cn("flex flex-col leading-tight", className)}>
      <span className="text-[10px] uppercase tracking-wide text-subtle">{label}</span>
      <span
        className={cn(
          "text-[12px] text-fg",
          tone === "buy" && "text-buy",
          tone === "sell" && "text-sell",
        )}
      >
        {value}
      </span>
    </div>
  );
}
