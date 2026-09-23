import { useEffect, useState } from "react";
import { toast } from "sonner";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase/db"; // Aapki firebase config file
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { adminCredit, setUserAdmin, setUserFrozen } from "@/lib/ops/api";
import type { DeskUser } from "@/lib/ops/types";
import { formatMoney } from "@/lib/utils";
import { useDeskUser } from "@/lib/firebase/session";
import { useTradeStore } from "@/lib/trading/store";

export function AdminUsers({ onChange }: { onChange: () => void }) {
  const me = useDeskUser();
  const hydrateFromServer = useTradeStore((s) => s.hydrateFromServer);
  const [rows, setRows] = useState<DeskUser[]>([]);
  const [q, setQ] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  // Firestore Realtime Listener
  useEffect(() => {
    const qUsers = query(collection(db, "users"));
    const unsubscribe = onSnapshot(
      qUsers,
      (snapshot) => {
        const usersList: DeskUser[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as DeskUser[];
        setRows(usersList);
      },
      (err) => {
        console.error("Firestore user fetch error:", err);
        toast.error("Could not load users in real-time.");
      }
    );

    return () => unsubscribe();
  }, []);

  const filtered = rows.filter((u) => {
    const hay = `${u.name || ""} ${u.email || ""} ${u.id || ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  async function credit(user: DeskUser, amount: number) {
    setBusy(user.id);
    try {
      await adminCredit({
        data: { userId: user.id, amount, note: "Admin wallet credit" },
      });
      toast.success(`${amount > 0 ? "Credited" : "Debited"} ${user.email}`);
      onChange();
      if (me?.id === user.id) await hydrateFromServer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Credit failed.");
    } finally {
      setBusy(null);
    }
  }

  async function freeze(user: DeskUser, frozen: boolean) {
    setBusy(user.id);
    try {
      await setUserFrozen({ data: { userId: user.id, frozen } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(null);
    }
  }

  async function promote(user: DeskUser, admin: boolean) {
    setBusy(user.id);
    try {
      await setUserAdmin({ data: { userId: user.id, admin } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Role update failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <Input
        placeholder="Search name or email"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="mt-4 space-y-3">
        {filtered.map((user) => (
          <li
            key={user.id}
            className="rounded-xl bg-bg-elevated p-4 shadow-[var(--shadow-border)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-fg">{user.name || "Trader"}</p>
                <p className="text-[13px] text-muted">{user.email}</p>
                <p className="mt-1 font-display text-2xl num">
                  {formatMoney(user.balance || 0)}
                </p>
                <p className="mt-1 text-[12px] text-subtle">
                  {user.openPositions || 0} open · {user.pendingDeposits || 0} pending
                </p>
              </div>
              <div className="flex gap-1.5">
                {user.role === "admin" ? (
                  <Badge tone="warn">Admin</Badge>
                ) : (
                  <Badge>User</Badge>
                )}
                {user.status === "frozen" ? (
                  <Badge tone="sell">Frozen</Badge>
                ) : (
                  <Badge tone="buy">Live</Badge>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Input
                className="w-32"
                placeholder="USD"
                value={amounts[user.id] ?? ""}
                onChange={(e) =>
                  setAmounts((s) => ({ ...s, [user.id]: e.target.value }))
                }
              />
              <Button
                size="sm"
                variant="buy"
                disabled={busy === user.id}
                onClick={() =>
                  void credit(user, Number(amounts[user.id] || 1000))
                }
              >
                Credit
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy === user.id}
                onClick={() => void credit(user, 10000)}
              >
                +$10k
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy === user.id}
                onClick={() => void freeze(user, user.status !== "frozen")}
              >
                {user.status === "frozen" ? "Unfreeze" : "Freeze"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy === user.id || user.id === me?.id}
                onClick={() => void promote(user, user.role !== "admin")}
              >
                {user.role === "admin" ? "Remove admin" : "Make admin"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
