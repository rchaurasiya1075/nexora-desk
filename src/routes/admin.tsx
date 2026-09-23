import { createFileRoute, Navigate, useRouterState } from "@tanstack/react-router";
import { AdminDesk } from "@/components/admin/admin-desk";
import { AdminLoginPage } from "@/routes/admin.login";
import { useDeskSession } from "@/lib/firebase/session";

export const Route = createFileRoute("/admin")({ component: AdminPage });

export function AdminPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isPending } = useDeskSession();
  const onLogin = pathname.endsWith("/login");
  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-fg">
        <p className="text-sm text-muted">Loading ops…</p>
      </div>
    );
  }
  if (onLogin) return user ? <Navigate to="/admin" /> : <AdminLoginPage />;
  if (!user) return <Navigate to="/admin/login" />;
  return <AdminDesk />;
}