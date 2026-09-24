import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Plus } from "lucide-react";
import { DepositDesk } from "@/components/trade/deposit-desk";
import { QrCode } from "@/components/trade/qr-code";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { localChangePassword } from "@/lib/desk/local-store";
import { useDeskSession } from "@/lib/firebase/session";
import { useMarketTick } from "@/lib/market/use-market";
import { listMyDeposits } from "@/lib/ops/api";
import { addSupport, readControl, requestWithdrawal, subscribeControl } from "@/lib/ops/control-store";
import type { DepositRequest } from "@/lib/ops/types";
import {
  loadPrefs,
  maskTail,
  savePrefs,
  traderTier,
  type BankAccount,
  type ProfilePrefs,
  type UpiHandle,
} from "@/lib/profile/prefs";
import { snapshot, useTradeStore } from "@/lib/trading/store";
import { cn, formatMoney, formatSigned } from "@/lib/utils";

type Section = "overview" | "wallet" | "payouts" | "kyc" | "security" | "history" | "support";

const NAV: { id: Section; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "wallet", label: "Wallet" },
  { id: "payouts", label: "Payouts" },
  { id: "kyc", label: "KYC" },
  { id: "security", label: "Security" },
  { id: "history", label: "History" },
  { id: "support", label: "Support" },
];

export function ProfileDesk() {
  useMarketTick();
  const { user, local, resetPassword, signOutDesk } = useDeskSession();
  const balance = useTradeStore((s) => s.balance);
  const positions = useTradeStore((s) => s.positions);
  const history = useTradeStore((s) => s.history);
  const accountStatus = useTradeStore((s) => s.status);
  const hydrateFromServer = useTradeStore((s) => s.hydrateFromServer);
  const [prefs, setPrefs] = useState<ProfilePrefs | null>(null);
  const [section, setSection] = useState<Section>("overview");
  const [money, setMoney] = useState<null | "in" | "out">(null);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [tick, setTick] = useState(0);
  const seen = useRef<Map<number, string>>(new Map());

  useEffect(() => subscribeControl(() => setTick((n) => n + 1)), []);

  useEffect(() => {
    if (!user) return;
    setPrefs(loadPrefs(user.id));
    void hydrateFromServer();
  }, [user, hydrateFromServer]);

  useEffect(() => {
    if (!user) return;
    let stop = false;
    const pull = () => {
      void listMyDeposits()
        .then((rows) => {
          if (stop) return;
          for (const row of rows) {
            const prev = seen.current.get(row.id);
            if (prev && prev !== row.status && prefs?.alerts.funding) {
              toast.message(`Deposit ${row.status}`, {
                description: `${row.methodTitle} · ${formatMoney(row.usdCredit)}`,
              });
            }
            seen.current.set(row.id, row.status);
          }
          setDeposits(rows);
          if (rows.some((row) => row.status === "approved")) void hydrateFromServer();
        })
        .catch(() => undefined);
    };
    pull();
    const timer = setInterval(pull, 8000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [user, hydrateFromServer, prefs?.alerts.funding]);

  if (!user || !prefs) return null;

  const snap = snapshot({ balance, positions });
  const rate = readControl().settings.inrPerUsd || 83.5;
  const show = (usd: number) =>
    prefs.currency === "INR" ? formatMoney(usd * rate, "INR") : formatMoney(usd);
  const restricted = accountStatus === "frozen";
  const kyc =
    prefs.kycId === "verified" && prefs.kycAddress === "verified"
      ? "verified"
      : prefs.kycId === "pending" || prefs.kycAddress === "pending"
        ? "pending"
        : "unverified";
  const withdrawals = readControl().withdrawals.filter((row) => row.userId === user.id);
  const initials = (user.name || user.email || "S")
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  function update(next: ProfilePrefs) {
    setPrefs(next);
    savePrefs(user!.id, next);
  }

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-4">
          {user.image ? (
            <img src={user.image} alt="" className="size-16 rounded-full object-cover" />
          ) : (
            <span className="grid size-16 place-items-center rounded-full bg-fg text-lg font-semibold text-bg">
              {initials}
            </span>
          )}
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-subtle">Trader profile</p>
            <h1 className="mt-1 font-display text-4xl">{user.name || "Trader"}</h1>
            <p className="mt-1 text-sm text-muted">{user.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Status tone={kyc === "verified" ? "buy" : kyc === "pending" ? "muted" : "sell"}>
            {kyc === "verified" ? "KYC verified" : kyc === "pending" ? "KYC pending" : "KYC unverified"}
          </Status>
          <Status tone={restricted ? "sell" : "buy"}>{restricted ? "Restricted" : "Active"}</Status>
          <Status tone="muted">{traderTier(snap.equity)}</Status>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={cn(
              "h-9 shrink-0 rounded-sm px-3 text-sm",
              section === item.id ? "bg-fg text-bg" : "text-muted hover:text-fg",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === "overview" && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <WalletCard
            className="lg:col-span-2"
            equity={show(snap.equity)}
            free={show(Math.max(snap.free, 0))}
            used={show(snap.used)}
            currency={prefs.currency}
            onAdd={() => setMoney("in")}
            onOut={() => setMoney("out")}
          />
          <div className="grid gap-3">
            <Jump title="Wallet & funds" text="Balances, deposits, withdrawals, full history." onClick={() => setSection("wallet")} />
            <Jump title="Account settings" text="Bank, UPI, KYC, password and sessions." onClick={() => setSection("payouts")} />
            <Jump title="Help & support" text="Write the desk, or read the paper-trading terms." onClick={() => setSection("support")} />
          </div>
          <Info label="Email" value={user.email} />
          <Info label="Mobile" value={prefs.phone || "Not added"} />
          <Info label="Risk profile" value={`${prefs.risk} trader`} />
        </div>
      )}

      {section === "wallet" && (
        <div className="mt-6">
          <WalletCard
            equity={show(snap.equity)}
            free={show(Math.max(snap.free, 0))}
            used={show(snap.used)}
            currency={prefs.currency}
            onAdd={() => setMoney("in")}
            onOut={() => setMoney("out")}
          />
          <p className="mt-4 text-sm text-muted">
            Book currency is USD. {prefs.currency === "INR" ? `INR view uses ₹${rate} per dollar.` : "Switch the view under Security."}{" "}
            Open positions: {positions.length}. Floating P/L {formatSigned(snap.floating)}.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => setSection("history")}>
            View full history
          </Button>
        </div>
      )}

      {section === "payouts" && (
        <Payouts prefs={prefs} onChange={update} />
      )}

      {section === "kyc" && <Kyc prefs={prefs} onChange={update} />}

      {section === "security" && (
        <Security
          prefs={prefs}
          email={user.email}
          local={local}
          onChange={update}
          onReset={() => resetPassword(user.email)}
          onSignOut={() => void signOutDesk()}
        />
      )}

      {section === "history" && (
        <History
          deposits={deposits}
          withdrawals={withdrawals}
          trades={history}
          show={show}
        />
      )}

      {section === "support" && <Support userId={user.id} email={user.email} />}

      <Sheet open={money === "in"} onOpenChange={(open) => !open && setMoney(null)}>
        <SheetContent title="Add money" side="right" className="overflow-y-auto">
          <DepositDesk />
        </SheetContent>
      </Sheet>
      <Sheet open={money === "out"} onOpenChange={(open) => !open && setMoney(null)}>
        <SheetContent title="Withdraw" side="right">
          <WithdrawForm
            max={Math.max(snap.free, 0)}
            destination={primaryDestination(prefs)}
            onSubmit={(amount, note) => {
              requestWithdrawal({
                userId: user.id,
                userName: user.name,
                email: user.email,
                amount,
                note: note || primaryDestination(prefs),
              });
              toast.success("Withdrawal requested. An admin has to approve it.");
              setMoney(null);
              setSection("history");
            }}
          />
        </SheetContent>
      </Sheet>
      <p className="sr-only">{tick}</p>
    </div>
  );
}

function WalletCard({
  equity,
  free,
  used,
  currency,
  onAdd,
  onOut,
  className,
}: {
  equity: string;
  free: string;
  used: string;
  currency: "USD" | "INR";
  onAdd: () => void;
  onOut: () => void;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl bg-bg-elevated p-5 shadow-[var(--shadow-border)]", className)}>
      <p className="text-[11px] uppercase tracking-wide text-subtle">Portfolio equity · {currency}</p>
      <p className="mt-1 font-display text-5xl num">{equity}</p>
      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-subtle">Available margin</dt>
          <dd className="mt-1 text-lg num">{free}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-subtle">Used margin</dt>
          <dd className="mt-1 text-lg num">{used}</dd>
        </div>
      </dl>
      <div className="mt-5 flex gap-2">
        <Button onClick={onAdd}>Add money</Button>
        <Button variant="outline" onClick={onOut}>
          Withdraw
        </Button>
      </div>
    </section>
  );
}

function Payouts({ prefs, onChange }: { prefs: ProfilePrefs; onChange: (next: ProfilePrefs) => void }) {
  const [bank, setBank] = useState({ bankName: "", beneficiary: "", accountNumber: "", ifsc: "" });
  const [vpa, setVpa] = useState("");
  const [usdt, setUsdt] = useState(prefs.usdt);

  function addBank() {
    if (bank.accountNumber.replace(/\s/g, "").length < 6 || bank.ifsc.trim().length < 4) {
      toast.error("Enter the account number and IFSC.");
      return;
    }
    const row: BankAccount = {
      id: `b_${Date.now().toString(36)}`,
      bankName: bank.bankName || "Bank",
      beneficiary: bank.beneficiary || "Account holder",
      accountNumber: bank.accountNumber.replace(/\s/g, ""),
      ifsc: bank.ifsc.trim().toUpperCase(),
      primary: prefs.banks.length === 0,
    };
    onChange({ ...prefs, banks: [...prefs.banks, row] });
    setBank({ bankName: "", beneficiary: "", accountNumber: "", ifsc: "" });
  }

  function addUpi() {
    if (!vpa.includes("@")) {
      toast.error("Enter a UPI id like name@upi.");
      return;
    }
    const row: UpiHandle = {
      id: `u_${Date.now().toString(36)}`,
      vpa: vpa.trim().toLowerCase(),
      primary: prefs.upis.length === 0,
    };
    onChange({ ...prefs, upis: [...prefs.upis, row] });
    setVpa("");
  }

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl bg-bg-elevated p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-2xl">Bank accounts</h2>
        <ul className="mt-3 divide-y divide-border">
          {prefs.banks.length === 0 && <li className="py-3 text-sm text-muted">No bank linked.</li>}
          {prefs.banks.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-3 py-3 text-sm">
              <div>
                <p>{row.bankName} · {row.beneficiary}</p>
                <p className="text-muted">{maskTail(row.accountNumber)} · {row.ifsc}</p>
              </div>
              <div className="flex items-center gap-2">
                {row.primary && <Badge>Primary</Badge>}
                <CopyButton label="account" value={row.accountNumber} />
                {!row.primary && (
                  <button
                    type="button"
                    className="text-xs text-muted underline"
                    onClick={() =>
                      onChange({
                        ...prefs,
                        banks: prefs.banks.map((item) => ({ ...item, primary: item.id === row.id })),
                      })
                    }
                  >
                    Make primary
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-2">
          <Input placeholder="Bank name" value={bank.bankName} onChange={(e) => setBank({ ...bank, bankName: e.target.value })} />
          <Input placeholder="Beneficiary name" value={bank.beneficiary} onChange={(e) => setBank({ ...bank, beneficiary: e.target.value })} />
          <Input placeholder="Account number" value={bank.accountNumber} onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })} />
          <Input placeholder="IFSC" value={bank.ifsc} onChange={(e) => setBank({ ...bank, ifsc: e.target.value })} />
          <Button type="button" variant="outline" onClick={addBank}>
            <Plus className="size-4" /> Add bank
          </Button>
        </div>
      </section>
      <section className="rounded-xl bg-bg-elevated p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-2xl">UPI</h2>
        <ul className="mt-3 divide-y divide-border">
          {prefs.upis.length === 0 && <li className="py-3 text-sm text-muted">No UPI saved.</li>}
          {prefs.upis.map((row) => (
            <li key={row.id} className="flex items-center justify-between py-3 text-sm">
              <span>{row.vpa}</span>
              <span className="flex items-center gap-2">
                {row.primary && <Badge>Primary</Badge>}
                <CopyButton label="UPI" value={row.vpa} />
                {!row.primary && (
                  <button
                    type="button"
                    className="text-xs text-muted underline"
                    onClick={() =>
                      onChange({
                        ...prefs,
                        upis: prefs.upis.map((item) => ({ ...item, primary: item.id === row.id })),
                      })
                    }
                  >
                    Make primary
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <Input placeholder="name@upi" value={vpa} onChange={(e) => setVpa(e.target.value)} />
          <Button type="button" variant="outline" onClick={addUpi}>
            Add
          </Button>
        </div>
        <h3 className="mt-6 font-display text-xl">USDT TRC-20</h3>
        <div className="mt-3 flex flex-wrap items-start gap-4">
          <QrCode value={prefs.usdt} size={112} />
          <div className="min-w-0 flex-1">
            <Input placeholder="T..." value={usdt} onChange={(e) => setUsdt(e.target.value.trim())} />
            <div className="mt-2 flex gap-2">
              <Button type="button" variant="outline" onClick={() => onChange({ ...prefs, usdt })}>
                Save wallet
              </Button>
              {prefs.usdt && <CopyButton label="wallet" value={prefs.usdt} />}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Kyc({ prefs, onChange }: { prefs: ProfilePrefs; onChange: (next: ProfilePrefs) => void }) {
  const [last4, setLast4] = useState(prefs.idLast4);
  const [address, setAddress] = useState(prefs.address);
  const [kind, setKind] = useState(prefs.idKind);
  const [phone, setPhone] = useState(prefs.phone);
  const [risk, setRisk] = useState(prefs.risk);

  return (
    <form
      className="mt-6 max-w-xl rounded-xl bg-bg-elevated p-4 shadow-[var(--shadow-border)]"
      onSubmit={(e) => {
        e.preventDefault();
        if (last4.replace(/\D/g, "").length < 4 || address.trim().length < 8) {
          toast.error("Enter the last 4 digits and a full address.");
          return;
        }
        onChange({
          ...prefs,
          phone: phone.trim(),
          idKind: kind,
          idLast4: last4.replace(/\D/g, "").slice(-4),
          address: address.trim(),
          risk,
          kycId: "pending",
          kycAddress: "pending",
        });
        toast.success("KYC submitted. Status stays pending until the desk reviews it.");
      }}
    >
      <h2 className="font-display text-2xl">Verification</h2>
      <p className="mt-2 text-sm text-muted">
        Government ID and address stay masked. This desk does not mark you verified by itself.
      </p>
      <label className="mt-4 block text-xs uppercase tracking-wide text-subtle">Mobile</label>
      <Input className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91" />
      <label className="mt-3 block text-xs uppercase tracking-wide text-subtle">ID type</label>
      <select
        className="mt-1 h-10 w-full rounded-sm border border-border bg-transparent px-3 text-sm"
        value={kind}
        onChange={(e) => setKind(e.target.value as ProfilePrefs["idKind"])}
      >
        <option>PAN</option>
        <option>Passport</option>
        <option>National ID</option>
      </select>
      <p className="mt-3 text-sm">
        ID proof: <strong>{labelStatus(prefs.kycId)}</strong>
        {prefs.idLast4 ? ` · ${prefs.idKind} ${maskTail(prefs.idLast4)}` : ""}
      </p>
      <Input className="mt-2" inputMode="numeric" maxLength={4} placeholder="Last 4 digits" value={last4} onChange={(e) => setLast4(e.target.value)} />
      <p className="mt-3 text-sm">
        Address proof: <strong>{labelStatus(prefs.kycAddress)}</strong>
      </p>
      <textarea
        className="mt-2 h-20 w-full rounded-sm border border-border bg-transparent px-3 py-2 text-sm"
        placeholder="Address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <label className="mt-3 block text-xs uppercase tracking-wide text-subtle">Risk profile</label>
      <select
        className="mt-1 h-10 w-full rounded-sm border border-border bg-transparent px-3 text-sm"
        value={risk}
        onChange={(e) => setRisk(e.target.value as ProfilePrefs["risk"])}
      >
        <option>Retail</option>
        <option>Professional</option>
      </select>
      <Button className="mt-4" type="submit">
        Submit for review
      </Button>
    </form>
  );
}

function Security({
  prefs,
  email,
  local,
  onChange,
  onReset,
  onSignOut,
}: {
  prefs: ProfilePrefs;
  email: string;
  local: boolean;
  onChange: (next: ProfilePrefs) => void;
  onReset: () => Promise<void>;
  onSignOut: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const device = typeof navigator === "undefined" ? "This browser" : navigator.userAgent.slice(0, 72);

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <form
        className="rounded-xl bg-bg-elevated p-4 shadow-[var(--shadow-border)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (local) {
            void localChangePassword(current, next)
              .then(() => {
                setCurrent("");
                setNext("");
                toast.success("Password updated.");
              })
              .catch((err) => toast.error(err instanceof Error ? err.message : "Could not change password."));
            return;
          }
          void onReset()
            .then(() => toast.success("Password reset email sent."))
            .catch((err) => toast.error(err instanceof Error ? err.message : "Reset failed."));
        }}
      >
        <h2 className="font-display text-2xl">Password</h2>
        {local ? (
          <div className="mt-3 grid gap-2">
            <Input type="password" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            <Input type="password" placeholder="New password" value={next} onChange={(e) => setNext(e.target.value)} />
            <Button type="submit" variant="outline">Change password</Button>
          </div>
        ) : (
          <Button className="mt-3" type="submit" variant="outline">
            Email a reset link to {email}
          </Button>
        )}
        <label className="mt-6 flex items-center justify-between gap-3 text-sm">
          <span>2FA preference (saved on this device, not a live SMS OTP)</span>
          <input
            type="checkbox"
            checked={prefs.twoFa}
            onChange={(e) => onChange({ ...prefs, twoFa: e.target.checked })}
          />
        </label>
      </form>
      <section className="rounded-xl bg-bg-elevated p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-2xl">Preferences</h2>
        <label className="mt-3 flex items-center justify-between text-sm">
          Base currency
          <select
            className="h-9 rounded-sm border border-border bg-transparent px-2"
            value={prefs.currency}
            onChange={(e) => onChange({ ...prefs, currency: e.target.value as "USD" | "INR" })}
          >
            <option value="USD">USD</option>
            <option value="INR">INR</option>
          </select>
        </label>
        <label className="mt-3 flex items-center justify-between text-sm">
          Theme
          <select
            className="h-9 rounded-sm border border-border bg-transparent px-2"
            value={prefs.theme}
            onChange={(e) => onChange({ ...prefs, theme: e.target.value as "dark" | "light" })}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
        {(["trade", "price", "funding"] as const).map((key) => (
          <label key={key} className="mt-3 flex items-center justify-between text-sm capitalize">
            {key} alerts
            <input
              type="checkbox"
              checked={prefs.alerts[key]}
              onChange={(e) => onChange({ ...prefs, alerts: { ...prefs.alerts, [key]: e.target.checked } })}
            />
          </label>
        ))}
        <h3 className="mt-6 text-sm text-subtle">This device</h3>
        <p className="mt-1 break-all text-sm text-muted">{device}</p>
        <Button className="mt-3" variant="outline" onClick={onSignOut}>
          Log out
        </Button>
      </section>
    </div>
  );
}

function History({
  deposits,
  withdrawals,
  trades,
  show,
}: {
  deposits: DepositRequest[];
  withdrawals: { id: string; amount: number; note: string; status: string; createdAt: string }[];
  trades: { id: string; symbol: string; side: string; lots: number; entry: number; exit: number; pnl: number; closedAt: number }[];
  show: (usd: number) => string;
}) {
  const activity = useMemo(() => {
    const rows = [
      ...deposits.map((row) => ({
        id: `d${row.id}`,
        at: row.createdAt,
        label: `Deposit · ${row.methodTitle}`,
        detail: row.reference || row.currency,
        amount: show(row.usdCredit),
        status: row.status,
      })),
      ...withdrawals.map((row) => ({
        id: row.id,
        at: row.createdAt,
        label: "Withdrawal",
        detail: row.note,
        amount: show(row.amount),
        status: row.status === "approved" ? "completed" : row.status,
      })),
      ...trades.map((row) => ({
        id: row.id,
        at: new Date(row.closedAt).toISOString(),
        label: `${row.symbol} ${row.side}`,
        detail: `${row.lots} lots · ${row.entry} → ${row.exit}`,
        amount: formatSigned(row.pnl),
        status: row.pnl >= 0 ? "profit" : "loss",
      })),
    ];
    return rows.sort((a, b) => b.at.localeCompare(a.at));
  }, [deposits, withdrawals, trades, show]);

  return (
    <Tabs defaultValue="all" className="mt-6">
      <TabsList>
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="deposits">Deposits</TabsTrigger>
        <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
        <TabsTrigger value="trades">Trades</TabsTrigger>
      </TabsList>
      <TabsContent value="all" className="mt-4">
        <Rows rows={activity} />
      </TabsContent>
      <TabsContent value="deposits" className="mt-4">
        <Rows
          rows={deposits.map((row) => ({
            id: String(row.id),
            at: row.createdAt,
            label: `${row.methodTitle} · ${row.currency} ${row.amount}`,
            detail: `USD ${row.usdCredit.toFixed(2)} · ${row.reference || "no UTR"}`,
            amount: show(row.usdCredit),
            status: row.status,
          }))}
        />
      </TabsContent>
      <TabsContent value="withdrawals" className="mt-4">
        <Rows
          rows={withdrawals.map((row) => ({
            id: row.id,
            at: row.createdAt,
            label: row.note || "Payout",
            detail: row.id,
            amount: show(row.amount),
            status: row.status,
          }))}
        />
      </TabsContent>
      <TabsContent value="trades" className="mt-4">
        <Rows
          rows={trades.map((row) => ({
            id: row.id,
            at: new Date(row.closedAt).toISOString(),
            label: `${row.symbol} · ${row.side}`,
            detail: `${row.lots} · entry ${row.entry} · exit ${row.exit}`,
            amount: formatSigned(row.pnl),
            status: row.pnl >= 0 ? "profit" : "loss",
          }))}
        />
      </TabsContent>
    </Tabs>
  );
}

function Support({ userId, email }: { userId: string; email: string }) {
  const [msg, setMsg] = useState("");
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <form
        className="rounded-xl bg-bg-elevated p-4 shadow-[var(--shadow-border)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!msg.trim()) return;
          addSupport({ userId, email, message: msg.trim() });
          setMsg("");
          toast.success("Message sent to the desk.");
        }}
      >
        <h2 className="font-display text-2xl">Help</h2>
        <p className="mt-2 text-sm text-muted">supportus@sikkaaa.in</p>
        <textarea
          className="mt-3 h-28 w-full rounded-sm border border-border bg-transparent px-3 py-2 text-sm"
          placeholder="What do you need?"
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
        />
        <Button className="mt-3" type="submit" variant="outline">
          Send ticket
        </Button>
      </form>
      <section className="rounded-xl bg-bg-elevated p-4 text-sm text-muted shadow-[var(--shadow-border)]">
        <h2 className="font-display text-2xl text-fg">Terms</h2>
        <p className="mt-3">
          SIKKAAA is a paper desk. Deposits request admin-approved demo USD. Withdrawals do not
          move live bank funds until an operator processes them. Prices can be pinned by the desk.
        </p>
      </section>
    </div>
  );
}

function WithdrawForm({
  max,
  destination,
  onSubmit,
}: {
  max: number;
  destination: string;
  onSubmit: (amount: number, note: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState(destination);
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0) {
          toast.error("Enter an amount.");
          return;
        }
        if (value > max + 0.001) {
          toast.error("Amount is above available margin.");
          return;
        }
        onSubmit(value, note);
      }}
    >
      <p className="text-sm text-muted">Available {formatMoney(max)}. Payout waits for admin approval.</p>
      <Input inputMode="decimal" placeholder="Amount in USD" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Input placeholder="UPI, bank or wallet" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button type="submit">Request withdrawal</Button>
    </form>
  );
}

function Rows({
  rows,
}: {
  rows: { id: string; at: string; label: string; detail: string; amount: string; status: string }[];
}) {
  if (rows.length === 0) return <p className="text-sm text-muted">Nothing here yet.</p>;
  return (
    <ul className="divide-y divide-border rounded-xl bg-bg-elevated shadow-[var(--shadow-border)]">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <div>
            <p>{row.label}</p>
            <p className="text-muted">
              {row.at ? new Date(row.at).toLocaleString() : ""} · {row.detail}
            </p>
          </div>
          <div className="text-right">
            <p className="num">{row.amount}</p>
            <p className={cn("text-xs capitalize", toneClass(row.status))}>{row.status}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex size-8 items-center justify-center rounded-sm text-muted hover:text-fg"
      aria-label={`Copy ${label}`}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setDone(true);
          toast.success(`Copied ${label}`);
          setTimeout(() => setDone(false), 1200);
        });
      }}
    >
      {done ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}

function Status({ children, tone }: { children: string; tone: "buy" | "sell" | "muted" }) {
  return (
    <span
      className={cn(
        "rounded-sm px-2 py-1 text-xs uppercase tracking-wide",
        tone === "buy" && "bg-buy/15 text-buy",
        tone === "sell" && "bg-sell/15 text-sell",
        tone === "muted" && "bg-bg-subtle text-muted",
      )}
    >
      {children}
    </span>
  );
}

function Jump({ title, text, onClick }: { title: string; text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl bg-bg-elevated p-4 text-left shadow-[var(--shadow-border)]"
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-bg-elevated p-4 shadow-[var(--shadow-border)]">
      <p className="text-[11px] uppercase tracking-wide text-subtle">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function primaryDestination(prefs: ProfilePrefs) {
  const upi = prefs.upis.find((row) => row.primary) || prefs.upis[0];
  if (upi) return upi.vpa;
  const bank = prefs.banks.find((row) => row.primary) || prefs.banks[0];
  if (bank) return `${bank.bankName} ${maskTail(bank.accountNumber)}`;
  if (prefs.usdt) return prefs.usdt;
  return "";
}

function labelStatus(status: string) {
  if (status === "verified") return "Verified";
  if (status === "pending") return "Pending";
  return "Unverified";
}

function toneClass(status: string) {
  if (["approved", "completed", "profit", "verified"].includes(status)) return "text-buy";
  if (["rejected", "loss", "cancelled"].includes(status)) return "text-sell";
  return "text-muted";
}
