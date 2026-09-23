import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/layout/site-header";
import { useDeskSession } from "@/lib/firebase/session";

export const Route = createFileRoute("/login")({ component: LoginPage });

export function LoginPage() {
  const { user, isPending } = useDeskSession();
  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg text-fg">
        <div className="h-11 w-48 animate-pulse rounded-sm bg-bg-subtle" />
      </main>
    );
  }
  if (user) return <Navigate to="/trade" />;
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 text-fg">
      <div className="w-full max-w-sm">
        <Logo />
        <h1 className="mt-8 font-display text-4xl">Sign in to trade</h1>
        <p className="mt-3 text-sm text-muted">
          Sign in with Google or your Gmail and password. Forgot password sends a
          reset link to that Gmail. New accounts start at $0.
        </p>
        <div className="mt-8">
          <LoginForm callbackURL="/trade" />
        </div>
        <p className="mt-8 text-center text-sm text-muted">
          <Link to="/" className="hover:text-fg">
            Back to markets
          </Link>
        </p>
      </div>
    </main>
  );
}
