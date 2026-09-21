import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminDesk } from "@/components/admin/admin-desk";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/layout/site-header";
import { SignInGate } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/admin")({ component: AdminPage });

export function AdminPage() {
  const { isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-fg">
        <p className="text-sm text-muted">Loading ops…</p>
      </div>
    );
  }
  return (
    <SignInGate fallback={<AdminLocked />}>
      <AdminDesk />
    </SignInGate>
  );
}

function AdminLocked() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 text-fg">
      <Logo />
      <h1 className="mt-8 max-w-md text-center font-display text-4xl">Sign in for ops</h1>
      <p className="mt-3 max-w-md text-center text-sm text-muted">
        Admin tools are tied to your login.
      </p>
      <div className="mt-8">
        <LoginForm callbackURL="/admin" />
      </div>
      <Link to="/" className="mt-8 text-sm text-muted hover:text-fg">
        Back
      </Link>
    </div>
  );
}
