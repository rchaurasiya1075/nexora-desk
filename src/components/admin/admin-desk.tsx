import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Logo } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { claimAdmin } from "@/lib/ops/api";
import { useOps } from "@/lib/ops/use-ops";
import { useDeskSession } from "@/lib/firebase/session";
import { AdminConsole } from "./admin-console";

const SEEN = "sikkaaa.admin.seen";
const MAX_AGE = 12 * 60 * 60 * 1000;

export function AdminDesk() {
  const ops = useOps();
  const { signOutDesk } = useDeskSession();
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!ops.isAdmin || typeof window === "undefined") return;
    const raw = sessionStorage.getItem(SEEN);
    const at = raw ? Number(raw) : 0;
    if (at && Date.now() - at > MAX_AGE) {
      sessionStorage.removeItem(SEEN);
      void signOutDesk();
      return;
    }
    if (!at) sessionStorage.setItem(SEEN, String(Date.now()));
  }, [ops.isAdmin, signOutDesk]);

  async function claim() {
    setClaiming(true);
    try {
      await claimAdmin();
      ops.reload();
      toast.success("You are the desk admin.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not claim admin.");
    } finally {
      setClaiming(false);
    }
  }

  if (ops.loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-fg">
        <p className="text-sm text-muted">Loading ops…</p>
      </div>
    );
  }

  if (!ops.isAdmin) {
    return (
      <div className="flex min-h-dvh flex-col bg-bg text-fg">
        <header className="border-b border-border px-4 py-4">
          <Logo />
        </header>
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-16">
          <p className="text-xs uppercase tracking-[0.18em] text-subtle">Operations</p>
          <h1 className="mt-2 font-display text-4xl">
            {ops.canClaim ? "Set up the desk" : "Staff only"}
          </h1>
          <p className="mt-3 text-sm text-muted">
            {ops.canClaim
              ? "No admin yet. The first operator to claim this desk approves deposits, sets prices, and credits paper USD."
              : "This login is not on the staff list. An existing admin can promote this account."}
          </p>
          {ops.canClaim && (
            <Button className="mt-8 w-full" disabled={claiming} onClick={() => void claim()}>
              {claiming ? "Claiming…" : "Become desk admin"}
            </Button>
          )}
          <Link to="/trade" className="mt-6 text-sm text-muted hover:text-fg">
            Customer desk
          </Link>
        </main>
      </div>
    );
  }

  return <AdminConsole />;
}
