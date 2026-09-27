import { createFileRoute, Link } from "@tanstack/react-router";
import { LoginForm } from "@/components/auth/login-form";
import { AppShell } from "@/components/app/shell";
import { PositionsScreen } from "@/components/app/positions-screen";
import { TradeScreen } from "@/components/app/trade-screen";
import { Logo } from "@/components/layout/site-header";
import { SignInGate } from "@/lib/firebase/gates";
import { useDeskSession } from "@/lib/firebase/session";

type TradeSearch = { view?: "positions"; symbol?: string };

export const Route = createFileRoute("/trade")({
  validateSearch: (search: Record<string, unknown>): TradeSearch => {
    const out: TradeSearch = {};
    if (search.view === "positions") out.view = "positions";
    if (typeof search.symbol === "string") out.symbol = search.symbol.toUpperCase();
    return out;
  },
  component: TradePage,
});

export function TradePage() {
  const { isPending } = useDeskSession();
  const { view, symbol } = Route.useSearch();
  if (isPending) return <div className="min-h-dvh bg-bg" />;
  return (
    <SignInGate fallback={<TradeLocked />}>
      <AppShell>{view === "positions" ? <PositionsScreen /> : <TradeScreen symbol={symbol} />}</AppShell>
    </SignInGate>
  );
}

function TradeLocked() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 text-fg">
      <Logo />
      <h1 className="mt-8 max-w-md text-center font-display text-4xl">Sign in, then buy or sell</h1>
      <p className="mt-3 max-w-md text-center text-sm text-muted">
        Paper trading only. After sign-in, Trade is the middle button. Pick a pair, enter an amount, then BUY or SELL.
      </p>
      <div className="mt-8">
        <LoginForm callbackURL="/trade" />
      </div>
      <Link to="/" className="mt-8 text-sm text-muted hover:text-fg">
        Back home
      </Link>
    </div>
  );
}
