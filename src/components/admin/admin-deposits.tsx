import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listAllDeposits, reviewDeposit } from "@/lib/ops/api";
import type { DepositRequest } from "@/lib/ops/types";
import { formatAmount } from "@/lib/ops/money";
import { formatMoney } from "@/lib/utils";

export function AdminDeposits({ onChange }: { onChange: () => void }) {
  const [rows, setRows] = useState<DepositRequest[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [busy, setBusy] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [usd, setUsd] = useState<Record<number, string>>({});

  async function load() {
    const data = await listAllDeposits({
      data: { status: filter === "all" ? undefined : filter },
    });
    setRows(data);
  }

  useEffect(() => {
    void load().catch(() => toast.error("Could not load deposits."));
  }, [filter]);

  async function act(row: DepositRequest, action: "approve" | "reject") {
    setBusy(row.id);
    try {
      const override = usd[row.id];
      await reviewDeposit({
        data: {
          id: row.id,
          action,
          usdCredit: override ? Number(override) : undefined,
          adminNote: notes[row.id],
        },
      });
      toast.success(action === "approve" ? "Credited to user wallet." : "Rejected.");
      await load();
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Review failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {(["pending", "all", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`h-9 rounded-sm px-3 text-[13px] capitalize ${
              filter === f ? "bg-bg-subtle text-fg" : "text-muted hover:text-fg"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No requests in this view.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-xl bg-bg-elevated p-4 shadow-[var(--shadow-border)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl">
                    {formatAmount(row.amount, row.currency)} → {formatMoney(row.usdCredit)}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {row.userName || row.userEmail || row.userId} · {row.methodTitle} · {row.payerName}
                  </p>
                  <p className="mt-1 text-[12px] text-subtle">
                    Ref {row.reference}
                    {row.note ? ` · ${row.note}` : ""} · #{row.id}
                  </p>
                </div>
                <Status status={row.status} />
              </div>
              {row.status === "pending" && (
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_140px_auto_auto]">
                  <Input
                    placeholder="Admin note"
                    value={notes[row.id] ?? ""}
                    onChange={(e) => setNotes((s) => ({ ...s, [row.id]: e.target.value }))}
                  />
                  <Input
                    placeholder="USD override"
                    value={usd[row.id] ?? ""}
                    onChange={(e) => setUsd((s) => ({ ...s, [row.id]: e.target.value }))}
                  />
                  <Button
                    variant="buy"
                    disabled={busy === row.id}
                    onClick={() => void act(row, "approve")}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="sell"
                    disabled={busy === row.id}
                    onClick={() => void act(row, "reject")}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Status({ status }: { status: string }) {
  if (status === "approved") return <Badge tone="buy">Approved</Badge>;
  if (status === "rejected") return <Badge tone="sell">Rejected</Badge>;
  return <Badge tone="warn">Pending</Badge>;
}
