import { createFileRoute } from "@tanstack/react-router";
import { ProfileDesk } from "@/components/account/profile-desk";
import { SiteFooter, SiteHeader } from "@/components/layout/site-header";
import { RedirectToSignIn } from "@/lib/firebase/gates";
import { useDeskSession } from "@/lib/firebase/session";

export const Route = createFileRoute("/account")({ component: AccountPage });

export function AccountPage() {
  const { user, isPending } = useDeskSession();

  if (isPending) {
    return (
      <div className="min-h-dvh bg-bg text-fg">
        <SiteHeader />
        <div className="mx-auto max-w-5xl px-4 py-16">
          <div className="h-10 w-48 animate-pulse rounded-sm bg-bg-subtle" />
        </div>
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ProfileDesk />
      </main>
      <SiteFooter />
    </div>
  );
}
