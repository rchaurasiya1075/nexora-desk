import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/layout/site-header";
import { SupportInbox } from "@/components/support/desk";
import { useOps } from "@/lib/ops/use-ops";

export const Route = createFileRoute("/support-desk")({ component: SupportDeskPage });

export function SupportDeskPage() {
  const ops = useOps();
  if (ops.loading) return <div className="min-h-dvh bg-bg" />;
  if (!ops.isAdmin) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg px-4 text-center text-fg">
        <div>
          <p className="text-sm text-muted">Staff only. Sign in with the admin account.</p>
          <Link to="/admin/login" className="mt-4 inline-block text-sm underline">
            Admin login
          </Link>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-dvh bg-bg px-4 py-4 text-fg">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <Logo compact />
          <h1 className="mt-2 text-lg font-semibold">Customer support</h1>
          <p className="text-xs text-muted">Every customer message, including photos, lands here.</p>
        </div>
        <Link to="/admin" className="text-sm text-muted">
          Admin desk
        </Link>
      </header>
      <SupportInbox />
    </main>
  );
}
