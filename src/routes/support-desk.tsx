import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/layout/site-header";
import { SupportInbox } from "@/components/support/desk";
import { useOps } from "@/lib/ops/use-ops";
import { logoutSupportAgent, useSupportAgent } from "@/lib/ops/support-staff";

export const Route = createFileRoute("/support-desk")({ component: SupportDeskPage });

export function SupportDeskPage() {
  const ops = useOps();
  const agent = useSupportAgent();
  if (!agent && ops.loading) return <div className="min-h-dvh bg-[#111b21]" />;
  if (!agent && !ops.isAdmin) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#07080a] px-4 text-center text-white">
        <div>
          <p className="text-sm text-white/70">Support employees sign in with the user id created by admin.</p>
          <Link to="/support-login" className="mt-4 inline-block text-sm underline">
            Support sign in
          </Link>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-dvh bg-[#111b21] px-4 py-4 text-white">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <Logo compact />
          <h1 className="mt-2 text-lg font-semibold">Customer support</h1>
          <p className="text-xs text-white/50">{agent ? agent.name : "Admin"} · each customer has a separate chat</p>
        </div>
        {agent ? (
          <button type="button" className="text-sm text-white/60" onClick={() => logoutSupportAgent()}>
            Log out
          </button>
        ) : (
          <Link to="/admin" className="text-sm text-white/60">
            Admin desk
          </Link>
        )}
      </header>
      <SupportInbox />
    </main>
  );
}
