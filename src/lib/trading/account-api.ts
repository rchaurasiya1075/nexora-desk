import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { MAX_BALANCE } from "@/lib/trading/constants";
import type { AccountPricing } from "@/lib/market/engine";
import type { HistoryRow, PendingOrder, Position } from "@/lib/trading/store";

export type AccountBook = {
  balance: number;
  status: "active" | "frozen";
  pricing: AccountPricing;
  selected: string;
  positions: Position[];
  pending: PendingOrder[];
  history: HistoryRow[];
};

export type LedgerRow = {
  id: number;
  kind: string;
  amount: number;
  note: string | null;
  createdAt: string;
};

type AccountRow = {
  user_id: string;
  balance: number | string;
  status: string | null;
  pricing: string;
  selected: string;
  positions_json: string;
  pending_json: string;
  history_json: string;
};

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toBook(row: AccountRow): AccountBook {
  return {
    balance: Number(row.balance) || 0,
    status: row.status === "frozen" ? "frozen" : "active",
    pricing: row.pricing === "raw" ? "raw" : "standard",
    selected: row.selected || "EURUSD",
    positions: parseJson(row.positions_json, []),
    pending: parseJson(row.pending_json, []),
    history: parseJson(row.history_json, []),
  };
}

export async function loadOrCreate(userId: string): Promise<AccountBook> {
  const sql = await getSql();
  const existing = await sql<AccountRow>`
    select user_id, balance, status, pricing, selected, positions_json, pending_json, history_json
    from trading_accounts where user_id = ${userId}
  `;
  if (existing[0]) return toBook(existing[0]);
  await sql`insert into trading_accounts (user_id) values (${userId})`;
  return {
    balance: 0,
    status: "active",
    pricing: "standard",
    selected: "EURUSD",
    positions: [],
    pending: [],
    history: [],
  };
}

export async function creditUserBalance(
  userId: string,
  amount: number,
  kind: string,
  note: string,
): Promise<number> {
  const book = await loadOrCreate(userId);
  const next = Math.max(0, Math.min(MAX_BALANCE, Number((book.balance + amount).toFixed(2))));
  const sql = await getSql();
  await sql`
    update trading_accounts
    set balance = ${next}, updated_at = now()
    where user_id = ${userId}
  `;
  await sql`
    insert into trading_ledger (user_id, kind, amount, note)
    values (${userId}, ${kind}, ${amount}, ${note})
  `;
  return next;
}

export const loadAccount = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => loadOrCreate(context.userId));

export const listLedger = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      kind: string;
      amount: number | string;
      note: string | null;
      created_at: string;
    }>`
      select id, kind, amount, note, created_at
      from trading_ledger
      where user_id = ${context.userId}
      order by id desc
      limit 40
    `;
    return rows.map(
      (r): LedgerRow => ({
        id: Number(r.id),
        kind: r.kind,
        amount: Number(r.amount),
        note: r.note,
        createdAt: r.created_at,
      }),
    );
  });

export const saveBook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((book: AccountBook) => book)
  .handler(async ({ context, data: book }) => {
    const current = await loadOrCreate(context.userId);
    const balance = Math.max(0, Math.min(MAX_BALANCE, Number(book.balance) || 0));
    const pricing = book.pricing === "raw" ? "raw" : "standard";
    const selected = String(book.selected || "EURUSD").slice(0, 16);
    const sql = await getSql();
    await sql`
      update trading_accounts
      set
        balance = ${balance},
        pricing = ${pricing},
        selected = ${selected},
        positions_json = ${JSON.stringify(book.positions ?? [])},
        pending_json = ${JSON.stringify(book.pending ?? [])},
        history_json = ${JSON.stringify((book.history ?? []).slice(0, 80))},
        updated_at = now()
      where user_id = ${context.userId}
    `;
    return { ok: true as const, status: current.status };
  });
