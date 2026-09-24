import { Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useDeskSession } from "./session";

export function SignInGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  const { user, isPending } = useDeskSession();
  if (isPending) return <div className="min-h-dvh bg-bg" />;
  if (!user) return <>{fallback}</>;
  return <>{children}</>;
}

export function RedirectToSignIn() {
  return (
    <div className="grid min-h-[40vh] place-items-center px-4 text-center">
      <div>
        <p className="text-sm text-muted">Sign in to continue.</p>
        <Button asChild className="mt-4">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}

export function UserButton() {
  const { user, isPending, signOutDesk } = useDeskSession();
  if (isPending || !user) return null;
  return (
    <div className="flex items-center gap-2">
      <Link to="/account" className="flex max-w-[180px] items-center gap-2 text-sm text-fg" aria-label="Open profile">
        <span className="grid size-8 place-items-center rounded-full bg-fg text-xs font-semibold text-bg">
          {(user.name || "S").slice(0, 1).toUpperCase()}
        </span>
        <span className="truncate">{user.name}</span>
      </Link>
      <button
        type="button"
        className="flex size-9 items-center justify-center rounded-sm text-muted hover:bg-bg-subtle hover:text-fg"
        aria-label="Sign out"
        onClick={() => void signOutDesk()}
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}
