import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  deletePaymentMethod,
  listCurrencies,
  listPaymentMethods,
  saveCurrency,
  savePaymentMethod,
} from "@/lib/ops/api";
import type { CurrencyRow, MethodKind, PaymentDetails, PaymentMethod } from "@/lib/ops/types";

const EMPTY: PaymentDetails = {
  vpa: "",
  payee: "",
  note: "",
  bankName: "",
  accountName: "",
  accountNumber: "",
  ifsc: "",
  swift: "",
  iban: "",
  branch: "",
};

export function AdminRails() {
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);

  async function load() {
    const [c, m] = await Promise.all([
      listCurrencies(),
      listPaymentMethods({ data: { all: true } }),
    ]);
    setCurrencies(c);
    setMethods(m);
  }

  useEffect(() => {
    void load().catch(() => toast.error("Could not load rails."));
  }, []);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
      <section>
        <h2 className="font-display text-2xl">Currencies</h2>
        <p className="mt-1 text-sm text-muted">Units per 1 USD. Used to credit paper dollars.</p>
        <ul className="mt-4 space-y-2">
          {currencies.map((c) => (
            <CurrencyRowEditor key={c.code} row={c} onSaved={() => void load()} />
          ))}
        </ul>
        <NewCurrency onSaved={() => void load()} />
      </section>
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">Payment methods</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setEditing({
                id: 0,
                kind: "upi",
                title: "New UPI",
                currency: "INR",
                details: { ...EMPTY },
                enabled: true,
                sortOrder: 0,
              })
            }
          >
            Add rail
          </Button>
        </div>
        <ul className="mt-4 space-y-2">
          {methods.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-bg-elevated px-4 py-3 shadow-[var(--shadow-border)]"
            >
              <div>
                <p className="text-sm text-fg">{m.title}</p>
                <p className="text-[12px] text-muted">
                  {m.kind.toUpperCase()} · {m.currency}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {m.enabled ? <Badge tone="buy">On</Badge> : <Badge>Off</Badge>}
                <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {editing && (
          <MethodEditor
            method={editing}
            currencies={currencies}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              void load();
            }}
          />
        )}
      </section>
    </div>
  );
}

function CurrencyRowEditor({ row, onSaved }: { row: CurrencyRow; onSaved: () => void }) {
  const [units, setUnits] = useState(String(row.unitsPerUsd));
  const [enabled, setEnabled] = useState(row.enabled);

  useEffect(() => {
    setUnits(String(row.unitsPerUsd));
    setEnabled(row.enabled);
  }, [row]);

  async function save() {
    try {
      await saveCurrency({
        data: {
          code: row.code,
          name: row.name,
          symbol: row.symbol,
          unitsPerUsd: Number(units),
          enabled,
        },
      });
      toast.success(`${row.code} saved`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    }
  }

  return (
    <li className="grid grid-cols-[72px_1fr_auto_auto] items-center gap-2 rounded-xl bg-bg-elevated px-3 py-2 shadow-[var(--shadow-border)]">
      <span className="text-sm text-fg">{row.code}</span>
      <Input value={units} onChange={(e) => setUnits(e.target.value)} />
      <button
        type="button"
        className="text-[12px] text-muted hover:text-fg"
        onClick={() => setEnabled((v) => !v)}
      >
        {enabled ? "On" : "Off"}
      </button>
      <Button size="sm" variant="ghost" onClick={() => void save()}>
        Save
      </Button>
    </li>
  );
}

function NewCurrency({ onSaved }: { onSaved: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [units, setUnits] = useState("1");

  async function add() {
    try {
      await saveCurrency({
        data: {
          code,
          name: name || code,
          symbol: code,
          unitsPerUsd: Number(units),
          enabled: true,
        },
      });
      setCode("");
      setName("");
      setUnits("1");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add currency.");
    }
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Input placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value)} />
      <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="Per USD" value={units} onChange={(e) => setUnits(e.target.value)} />
      <Button variant="outline" onClick={() => void add()}>
        Add
      </Button>
    </div>
  );
}

function MethodEditor({
  method,
  currencies,
  onClose,
  onSaved,
}: {
  method: PaymentMethod;
  currencies: CurrencyRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(method.title);
  const [kind, setKind] = useState<MethodKind>(method.kind);
  const [currency, setCurrency] = useState(method.currency);
  const [enabled, setEnabled] = useState(method.enabled);
  const [details, setDetails] = useState<PaymentDetails>({ ...EMPTY, ...method.details });
  const [busy, setBusy] = useState(false);

  function set<K extends keyof PaymentDetails>(key: K, value: string) {
    setDetails((d) => ({ ...d, [key]: value }));
  }

  async function save() {
    setBusy(true);
    try {
      await savePaymentMethod({
        data: {
          id: method.id || undefined,
          kind,
          title,
          currency,
          details,
          enabled,
        },
      });
      toast.success("Rail saved");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!method.id) return;
    setBusy(true);
    try {
      await deletePaymentMethod({ data: method.id });
      toast.success("Rail removed");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl bg-bg-elevated p-4 shadow-[var(--shadow-border)]">
      <h3 className="font-display text-xl">{method.id ? "Edit rail" : "New rail"}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Title" value={title} onChange={setTitle} />
        <div>
          <label className="text-[11px] uppercase tracking-wide text-subtle">Type</label>
          <select
            className="mt-1 h-11 w-full rounded-sm bg-bg-subtle px-3 text-sm text-fg shadow-[var(--shadow-border)]"
            value={kind}
            onChange={(e) => setKind(e.target.value as MethodKind)}
          >
            <option value="upi">UPI</option>
            <option value="qr">QR</option>
            <option value="bank">Bank</option>
            <option value="swift">SWIFT / wire</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-subtle">Currency</label>
          <select
            className="mt-1 h-11 w-full rounded-sm bg-bg-subtle px-3 text-sm text-fg shadow-[var(--shadow-border)]"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="self-end h-11 text-sm text-muted hover:text-fg"
          onClick={() => setEnabled((v) => !v)}
        >
          {enabled ? "Enabled" : "Disabled"}
        </button>
        <Field label="UPI ID / VPA" value={details.vpa ?? ""} onChange={(v) => set("vpa", v)} />
        <Field label="Payee name" value={details.payee ?? ""} onChange={(v) => set("payee", v)} />
        <Field label="Bank" value={details.bankName ?? ""} onChange={(v) => set("bankName", v)} />
        <Field label="Account name" value={details.accountName ?? ""} onChange={(v) => set("accountName", v)} />
        <Field label="Account number" value={details.accountNumber ?? ""} onChange={(v) => set("accountNumber", v)} />
        <Field label="IFSC" value={details.ifsc ?? ""} onChange={(v) => set("ifsc", v)} />
        <Field label="SWIFT" value={details.swift ?? ""} onChange={(v) => set("swift", v)} />
        <Field label="IBAN" value={details.iban ?? ""} onChange={(v) => set("iban", v)} />
        <Field label="Branch" value={details.branch ?? ""} onChange={(v) => set("branch", v)} />
        <Field label="Note" value={details.note ?? ""} onChange={(v) => set("note", v)} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void save()}>
          Save rail
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {method.id > 0 && (
          <Button variant="sell" disabled={busy} onClick={() => void remove()}>
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wide text-subtle">{label}</label>
      <Input className="mt-1" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
