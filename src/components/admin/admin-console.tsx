import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserButton } from "@/lib/firebase/gates";
import { watchDeposits } from "@/lib/firebase/desk";
import { balanceOverride, rememberBalance } from "@/lib/ops/balance-adjust";
import { useDeskSession } from "@/lib/firebase/session";
import { INSTRUMENTS } from "@/lib/market/instruments";
import { market } from "@/lib/market/engine";
import { useMarketTick } from "@/lib/market/use-market";
import {
  adminCredit,
  listAllDeposits,
  listDeskUsers,
  reviewDeposit,
  setUserAdmin,
  setUserFrozen,
} from "@/lib/ops/api";
import {
  adminCloseTrade,
  adminEditEntry,
  adminOpenTrade,
  audit,
  closeSupport,
  listAllLedger,
  listClosedTrades,
  listOpenTrades,
  nudgePrice,
  readControl,
  releasePrice,
  reviewWithdrawal,
  saveSettings,
  setMarketPaused,
  setMarketPrice,
  subscribeControl,
} from "@/lib/ops/control-store";
import { directoryError } from "@/lib/ops/directory";
import { firestoreDirectoryError } from "@/lib/ops/api";
import type { DepositRequest, DeskUser } from "@/lib/ops/types";
import { formatMoney } from "@/lib/utils";

type Section =
  | "dash"
  | "users"
  | "deposits"
  | "balance"
  | "prices"
  | "create"
  | "open"
  | "closed"
  | "markets"
  | "ledger"
  | "audit"
  | "support"
  | "staff"
  | "settings";

const NAV: { id: Section; label: string }[] = [
  { id: "dash", label: "Dashboard" },
  { id: "users", label: "Users" },
  { id: "deposits", label: "Deposits" },
  { id: "balance", label: "Balance" },
  { id: "prices", label: "Market prices" },
  { id: "create", label: "Create trade" },
  { id: "open", label: "Open trades" },
  { id: "closed", label: "Trade history" },
  { id: "markets", label: "Markets" },
  { id: "ledger", label: "Transactions" },
  { id: "audit", label: "Audit logs" },
  { id: "support", label: "Support" },
  { id: "staff", label: "Admin accounts" },
  { id: "settings", label: "Settings" },
];

export function AdminConsole() {
  useMarketTick();
  const { user, signOutDesk } = useDeskSession();
  const adminName = user?.name || user?.email || "Admin";
  const [section, setSection] = useState<Section>("dash");
  const [users, setUsers] = useState<DeskUser[]>([]);
  const [userNote, setUserNote] = useState<string | null>(null);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [depositNote, setDepositNote] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);

  useEffect(() => subscribeControl(bump), []);

  useEffect(() => {
    return watchDeposits(
      (rows) => {
        setDeposits((prev) => {
          const map = new Map(prev.map((row) => [row.docId || String(row.id), row]));
          for (const row of rows) map.set(row.docId || String(row.id), row);
          return [...map.values()];
        });
        setDepositNote(null);
      },
      () =>
        setDepositNote(
          "Deposits collection is locked for this login. Rules → deposits → allow read: if true; allow update: if true; then Publish.",
        ),
    );
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const live: DeskUser[] = snap.docs.map((row) => {
          const data = row.data();
          const status = String(data.status || "active");
          const remote = Number(data.balance) || 0;
          if (balanceOverride(row.id) == null && remote) rememberBalance(row.id, remote);
          return {
            id: row.id,
            name: String(data.name || "Trader"),
            email: String(data.email || ""),
            createdAt: String(data.createdAt || ""),
            lastLogin: data.lastLogin ? String(data.lastLogin) : null,
            balance: balanceOverride(row.id) ?? remote,
            status: status === "frozen" || status === "suspended" ? "frozen" : "active",
            role: data.role === "admin" ? "admin" : "user",
            pendingDeposits: Number(data.pendingDeposits) || 0,
            openPositions: Number(data.openPositions) || 0,
          };
        });
        setUsers((prev) => {
          const map = new Map(prev.map((user) => [user.id, user]));
          for (const row of live) {
            const older = map.get(row.id);
            map.set(row.id, {
              ...older,
              ...row,
              createdAt: row.createdAt || older?.createdAt || "",
              balance: balanceOverride(row.id) ?? (row.balance || older?.balance || 0),
              lastLogin: row.lastLogin || older?.lastLogin || null,
            });
          }
          return [...map.values()].sort((a, b) =>
            (b.lastLogin || b.createdAt).localeCompare(a.lastLogin || a.createdAt),
          );
        });
        setUserNote(null);
      },
      () => {
        setUserNote("Firestore users could not be loaded. Check that Rules are published.");
      },
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    void listDeskUsers()
      .then((rows) => {
        setUsers((prev) => {
          const map = new Map(prev.map((user) => [user.id, user]));
          for (const row of rows) map.set(row.id, { ...map.get(row.id), ...row });
          return [...map.values()];
        });
        setUserNote(firestoreDirectoryError() || directoryError());
      })
      .catch(() => setUserNote("User list failed to load."));
    void listAllDeposits().then(setDeposits).catch(() => setDeposits([]));
  }, [tick]);

  const control = readControl();
  const open = listOpenTrades();
  const closed = listClosedTrades();
  const ledger = listAllLedger();
  const active = users.filter((u) => u.status === "active").length;
  const suspended = users.filter((u) => u.status !== "active").length;
  const pending = deposits.filter((d) => d.status === "pending");
  const pendingWd = control.withdrawals.filter((w) => w.status === "pending");
  const aum = users.reduce((s, u) => s + u.balance, 0);
  const today = new Date().toISOString().slice(0, 10);
  const todaysTrades = closed.filter((t) => new Date(t.closedAt).toISOString().slice(0, 10) === today).length + open.length;

  return (
    <div className="flex min-h-dvh bg-[#07080a] text-fg">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-white/10 bg-black/40 md:flex">
        <div className="border-b border-white/10 px-4 py-5">
          <p className="text-lg font-bold uppercase tracking-[0.12em]">SIKKAAA</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted">Admin desk</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`rounded-sm px-3 py-2 text-left text-sm ${
                section === item.id ? "bg-white/10 text-fg" : "text-muted hover:bg-white/5 hover:text-fg"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <Link to="/trade" className="border-t border-white/10 px-4 py-3 text-xs text-muted hover:text-fg">
          Customer desk
        </Link>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-white/10 px-4">
          <div className="md:hidden">
            <select
              className="rounded-sm border border-white/15 bg-transparent px-2 py-1 text-sm"
              value={section}
              onChange={(e) => setSection(e.target.value as Section)}
            >
              {NAV.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <p className="hidden text-xs uppercase tracking-[0.18em] text-muted md:block">
            Trade Smarter. Move Faster.
          </p>
          <div className="flex items-center gap-3">
            <UserButton />
            <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => void signOutDesk()}>
              Log out
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto px-4 py-6">
          {section === "dash" && (
            <div>
              <h1 className="font-display text-3xl">Dashboard</h1>
              <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Card k="Total users" v={String(users.length)} />
                <Card k="Active users" v={String(active)} />
                <Card k="Suspended" v={String(suspended)} />
                <Card k="Pending deposits" v={String(pending.length)} />
                <Card k="Pending withdrawals" v={String(pendingWd.length)} />
                <Card k="Open trades" v={String(open.length)} />
                <Card k="Closed trades" v={String(closed.length)} />
                <Card k="Paper balance" v={formatMoney(aum)} />
                <Card k="Today's closes" v={String(todaysTrades)} />
              </div>
              <h2 className="mt-8 text-sm uppercase tracking-wide text-muted">Recent admin actions</h2>
              <LogList rows={control.audit.slice(0, 8)} />
            </div>
          )}

          {section === "users" && (
            <UsersPane users={users} note={userNote} adminName={adminName} onDone={bump} />
          )}
          {section === "deposits" && (
            <DepositsPane
              deposits={deposits}
              withdrawals={control.withdrawals}
              rate={control.settings.inrPerUsd}
              adminName={adminName}
              note={depositNote}
              onDone={bump}
            />
          )}
          {section === "balance" && (
            <BalancePane
              users={users}
              adminName={adminName}
              onDone={bump}
              onApplied={(userId, balance) =>
                setUsers((prev) => prev.map((row) => (row.id === userId ? { ...row, balance } : row)))
              }
            />
          )}
          {section === "prices" && <PricesPane adminName={adminName} log={control.priceLog} />}
          {section === "create" && <CreatePane users={users} adminName={adminName} onDone={bump} />}
          {section === "open" && <OpenPane adminName={adminName} onDone={bump} />}
          {section === "closed" && <ClosedPane />}
          {section === "markets" && <MarketsPane adminName={adminName} pins={control.pins} />}
          {section === "ledger" && <LedgerPane rows={ledger} />}
          {section === "audit" && <AuditPane rows={control.audit} />}
          {section === "support" && (
            <SupportPane notes={control.support} adminName={adminName} />
          )}
          {section === "staff" && <StaffPane users={users} adminName={adminName} onDone={bump} />}
          {section === "settings" && (
            <SettingsPane settings={control.settings} adminName={adminName} />
          )}
        </main>
      </div>
    </div>
  );
}

function Card({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-sm border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted">{k}</p>
      <p className="mt-2 font-display text-2xl">{v}</p>
    </div>
  );
}

function LogList({ rows }: { rows: { at: string; admin: string; action: string; target: string; details: string }[] }) {
  if (!rows.length) return <p className="mt-3 text-sm text-muted">No admin actions yet.</p>;
  return (
    <ul className="mt-3 divide-y divide-white/10 text-sm">
      {rows.map((r) => (
        <li key={r.at + r.action + r.target} className="flex flex-wrap gap-x-3 py-2">
          <span className="text-muted">{new Date(r.at).toLocaleString("en-IN", { hour12: false })}</span>
          <span>{r.admin}</span>
          <span className="text-buy">{r.action}</span>
          <span>{r.target}</span>
          <span className="text-muted">{r.details}</span>
        </li>
      ))}
    </ul>
  );
}

function UsersPane({
  users,
  note,
  adminName,
  onDone,
}: {
  users: DeskUser[];
  note: string | null;
  adminName: string;
  onDone: () => void;
}) {
  const [id, setId] = useState<string | null>(null);
  const user = users.find((u) => u.id === id);
  return (
    <div>
      <h1 className="font-display text-3xl">Users</h1>
      <p className="mt-2 text-sm text-muted">
        {users.length} signed-in account{users.length === 1 ? "" : "s"}. Name, email, id, created, last login, balance, and open trades.
      </p>
      {note && (
        <div className="mt-3 max-w-3xl rounded-sm border border-sell/40 bg-sell/10 p-3 text-sm">
          <p>{note}</p>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-[11px] leading-relaxed text-fg">{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if true;
      allow create, update: if request.auth != null && request.auth.uid == uid;
      allow delete: if false;
    }
    match /user_details/{uid} {
      allow read: if true;
      allow create, update: if request.auth != null && request.auth.uid == uid;
      allow delete: if false;
    }
    match /{path=**}/user_details/{uid} {
      allow read: if true;
      allow create, update: if request.auth != null && request.auth.uid == uid;
      allow delete: if false;
    }
  }
}`}</pre>
        </div>
      )}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="py-2">User</th>
              <th>Email</th>
              <th>User id</th>
              <th>Created</th>
              <th>Last login</th>
              <th>Balance</th>
              <th>Trades</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-white/10">
                <td className="py-2">{u.name}</td>
                <td>{u.email}</td>
                <td className="max-w-[140px] truncate font-mono text-[11px]">{u.id}</td>
                <td>{u.createdAt ? new Date(u.createdAt).toLocaleString("en-IN") : "—"}</td>
                <td>{u.lastLogin ? new Date(u.lastLogin).toLocaleString("en-IN") : "—"}</td>
                <td>{formatMoney(u.balance)}</td>
                <td>{u.openPositions}</td>
                <td>{u.status === "active" ? "Active" : "Suspended"}</td>
                <td>
                  <button type="button" className="text-muted hover:text-fg" onClick={() => setId(u.id)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!users.length && (
          <p className="mt-3 text-sm text-muted">No sign-ins yet. A Gmail login writes the profile Firebase can list.</p>
        )}
      </div>
      {user && (
        <div className="mt-6 max-w-lg rounded-sm border border-white/10 p-4">
          <p className="text-xs uppercase tracking-wide text-muted">User profile</p>
          <h2 className="mt-1 font-display text-2xl">{user.name}</h2>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted">Email</dt>
            <dd>{user.email}</dd>
            <dt className="text-muted">Firebase / desk id</dt>
            <dd className="truncate">{user.id}</dd>
            <dt className="text-muted">Created</dt>
            <dd>{new Date(user.createdAt).toLocaleString("en-IN")}</dd>
            <dt className="text-muted">Last login</dt>
            <dd>{user.lastLogin ? new Date(user.lastLogin).toLocaleString("en-IN") : "—"}</dd>
            <dt className="text-muted">Status</dt>
            <dd>{user.status}</dd>
            <dt className="text-muted">Paper USD</dt>
            <dd>{formatMoney(user.balance)}</dd>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void setUserFrozen({ data: { userId: user.id, frozen: user.status === "active" } })
                  .then(() => {
                    audit(adminName, user.status === "active" ? "SUSPEND" : "ACTIVATE", user.email, user.id);
                    toast.success(user.status === "active" ? "Suspended" : "Active again");
                    onDone();
                  })
                  .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
              }}
            >
              {user.status === "active" ? "Suspend" : "Activate"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setId(null)}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DepositsPane({
  deposits,
  withdrawals,
  rate,
  adminName,
  note,
  onDone,
}: {
  deposits: DepositRequest[];
  withdrawals: ReturnType<typeof readControl>["withdrawals"];
  rate: number;
  adminName: string;
  note: string | null;
  onDone: () => void;
}) {
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "all" | "withdrawals">("pending");
  const rows = tab === "all" ? deposits : tab === "withdrawals" ? [] : deposits.filter((d) => d.status === tab);
  return (
    <div>
      <h1 className="font-display text-3xl">Deposits</h1>
      <p className="mt-2 text-sm text-muted">INR to paper USD uses the settings rate: ₹{rate} = $1.</p>
      {note && <p className="mt-2 text-sm text-sell">{note}</p>}
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {(["pending", "approved", "rejected", "all", "withdrawals"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`rounded-sm border px-3 py-1 ${tab === t ? "border-fg" : "border-white/15 text-muted"}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab !== "withdrawals" && (
        <ul className="mt-4 space-y-3">
          {rows.map((d) => (
            <li key={d.docId || d.id} className="rounded-sm border border-white/10 p-4 text-sm">
              <p>
                {d.userName || d.userId} · {d.userEmail || d.methodTitle}
              </p>
              <p className="mt-1">
                {d.currency} {d.amount} · UTR {d.reference || "—"} · {d.createdAt ? new Date(d.createdAt).toLocaleString("en-IN") : ""}
              </p>
              <p className="text-muted">Paper credit {formatMoney(d.usdCredit)} · {d.status}</p>
              {d.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      const credit = d.usdCredit || 0;
                      void adminCredit({
                        data: {
                          userId: d.userId,
                          amount: credit,
                          note: `Deposit ${d.reference || d.docId || d.id}`,
                          currentBalance: balanceOverride(d.userId) ?? 0,
                        },
                      })
                        .then((res) => {
                          audit(adminName, "DEPOSIT_APPROVE", d.userId, `$${res.balance}`);
                          toast.success(`Wallet ${formatMoney(res.balance)}`);
                          onDone();
                        })
                        .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
                      void reviewDeposit({
                        data: { id: d.id, docId: d.docId, action: "approve", usdCredit: credit },
                      }).catch(() => undefined);
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void reviewDeposit({ data: { id: d.id, docId: d.docId, action: "reject" } })
                        .then(() => {
                          audit(adminName, "DEPOSIT_REJECT", String(d.id), d.userEmail ?? "");
                          onDone();
                        })
                        .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
                    }}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </li>
          ))}
          {!rows.length && <p className="text-sm text-muted">Nothing in this tab.</p>}
        </ul>
      )}
      {tab === "withdrawals" && (
        <ul className="mt-4 space-y-3">
          {withdrawals.map((w) => (
            <li key={w.id} className="rounded-sm border border-white/10 p-4 text-sm">
              <p>
                {w.userName} · {w.email} · {formatMoney(w.amount)} · {w.status}
              </p>
              <p className="text-muted">{w.note}</p>
              {w.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      try {
                        reviewWithdrawal(w.id, "approve", adminName);
                        toast.success("Debited");
                        onDone();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed");
                      }
                    }}
                  >
                    Approve
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { reviewWithdrawal(w.id, "reject", adminName); onDone(); }}>
                    Reject
                  </Button>
                </div>
              )}
            </li>
          ))}
          {!withdrawals.length && <p className="text-sm text-muted">No withdrawal requests.</p>}
        </ul>
      )}
    </div>
  );
}

function BalancePane({
  users,
  adminName,
  onDone,
  onApplied,
}: {
  users: DeskUser[];
  adminName: string;
  onDone: () => void;
  onApplied: (userId: string, balance: number) => void;
}) {
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [amount, setAmount] = useState("100");
  const [reason, setReason] = useState("Deposit approval");
  const [sign, setSign] = useState<1 | -1>(1);
  const user = users.find((u) => u.id === userId);
  return (
    <div className="max-w-md">
      <h1 className="font-display text-3xl">Balance</h1>
      <label className="mt-4 block text-sm">
        User
        <select className="mt-1 w-full rounded-sm border border-white/15 bg-transparent px-2 py-2" value={userId} onChange={(e) => setUserId(e.target.value)}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {formatMoney(u.balance)}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-3 text-sm text-muted">Current {user ? formatMoney(user.balance) : "—"}</p>
      <div className="mt-3 flex gap-2">
        <Button type="button" variant={sign === 1 ? "default" : "outline"} onClick={() => setSign(1)}>
          + Credit
        </Button>
        <Button type="button" variant={sign === -1 ? "default" : "outline"} onClick={() => setSign(-1)}>
          − Debit
        </Button>
      </div>
      <label className="mt-3 block text-sm">
        Amount
        <Input className="mt-1" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label className="mt-3 block text-sm">
        Reason
        <Input className="mt-1" value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <Button
        className="mt-4"
        type="button"
        onClick={() => {
          const n = Number(amount);
          if (!userId || !Number.isFinite(n)) return;
          const before = user?.balance ?? 0;
          void adminCredit({
            data: { userId, amount: sign * n, note: reason, currentBalance: before },
          })
            .then((res) => {
              audit(adminName, sign > 0 ? "CREDIT" : "DEBIT", user?.email ?? userId, `Before ${before} → ${res.balance}. ${reason}`);
              toast.success(
                res.saved
                  ? `After ${formatMoney(res.balance)}`
                  : `After ${formatMoney(res.balance)} on this desk.`,
              );
              onApplied(userId, res.balance);
              onDone();
            })
            .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
        }}
      >
        Confirm
      </Button>
    </div>
  );
}

function PricesPane({
  adminName,
  log,
}: {
  adminName: string;
  log: ReturnType<typeof readControl>["priceLog"];
}) {
  const [symbol, setSymbol] = useState("BTCUSD");
  const [price, setPrice] = useState("");
  const quote = market.getQuote(symbol);
  const inst = INSTRUMENTS.find((i) => i.symbol === symbol)!;
  const steps = [-1000, -500, -100, -10, 10, 100, 500, 1000];
  return (
    <div>
      <h1 className="font-display text-3xl">Market price control</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        A set price is what every signed-in desk on this browser shows, and it is written to Firestore for other sessions when rules allow it.
      </p>
      <label className="mt-4 block max-w-xs text-sm">
        Symbol
        <select className="mt-1 w-full rounded-sm border border-white/15 bg-transparent px-2 py-2" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {INSTRUMENTS.map((i) => (
            <option key={i.symbol} value={i.symbol}>
              {i.display}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-4 text-sm text-muted">Current</p>
      <p className="font-display text-4xl">{quote ? quote.mid.toFixed(inst.digits) : "—"}</p>
      <div className="mt-4 flex max-w-sm gap-2">
        <Input value={price} placeholder="New price" onChange={(e) => setPrice(e.target.value)} />
        <Button
          type="button"
          onClick={() => {
            const n = Number(price);
            if (!Number.isFinite(n) || n <= 0) return;
            setMarketPrice(symbol, n, adminName);
            toast.success(`${inst.display} set`);
          }}
        >
          Set price
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {steps.map((s) => (
          <Button key={s} type="button" variant="outline" onClick={() => nudgePrice(symbol, s, adminName)}>
            {s > 0 ? `+${s}` : s}
          </Button>
        ))}
        <Button type="button" variant="outline" onClick={() => releasePrice(symbol, adminName)}>
          Release to live feed
        </Button>
      </div>
      <h2 className="mt-8 text-sm uppercase tracking-wide text-muted">Price history · {inst.display}</h2>
      <ul className="mt-2 text-sm">
        {log.filter((r) => r.symbol === symbol).slice(0, 12).map((r) => (
          <li key={r.at} className="border-t border-white/10 py-2">
            {new Date(r.at).toLocaleTimeString("en-IN", { hour12: false })} · {r.oldPrice} → {r.newPrice} · {r.by}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CreatePane({
  users,
  adminName,
  onDone,
}: {
  users: DeskUser[];
  adminName: string;
  onDone: () => void;
}) {
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [symbol, setSymbol] = useState("BTCUSD");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState("0.10");
  const [entry, setEntry] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [note, setNote] = useState("");
  const quote = market.getQuote(symbol);
  return (
    <div className="max-w-md">
      <h1 className="font-display text-3xl">Create trade</h1>
      <label className="mt-4 block text-sm">
        User
        <select className="mt-1 w-full rounded-sm border border-white/15 bg-transparent px-2 py-2" value={userId} onChange={(e) => setUserId(e.target.value)}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-sm">
        Symbol
        <select className="mt-1 w-full rounded-sm border border-white/15 bg-transparent px-2 py-2" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {INSTRUMENTS.map((i) => (
            <option key={i.symbol} value={i.symbol}>{i.display}</option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-sm">
        Side
        <select className="mt-1 w-full rounded-sm border border-white/15 bg-transparent px-2 py-2" value={side} onChange={(e) => setSide(e.target.value as "buy" | "sell")}>
          <option value="buy">BUY</option>
          <option value="sell">SELL</option>
        </select>
      </label>
      <label className="mt-3 block text-sm">Quantity<Input className="mt-1" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
      <label className="mt-3 block text-sm">
        Entry price
        <Input className="mt-1" value={entry} placeholder={quote ? String(quote.mid) : ""} onChange={(e) => setEntry(e.target.value)} />
      </label>
      <label className="mt-3 block text-sm">Stop loss<Input className="mt-1" value={sl} onChange={(e) => setSl(e.target.value)} /></label>
      <label className="mt-3 block text-sm">Take profit<Input className="mt-1" value={tp} onChange={(e) => setTp(e.target.value)} /></label>
      <label className="mt-3 block text-sm">Admin note<Input className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <Button
        className="mt-4"
        type="button"
        onClick={() => {
          try {
            const id = adminOpenTrade({
              userId,
              symbol,
              side,
              quantity: Number(qty),
              entry: Number(entry || quote?.mid),
              sl: sl ? Number(sl) : null,
              tp: tp ? Number(tp) : null,
              note,
              by: adminName,
            });
            toast.success(id);
            onDone();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed");
          }
        }}
      >
        Create trade
      </Button>
    </div>
  );
}

function OpenPane({ adminName, onDone }: { adminName: string; onDone: () => void }) {
  const rows = listOpenTrades();
  const [closeId, setCloseId] = useState<string | null>(null);
  const [exit, setExit] = useState("");
  const [reason, setReason] = useState("Manual close");
  const [edit, setEdit] = useState("");
  const row = rows.find((r) => r.id === closeId);
  const live = row ? market.getQuote(row.symbol) : undefined;
  const pnl = useMemo(() => {
    if (!row || !live) return 0;
    const dir = row.side === "buy" ? 1 : -1;
    const inst = INSTRUMENTS.find((i) => i.symbol === row.symbol);
    return (live.mid - row.entry) * dir * (inst?.contractSize ?? 1) * row.lots;
  }, [row, live]);
  return (
    <div>
      <h1 className="font-display text-3xl">Open trades</h1>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-[11px] uppercase text-muted">
            <tr>
              <th className="py-2">Trade</th>
              <th>User</th>
              <th>Symbol</th>
              <th>Side</th>
              <th>Qty</th>
              <th>Entry</th>
              <th>Current</th>
              <th>P/L</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const q = market.getQuote(r.symbol);
              const inst = INSTRUMENTS.find((i) => i.symbol === r.symbol);
              const dir = r.side === "buy" ? 1 : -1;
              const mark = q ? (q.mid - r.entry) * dir * (inst?.contractSize ?? 1) * r.lots : 0;
              return (
                <tr key={r.id} className="border-t border-white/10">
                  <td className="py-2">{r.id}</td>
                  <td>{r.userName}</td>
                  <td>{inst?.display ?? r.symbol}</td>
                  <td>{r.side.toUpperCase()}</td>
                  <td>{r.lots}</td>
                  <td>{r.entry}</td>
                  <td>{q ? q.mid.toFixed(inst?.digits ?? 2) : "—"}</td>
                  <td className={mark >= 0 ? "text-buy" : "text-sell"}>{mark.toFixed(2)}</td>
                  <td>
                    <button type="button" className="text-muted hover:text-fg" onClick={() => { setCloseId(r.id); setExit(q ? String(q.mid) : ""); }}>
                      Close
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <p className="mt-3 text-sm text-muted">No open trades.</p>}
      </div>
      {row && (
        <div className="mt-6 max-w-md rounded-sm border border-white/10 p-4">
          <p className="text-sm">
            {row.id} · {row.symbol} · {row.side.toUpperCase()} · qty {row.lots}
          </p>
          <p className="mt-1 text-sm text-muted">Mark P/L {pnl.toFixed(2)}</p>
          <label className="mt-3 block text-sm">Closing price<Input className="mt-1" value={exit} onChange={(e) => setExit(e.target.value)} /></label>
          <label className="mt-3 block text-sm">Reason<Input className="mt-1" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <Button
            className="mt-3"
            type="button"
            onClick={() => {
              try {
                const result = adminCloseTrade({ userId: row.userId, tradeId: row.id, exit: Number(exit), reason, by: adminName });
                toast.success(`P/L ${result.toFixed(2)}`);
                setCloseId(null);
                onDone();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
              }
            }}
          >
            Confirm close
          </Button>
          <label className="mt-4 block text-sm">Correct entry<Input className="mt-1" value={edit} onChange={(e) => setEdit(e.target.value)} /></label>
          <Button
            className="mt-2"
            type="button"
            variant="outline"
            onClick={() => {
              try {
                adminEditEntry({ userId: row.userId, tradeId: row.id, entry: Number(edit), reason: "Correction", by: adminName });
                toast.success("Entry updated. Audit kept.");
                onDone();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
              }
            }}
          >
            Save entry
          </Button>
        </div>
      )}
    </div>
  );
}

function ClosedPane() {
  const [filter, setFilter] = useState<"all" | "closed">("all");
  const closed = listClosedTrades();
  const open = listOpenTrades();
  return (
    <div>
      <h1 className="font-display text-3xl">Trade history</h1>
      <div className="mt-3 flex gap-2 text-sm">
        <button type="button" className={filter === "all" ? "text-fg" : "text-muted"} onClick={() => setFilter("all")}>All</button>
        <button type="button" className="text-muted" onClick={() => setFilter("closed")}>Closed</button>
      </div>
      <table className="mt-4 w-full min-w-[720px] text-left text-sm">
        <thead className="text-[11px] uppercase text-muted">
          <tr>
            <th>ID</th><th>User</th><th>Symbol</th><th>Side</th><th>Qty</th><th>Entry</th><th>Exit</th><th>P/L</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {filter === "all" && open.map((r) => (
            <tr key={r.id} className="border-t border-white/10">
              <td className="py-2">{r.id}</td><td>{r.userName}</td><td>{r.symbol}</td><td>{r.side}</td><td>{r.lots}</td><td>{r.entry}</td><td>—</td><td>—</td><td>Open</td>
            </tr>
          ))}
          {closed.map((r) => (
            <tr key={r.id + r.closedAt} className="border-t border-white/10">
              <td className="py-2">{r.id}</td><td>{r.userName}</td><td>{r.symbol}</td><td>{r.side}</td><td>{r.lots}</td><td>{r.entry}</td><td>{r.exit}</td><td>{r.pnl.toFixed(2)}</td><td>Closed</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarketsPane({
  adminName,
  pins,
}: {
  adminName: string;
  pins: ReturnType<typeof readControl>["pins"];
}) {
  return (
    <div>
      <h1 className="font-display text-3xl">Markets</h1>
      <table className="mt-4 w-full text-left text-sm">
        <thead className="text-[11px] uppercase text-muted">
          <tr><th className="py-2">Symbol</th><th>Price</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {INSTRUMENTS.map((i) => {
            const q = market.getQuote(i.symbol);
            const paused = pins[i.symbol]?.paused;
            return (
              <tr key={i.symbol} className="border-t border-white/10">
                <td className="py-2">{i.display}</td>
                <td>{q ? q.mid.toFixed(i.digits) : "—"}</td>
                <td>{paused ? "Paused" : market.isPinned(i.symbol) ? "Manual" : "Live"}</td>
                <td className="space-x-3">
                  <button type="button" className="text-muted hover:text-fg" onClick={() => setMarketPaused(i.symbol, !paused, adminName)}>
                    {paused ? "Enable" : "Disable"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LedgerPane({ rows }: { rows: ReturnType<typeof listAllLedger> }) {
  return (
    <div>
      <h1 className="font-display text-3xl">Transactions</h1>
      <table className="mt-4 w-full min-w-[680px] text-left text-sm">
        <thead className="text-[11px] uppercase text-muted">
          <tr><th>ID</th><th>User</th><th>Type</th><th>Amount</th><th>Note</th><th>Time</th></tr>
        </thead>
        <tbody>
          {rows.slice(0, 80).map((r) => (
            <tr key={`${r.userId}-${r.id}`} className="border-t border-white/10">
              <td className="py-2">{r.id}</td>
              <td>{r.userName}</td>
              <td>{r.kind}</td>
              <td>{r.amount.toFixed(2)}</td>
              <td className="max-w-xs truncate">{r.note}</td>
              <td>{new Date(r.createdAt).toLocaleString("en-IN", { hour12: false })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditPane({ rows }: { rows: ReturnType<typeof readControl>["audit"] }) {
  return (
    <div>
      <h1 className="font-display text-3xl">Audit logs</h1>
      <p className="mt-2 text-sm text-muted">These rows are append-only in the desk. There is no delete control.</p>
      <LogList rows={rows} />
    </div>
  );
}

function SupportPane({
  notes,
  adminName,
}: {
  notes: ReturnType<typeof readControl>["support"];
  adminName: string;
}) {
  return (
    <div>
      <h1 className="font-display text-3xl">Support</h1>
      <ul className="mt-4 space-y-3 text-sm">
        {notes.map((n) => (
          <li key={n.id} className="rounded-sm border border-white/10 p-3">
            <p>{n.email}</p>
            <p className="mt-1">{n.message}</p>
            <p className="text-muted">{n.status}</p>
            {n.status === "open" && (
              <Button className="mt-2" type="button" variant="outline" onClick={() => closeSupport(n.id, adminName)}>
                Close
              </Button>
            )}
          </li>
        ))}
        {!notes.length && <p className="text-muted">No tickets. Customers can send one from the account page.</p>}
      </ul>
    </div>
  );
}

function StaffPane({
  users,
  adminName,
  onDone,
}: {
  users: DeskUser[];
  adminName: string;
  onDone: () => void;
}) {
  return (
    <div>
      <h1 className="font-display text-3xl">Admin accounts</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Role lives on the desk staff list, not in the page. Promote a signed-in Gmail user. You cannot remove the last admin.
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between border-t border-white/10 py-2">
            <span>{u.name} · {u.email}</span>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void setUserAdmin({ data: { userId: u.id, admin: u.role !== "admin" } })
                  .then(() => {
                    audit(adminName, u.role === "admin" ? "DEMOTE" : "PROMOTE", u.email, u.id);
                    onDone();
                  })
                  .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
              }}
            >
              {u.role === "admin" ? "Remove admin" : "Make admin"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SettingsPane({
  settings,
  adminName,
}: {
  settings: ReturnType<typeof readControl>["settings"];
  adminName: string;
}) {
  const [inr, setInr] = useState(String(settings.inrPerUsd));
  const [email, setEmail] = useState(settings.supportEmail);
  return (
    <div className="max-w-md">
      <h1 className="font-display text-3xl">Settings</h1>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between"><dt className="text-muted">Site</dt><dd>{settings.siteName}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Slogan</dt><dd>{settings.slogan}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Timezone</dt><dd>{settings.timezone}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Paper trading</dt><dd>{settings.paper ? "ON" : "OFF"}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Manual market</dt><dd>{settings.manualMode ? "ON" : "OFF"}</dd></div>
      </dl>
      <label className="mt-4 block text-sm">
        Support email
        <Input className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="mt-3 block text-sm">
        INR per 1 USD
        <Input className="mt-1" value={inr} onChange={(e) => setInr(e.target.value)} />
      </label>
      <Button
        className="mt-4"
        type="button"
        onClick={() => {
          const n = Number(inr);
          if (!Number.isFinite(n) || n <= 0) return;
          saveSettings({ inrPerUsd: n, supportEmail: email, tradingEnabled: true }, adminName);
          toast.success("Rate saved");
        }}
      >
        Save
      </Button>
    </div>
  );
}
