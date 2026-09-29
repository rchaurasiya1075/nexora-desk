import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Landmark, QrCode as QrIcon, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { QrCode } from "@/components/trade/qr-code";
import {
  createDepositRequest,
  listCurrencies,
  listMyDeposits,
  listPaymentMethods,
} from "@/lib/ops/api";
import { builtinCurrencies, builtinMethods } from "@/lib/ops/rails";
import { EMPTY_PAY, sendUserLine, watchMyThread, watchPayDesk, type ChatLine, type PayDesk } from "@/lib/ops/p2p";
import { useDeskSession } from "@/lib/firebase/session";
import { formatAmount, toUsd, upiUri } from "@/lib/ops/money";
import type { CurrencyRow, DepositRequest, PaymentMethod } from "@/lib/ops/types";
import { useTradeStore } from "@/lib/trading/store";
import { formatMoney } from "@/lib/utils";
import { cn } from "@/lib/utils";

const QUICK: Record<string, number[]> = {
  INR: [1000, 5000, 10000, 25000, 50000, 100000],
  USD: [50, 100, 500, 1000, 2500, 5000],
  EUR: [50, 100, 500, 1000, 2500],
  GBP: [50, 100, 500, 1000],
  AED: [200, 500, 1000, 5000],
};

export function DepositDesk({ compact = false }: { compact?: boolean }) {
  const balance = useTradeStore((s) => s.balance);
  const hydrateFromServer = useTradeStore((s) => s.hydrateFromServer);
  const [currencies, setCurrencies] = useState<CurrencyRow[]>(builtinCurrencies());
  const [methods, setMethods] = useState<PaymentMethod[]>(builtinMethods());
  const [mine, setMine] = useState<DepositRequest[]>([]);
  const [methodId, setMethodId] = useState<number | null>(1);
  const [amount, setAmount] = useState("5000");
  const [payerName, setPayerName] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [pay, setPay] = useState<PayDesk>(EMPTY_PAY);

  async function reload() {
    const [c, m, r] = await Promise.all([
      listCurrencies(),
      listPaymentMethods({ data: {} }),
      listMyDeposits(),
    ]);
    setCurrencies(c.length ? c.filter((x) => x.enabled) : builtinCurrencies());
    setMethods(withCrypto(m.length ? m : builtinMethods()));
    setMine(r);
    setMethodId((id) => (id && m.some((x) => x.id === id) ? id : m[0]?.id ?? null));
    const approved = r.find((row) => row.status === "approved");
    if (approved) void hydrateFromServer();
  }

  useEffect(() => watchPayDesk(setPay), []);

  useEffect(() => {
    void reload().catch(() => {
      setCurrencies(builtinCurrencies());
      setMethods(withCrypto(builtinMethods()));
    });
  }, []);

  useEffect(() => {
    const hasPending = mine.some((r) => r.status === "pending");
    if (!hasPending) return;
    const t = setInterval(() => {
      void listMyDeposits()
        .then((rows) => {
          setMine(rows);
          if (rows.some((r) => r.status === "approved")) void hydrateFromServer();
        })
        .catch(() => undefined);
    }, 8000);
    return () => clearInterval(t);
  }, [mine, hydrateFromServer]);

  const method = methods.find((m) => m.id === methodId) ?? null;
  const ccy = currencies.find((c) => c.code === method?.currency);
  const amt = Number(amount) || 0;
  const usd = ccy ? toUsd(amt, ccy.unitsPerUsd) : 0;
  const payload = useMemo(() => {
    if (!method) return "";
    if (method.details.payload) return method.details.payload;
    if (method.kind === "upi" || method.kind === "qr") {
      return upiUri({
        vpa: method.details.vpa,
        payee: method.details.payee,
        note: method.details.note,
        amount: amt,
        currency: method.currency,
      });
    }
    return "";
  }, [method, amt]);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      toast.success(`Copied ${label}`);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      toast.error("Copy failed");
    }
  }

  async function submit() {
    if (!method) return;
    setBusy(true);
    try {
      const res = await createDepositRequest({
        data: {
          methodId: method.id,
          amount: amt,
          payerName,
          reference,
          note,
        },
      });
      toast.success(`Request in. ${formatMoney(res.usdCredit)} after admin approval.`);
      setReference("");
      setNote("");
      await reload();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Could not submit.";
      toast.error(/permission/i.test(text) ? "Saved on this phone. An admin can still approve it." : text);
      await reload().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "p-4" : "p-6"}>
      {!compact && (
        <>
          <p className="text-xs uppercase tracking-[0.18em] text-subtle">Funding</p>
          <h2 className="mt-2 font-display text-3xl">Request a deposit</h2>
          <p className="mt-2 text-sm text-muted">
            Pick UPI, QR or bank, send the amount, then paste the UTR. An admin
            credits paper USD to this login — not a live broker payout.
          </p>
        </>
      )}
      <p className="text-sm text-muted">
        Cash on account: <span className="num text-fg">{formatMoney(balance)}</span>
      </p>
      <div className="mt-4 rounded-xl bg-bg-subtle p-4 text-sm">
        <p className="text-[11px] uppercase tracking-wide text-subtle">Bank</p>
        <p className="mt-2">Account holder name</p>
        <p className="font-medium">{pay.holder}</p>
        <p className="mt-2">Account number</p>
        <p className="font-medium">{pay.number}</p>
        <p className="mt-1 text-muted">{pay.bank} · {pay.ifsc}</p>
        {pay.upi && <p className="mt-1 text-muted">UPI {pay.upi}</p>}
        <p className="mt-4 text-[11px] uppercase tracking-wide text-subtle">Crypto deposit · {pay.cryptoAsset}</p>
        <p className="mt-2 font-medium break-all">{pay.cryptoAddress}</p>
        <p className="text-muted">{pay.cryptoNetwork} only</p>
      </div>

      <div className="mt-4 grid gap-2">
        {methods.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMethodId(m.id)}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-md px-3 py-3 text-left shadow-[var(--shadow-border)] transition-[box-shadow] duration-150",
              methodId === m.id && "shadow-[var(--shadow-border-hover)] bg-bg-subtle",
            )}
          >
            <MethodIcon kind={m.kind} />
            <span className="flex-1">
              <span className="block text-sm text-fg">{m.title}</span>
              <span className="text-[11px] text-muted">{m.currency} · {m.kind.toUpperCase()}</span>
            </span>
          </button>
        ))}
        {methods.length === 0 && (
          <p className="text-sm text-muted">No payment methods yet. An admin must add rails.</p>
        )}
      </div>

      {method && (
        <>
          <div className="mt-5">
            <label className="text-[11px] uppercase tracking-wide text-subtle">Amount ({method.currency})</label>
            <Input
              className="mt-1"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(QUICK[method.currency] ?? QUICK.USD).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAmount(String(n))}
                  className="h-8 rounded-sm bg-bg-subtle px-2.5 text-[12px] text-muted hover:text-fg"
                >
                  {formatAmount(n, method.currency, 0)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted">
              After approval you receive{" "}
              <span className="text-fg num">{formatMoney(usd)}</span> paper USD
              {ccy ? ` · 1 USD = ${ccy.unitsPerUsd} ${method.currency}` : null}
            </p>
          </div>

          <div className="mt-5 rounded-xl bg-bg-subtle p-4">
            <p className="text-[11px] uppercase tracking-wide text-subtle">Send to</p>
            {(method.kind === "upi" || method.kind === "qr") && payload && (
              <div className="mt-3 flex flex-col items-center gap-3">
                <QrCode value={payload} size={compact ? 160 : 196} />
                <p className="text-center text-[11px] text-muted">Scan with any UPI app</p>
              </div>
            )}
            <dl className="mt-3 space-y-2 text-sm">
              {method.details.vpa && (
                <CopyRow label="UPI ID" value={method.details.vpa} copied={copied} onCopy={copy} />
              )}
              {method.details.payee && (
                <CopyRow label="Payee" value={method.details.payee} copied={copied} onCopy={copy} />
              )}
              {method.details.bankName && (
                <CopyRow label="Bank" value={method.details.bankName} copied={copied} onCopy={copy} />
              )}
              {method.details.accountName && (
                <CopyRow label="Account holder name" value={method.details.accountName} copied={copied} onCopy={copy} />
              )}
              {method.details.accountNumber && (
                <CopyRow
                  label={method.kind === "crypto" ? "Crypto address" : "Account number"}
                  value={method.details.accountNumber}
                  copied={copied}
                  onCopy={copy}
                />
              )}
              {method.details.ifsc && (
                <CopyRow label="IFSC" value={method.details.ifsc} copied={copied} onCopy={copy} />
              )}
              {method.details.swift && (
                <CopyRow label="SWIFT" value={method.details.swift} copied={copied} onCopy={copy} />
              )}
              {method.details.iban && (
                <CopyRow label="IBAN" value={method.details.iban} copied={copied} onCopy={copy} />
              )}
              {method.details.branch && (
                <CopyRow label="Branch" value={method.details.branch} copied={copied} onCopy={copy} />
              )}
            </dl>
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-subtle">Payer name</label>
              <Input className="mt-1" value={payerName} onChange={(e) => setPayerName(e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-subtle">UTR / UPI / wire ref</label>
              <Input className="mt-1" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-subtle">Note (optional)</label>
              <Input className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button className="w-full" disabled={busy || !method} onClick={() => void submit()}>
              {busy ? "Submitting…" : "Submit for admin approval"}
            </Button>
          </div>
        </>
      )}

      <section className="mt-8">
        <h3 className="font-display text-xl">Your requests</h3>
        {mine.length === 0 ? (
          <p className="mt-2 text-sm text-muted">None yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl bg-bg-subtle">
            {mine.map((row) => (
              <li key={row.id} className="px-3 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-fg">
                    {formatAmount(row.amount, row.currency)} → {formatMoney(row.usdCredit)}
                  </span>
                  <StatusBadge status={row.status} />
                </div>
                <p className="mt-1 text-[12px] text-muted">
                  {row.methodTitle} · {row.reference}
                  {row.adminNote ? ` · ${row.adminNote}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <P2pChat />
      <p className="mt-4 text-[12px] text-subtle">
        Paper desk only. Admin approval credits a demo wallet. This is not a
        licensed forex deposit, UPI collection app, or FEMA-compliant broker.
      </p>
    </div>
  );
}

function MethodIcon({ kind }: { kind: string }) {
  const cls = "size-4 text-muted";
  if (kind === "upi") return <Smartphone className={cls} />;
  if (kind === "qr") return <QrIcon className={cls} />;
  if (kind === "crypto") return <span className="text-xs text-muted">₮</span>;
  return <Landmark className={cls} />;
}

function withCrypto(rows: PaymentMethod[]) {
  if (rows.some((row) => row.kind === "crypto")) return rows;
  return [...rows, ...builtinMethods().filter((row) => row.kind === "crypto")];
}

function P2pChat() {
  const { user } = useDeskSession();
  const [text, setText] = useState("");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [pay, setPay] = useState<PayDesk>(EMPTY_PAY);

  useEffect(() => watchPayDesk(setPay), []);
  useEffect(() => watchMyThread(setLines), []);

  async function send() {
    const msg = text.trim();
    if (!msg || !user) return;
    setText("");
    try {
      await sendUserLine({ name: user.name, email: user.email, userId: user.id, text: msg });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Message was not sent.");
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-border p-4">
      <p className="text-[11px] uppercase tracking-wide text-subtle">P2P</p>
      <h3 className="mt-1 text-lg font-medium">Chat with P2P agent</h3>
      <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
        {lines.length === 0 && (
          <p className="text-sm text-muted">
            Pay {pay.holder}, account {pay.number}. Crypto {pay.cryptoAsset} {pay.cryptoNetwork}: {pay.cryptoAddress}. Then send the UTR here. The admin sees this chat.
          </p>
        )}
        {lines.map((line) => (
          <p key={line.id || line.text} className={`rounded-xl px-3 py-2 text-sm ${line.from === "user" ? "bg-white/10" : "bg-bg-subtle text-muted"}`}>
            <span className="block text-[10px] uppercase tracking-wide">{line.from === "user" ? "You" : "Admin"}</span>
            {line.text}
          </p>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Input value={text} placeholder="Message the admin" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void send(); }} />
        <Button type="button" variant="outline" onClick={() => void send()}>Send</Button>
      </div>
    </section>
  );
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: string | null;
  onCopy: (label: string, value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1">
        <span className="truncate num text-fg">{value}</span>
        <button
          type="button"
          className="flex size-9 items-center justify-center text-muted hover:text-fg"
          onClick={() => onCopy(label, value)}
          aria-label={`Copy ${label}`}
        >
          {copied === label ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge tone="buy">Approved</Badge>;
  if (status === "rejected") return <Badge tone="sell">Rejected</Badge>;
  return <Badge tone="warn">Pending</Badge>;
}
