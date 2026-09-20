import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Logo } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserButton } from "@/lib/auth/gates";
import {
  claimAdmin,
  getAdminOverview,
} from "@/lib/ops/api";
import { useOps } from "@/lib/ops/use-ops";
import { formatMoney } from "@/lib/utils";
import { AdminDeposits } from "./admin-deposits";
import { AdminUsers } from "./admin-users";
import { AdminRails } from "./admin-rails";
import type { AdminOverview } from "@/lib/ops/types";

export function AdminDesk() {
  const ops = useOps();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [claiming, setClaiming] = useState(false);

  async function loadOverview() {
    try {
      setOverview(await getAdminOverview());
    } catch {
      setOverview(null);
    }
  }

  useEffect(() => {
    if (ops.isAdmin) void loadOverview();
  }, [ops.isAdmin]);

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
        <AdminBar />
        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-16">
          <p className="text-xs uppercase tracking-[0.18em] text-subtle">Operations</p>
          <h1 className="mt-2 font-display text-4xl">
            {ops.canClaim ? "Set up the desk" : "Staff only"}
          </h1>
          <p className="mt-3 text-sm text-muted">
            {ops.canClaim
              ? "No admin yet. The first operator to claim this desk can approve deposits, manage rails, and credit wallets."
              : "This login is not an admin. Ask the desk operator to promote you."}
          </p>
          {ops.canClaim && (
            <Button className="mt-8 w-full" disabled={claiming} onClick={() => void claim()}>
              {claiming ? "Claiming…" : "Become desk admin"}
            </Button>
          )}
          <Link to="/trade" className="mt-6 text-sm text-muted hover:text-fg">
            Back to trader
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <AdminBar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-subtle">Operations</p>
            <h1 className="mt-2 font-display text-4xl">Admin desk</h1>
            <p className="mt-2 max-w-xl text-sm text-muted">
              Approve funding, manage users, and edit UPI / QR / bank rails.
              Credits land as paper USD on the trader’s account.
            </p>
          </div>
        </div>
        <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat k="Users" v={String(overview?.users ?? "—")} />
          <Stat k="Pending" v={String(overview?.pending ?? "—")} />
          <Stat k="Paper AUM" v={overview ? formatMoney(overview.paperAum) : "—"} />
          <Stat k="Approved today" v={String(overview?.approvedToday ?? "—")} />
        </dl>
        <Tabs defaultValue="deposits" className="mt-10">
          <TabsList>
            <TabsTrigger value="deposits">Deposits</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="rails">Rails</TabsTrigger>
          </TabsList>
          <TabsContent value="deposits" className="mt-6">
            <AdminDeposits onChange={() => void loadOverview()} />
          </TabsContent>
          <TabsContent value="users" className="mt-6">
            <AdminUsers onChange={() => void loadOverview()} />
          </TabsContent>
          <TabsContent value="rails" className="mt-6">
            <AdminRails />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function AdminBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Logo compact />
        <span className="font-display text-lg">Ops</span>
        <nav className="ml-4 hidden items-center gap-4 text-sm text-muted sm:flex">
          <Link to="/trade" className="hover:text-fg">
            Trader
          </Link>
          <Link to="/account" className="hover:text-fg">
            Account
          </Link>
        </nav>
        <div className="ml-auto">
          <UserButton />
        </div>
      </div>
    </header>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-bg-elevated p-4 shadow-[var(--shadow-border)]">
      <dt className="text-[11px] uppercase tracking-wide text-subtle">{k}</dt>
      <dd className="mt-1 font-display text-2xl num">{v}</dd>
    </div>
  );
}
