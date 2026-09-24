import { Link } from "@tanstack/react-router";
import { UserButton } from "@/lib/firebase/gates";
import { useDeskSession } from "@/lib/firebase/session";
import { Button } from "@/components/ui/button";
import { useOps } from "@/lib/ops/use-ops";

export function AuthSlot() {
  const { user, isPending } = useDeskSession();
  const ops = useOps();
  if (isPending) {
    return <div className="h-11 w-24 animate-pulse rounded-sm bg-bg-subtle" />;
  }
  if (user) {
    return (
      <div className="flex items-center gap-2">
        {(ops.isAdmin || ops.canClaim) && (
          <Button asChild size="sm" variant="ghost">
            <Link to="/admin">{ops.isAdmin ? "Admin" : "Ops setup"}</Link>
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link to="/account">Deposit</Link>
        </Button>
        <div className="max-w-[160px] truncate text-fg">
          <UserButton />
        </div>
      </div>
    );
  }
  return (
    <Button asChild size="sm">
      <Link to="/login">Sign in</Link>
    </Button>
  );
}
