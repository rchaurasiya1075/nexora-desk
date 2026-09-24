import { useEffect, useState } from "react";
import { getMyOps } from "@/lib/ops/api";
import type { MeOps } from "@/lib/ops/types";
import { useDeskSession } from "@/lib/firebase/session";

export function useOps(): MeOps & { loading: boolean; reload: () => void } {
  const { user, isPending } = useDeskSession();
  const userId = user?.id ?? "";
  const [ops, setOps] = useState<MeOps>({
    userId: "",
    isAdmin: false,
    canClaim: false,
    staffCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (isPending) return;
    if (!userId) {
      setOps({ userId: "", isAdmin: false, canClaim: false, staffCount: 0 });
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    void getMyOps()
      .then((next) => {
        if (live) setOps(next);
      })
      .catch(() => {
        if (live) setOps({ userId, isAdmin: false, canClaim: false, staffCount: 0 });
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [userId, isPending, tick]);

  return { ...ops, loading, reload: () => setTick((n) => n + 1) };
}
