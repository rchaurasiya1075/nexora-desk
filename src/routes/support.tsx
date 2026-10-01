import { createFileRoute, Link } from "@tanstack/react-router";
import { CustomerSupport } from "@/components/support/desk";
import { useDeskSession } from "@/lib/firebase/session";

export const Route = createFileRoute("/support")({ component: SupportPage });

export function SupportPage() {
  const { user, isPending } = useDeskSession();
  if (isPending) return <div className="min-h-dvh bg-bg" />;
  if (!user) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg px-4 text-center text-fg">
        <div>
          <p className="text-sm text-muted">Sign in, then write to customer support.</p>
          <Link to="/login" className="mt-4 inline-block rounded-lg bg-fg px-4 py-2 text-sm text-bg">
            Sign in
          </Link>
        </div>
      </main>
    );
  }
  return <CustomerSupport />;
}
