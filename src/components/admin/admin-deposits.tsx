import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listAllDeposits, reviewDeposit } from "@/lib/ops/api";
import { watchDeposits } from "@/lib/firebase/desk";
import type { DepositRequest } from "@/lib/ops/types";
import { formatAmount } from "@/lib/ops/money";
import { formatMoney } from "@/lib/utils";

export function AdminDeposits({ onChange }: { onChange: () => void }) {
  const [rows, setRows] = useState<DepositRequest[]>([]);
  const [remote, setRemote] = useState<DepositRequest[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [busy, setBusy] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [usd, setUsd] = useState<Record<number, string>>({});
  const [ruleNote, setRuleNote] = useState<string | null>(null);

  async function load() {
    const data = await listAllDeposits({
      data: { status: filter === "all" ? undefined : filter },
    });
    setRows(data);
  }

  useEffect(() => {
    void load().catch(() => undefined);
  }, [filter]);

  useEffect(() => {
    return watchDeposits(
      (list) => {
        setRemote(list);
        setRuleNote(null);
      },
      () => {
        setRuleNote(
          "Firestore deposits are hidden from this login. In Rules, set deposits allow read: if true; and allow update: if true; then Publish.",
        );
      },
    );
  }, []);

  const merged = new Map<string, DepositRequest>();
  for (const row of rows) merged.set(row.docId || String(row.id), row);
  for (const row of remote) merged.set(row.docId || String(row.id), row);
  const visible = [...merged.values()]
    .filter((row) => filter === "all" || row.status === filter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  async function act(row: DepositRequest, action: "approve" | "reject") {
    setBusy(row.id);
    try {
      const override = usd[row.id];
      await reviewDeposit({
        data: {
          id: row.id,
          docId: row.docId,
          action,
          usdCredit: override ? Number(override) : undefined,
          adminNote: notes[row.id],
        },
      });
      toast.success(action === "approve" ? "Credited to user wallet." : "Rejected.");
      await load();
      onChange();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Review failed.";
      toast.error(
        /permission/i.test(text)
          ? "Rules block deposit updates. Set allow update: if true on deposits, then Publish."
          : text,
      );
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
      {ruleNote && <p className="mt-3 text-sm text-sell">{ruleNote}</p>}
      {visible.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No requests in this view.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((row) => (
            <li
              key={row.docId || row.id}
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
                    Ref {row.reference || "—"}
                    {row.note ? ` · ${row.note}` : ""} · {row.docId || row.id}
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
