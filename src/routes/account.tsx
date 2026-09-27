import { createFileRoute } from "@tanstack/react-router";
import { ProfileDesk } from "@/components/account/profile-desk";
import { AppShell } from "@/components/app/shell";
import { RedirectToSignIn } from "@/lib/firebase/gates";
import { useDeskSession } from "@/lib/firebase/session";

export const Route = createFileRoute("/account")({ component: AccountPage });

export function AccountPage() {
  const { user, isPending } = useDeskSession();
  if (isPending) return <div className="min-h-dvh bg-bg" />;
  if (!user) return <RedirectToSignIn />;
  return (
    <AppShell>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 rounded-2xl border border-border bg-bg-elevated p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-accent">Demo account</p>
          <p className="mt-1 text-lg font-semibold">{user.name || "Trader"}</p>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
        <ProfileDesk />
      </main>
    </AppShell>
  );
}
