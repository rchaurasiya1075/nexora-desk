import { createFileRoute, Link } from "@tanstack/react-router";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/layout/site-header";

export const Route = createFileRoute("/admin/login")({ component: AdminLoginPage });

export function AdminLoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#07080a] px-4 text-fg">
      <div className="w-full max-w-sm">
        <Logo />
        <p className="mt-8 text-[11px] uppercase tracking-[0.2em] text-muted">Operations</p>
        <h1 className="mt-2 font-display text-4xl">Admin sign in</h1>
        <p className="mt-3 text-sm text-muted">
          Staff only. Use the Gmail on the admin role, or the operator user id.
          Customers stay on the trading desk.
        </p>
        <div className="mt-8">
          <LoginForm callbackURL="/admin" admin />
        </div>
        <p className="mt-8 text-center text-sm text-muted">
          <Link to="/login" className="hover:text-fg">
            Customer sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
