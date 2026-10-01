import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginSupportAgent } from "@/lib/ops/support-staff";

export const Route = createFileRoute("/support-login")({ component: SupportLoginPage });

export function SupportLoginPage() {
  const navigate = useNavigate();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: { preventDefault: () => void }) {
    e.preventDefault();
    setBusy(true);
    try {
      await loginSupportAgent(id, password);
      await navigate({ to: "/support-desk" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[#07080a] px-4 text-white">
      <form className="w-full max-w-sm" onSubmit={(e) => void submit(e)}>
        <Logo />
        <p className="mt-8 text-[11px] uppercase tracking-[0.2em] text-white/50">Customer support</p>
        <h1 className="mt-2 text-3xl font-semibold">Employee sign in</h1>
        <p className="mt-3 text-sm text-white/60">This login opens only the customer support desk. It does not open the admin panel.</p>
        <div className="mt-6 grid gap-2">
          <Input value={id} placeholder="User id" onChange={(e) => setId(e.target.value)} />
          <Input value={password} type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
        </div>
        <p className="mt-6 text-sm text-white/50">
          <Link to="/admin/login">Admin sign in</Link>
        </p>
      </form>
    </main>
  );
}
