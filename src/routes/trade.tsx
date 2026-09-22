import { createFileRoute, Link } from "@tanstack/react-router";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/layout/site-header";
import { Terminal } from "@/components/trade/terminal";
import { SignInGate } from "@/lib/firebase/gates";
import { useDeskSession } from "@/lib/firebase/session";

export const Route = createFileRoute("/trade")({ component: TradePage });

export function TradePage() {
  const { isPending } = useDeskSession();
  if (isPending) {
    return <div className="min-h-dvh bg-bg text-fg" />;
  }
  return (
    <SignInGate fallback={<TradeLocked />}>
      <Terminal />
    </SignInGate>
  );
}

function TradeLocked() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 text-fg">
      <Logo />
      <h1 className="mt-8 max-w-md text-center font-display text-4xl">
        Sign in, deposit, then trade
      </h1>
      <p className="mt-3 max-w-md text-center text-sm text-muted">
        Open the paper desk in one tap, or sign in. Tickets fill at the live
        bid and ask. First account on this browser is admin.
      </p>
      <div className="mt-8">
        <LoginForm callbackURL="/trade" />
      </div>
      <Link to="/" className="mt-8 text-sm text-muted hover:text-fg">
        Back to markets
      </Link>
    </div>
  );
}
