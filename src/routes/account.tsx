import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/layout/site-header";
import { DepositDesk } from "@/components/trade/deposit-desk";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listLedger, type LedgerRow } from "@/lib/trading/account-api";
import { snapshot, useTradeStore } from "@/lib/trading/store";
import { formatMoney } from "@/lib/utils";

export const Route = createFileRoute("/account")({ component: AccountPage });

export function AccountPage() {
  const { user, isPending } = useCurrentUserState();
  const hydrateFromServer = useTradeStore((s) => s.hydrateFromServer);
  const balance = useTradeStore((s) => s.balance);
  const positions = useTradeStore((s) => s.positions);
  const pricing = useTradeStore((s) => s.pricing);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);

  useEffect(() => {
    if (!user) return;
    void hydrateFromServer();
    void listLedger()
      .then(setLedger)
      .catch(() => setLedger([]));
  }, [user, hydrateFromServer]);

  if (isPending) {
    return (
      <div className="min-h-dvh bg-bg text-fg">
        <SiteHeader />
        <div className="mx-auto max-w-3xl px-4 py-16">
          <div className="h-10 w-48 animate-pulse rounded-sm bg-bg-subtle" />
        </div>
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;

  const snap = snapshot({ balance, positions });

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-subtle">Account</p>
        <h1 className="mt-2 font-display text-4xl">
          {user.displayName ?? user.primaryEmail ?? "Your desk"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Signed in. Submit a UPI, QR or bank request. After an admin
          approves, paper USD hits this login — not a guest stash.
        </p>
        <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat k="Cash" v={formatMoney(balance)} />
          <Stat k="Equity" v={formatMoney(snap.equity)} />
          <Stat k="Open" v={String(positions.length)} />
          <Stat k="Book" v={pricing === "raw" ? "RAW" : "Standard"} />
        </dl>
        <div className="mt-10 rounded-xl bg-bg-elevated shadow-[var(--shadow-border)]">
          <DepositDesk />
        </div>
        <section className="mt-10">
          <h2 className="font-display text-2xl">Funding history</h2>
          {ledger.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No deposits yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-xl bg-bg-elevated shadow-[var(--shadow-border)]">
              {ledger.map((row) => (
                <li key={row.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-muted">
                    {row.kind} · {new Date(row.createdAt).toLocaleString()}
                  </span>
                  <span className="num text-fg">{formatMoney(row.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
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
