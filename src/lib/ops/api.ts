import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { creditUserBalance, loadOrCreate } from "@/lib/trading/account-api";
import { MAX_BALANCE, MAX_REQUEST_USD, MIN_REQUEST_USD } from "@/lib/trading/constants";
import { toUsd } from "@/lib/ops/money";
import type {
  AccountStatus,
  AdminOverview,
  CurrencyRow,
  DepositRequest,
  DepositStatus,
  DeskUser,
  MeOps,
  MethodKind,
  PaymentDetails,
  PaymentMethod,
} from "@/lib/ops/types";

const KINDS = new Set<MethodKind>(["upi", "qr", "bank", "swift"]);

function parseDetails(raw: string): PaymentDetails {
  try {
    return JSON.parse(raw) as PaymentDetails;
  } catch {
    return {};
  }
}

function asMethod(row: {
  id: number;
  kind: string;
  title: string;
  currency: string;
  details_json: string;
  enabled: boolean;
  sort_order: number;
}): PaymentMethod {
  return {
    id: Number(row.id),
    kind: KINDS.has(row.kind as MethodKind) ? (row.kind as MethodKind) : "bank",
    title: row.title,
    currency: row.currency,
    details: parseDetails(row.details_json),
    enabled: Boolean(row.enabled),
    sortOrder: Number(row.sort_order) || 0,
  };
}

function asCurrency(row: {
  code: string;
  name: string;
  symbol: string;
  units_per_usd: number | string;
  enabled: boolean;
  sort_order: number;
}): CurrencyRow {
  return {
    code: row.code,
    name: row.name,
    symbol: row.symbol,
    unitsPerUsd: Number(row.units_per_usd) || 1,
    enabled: Boolean(row.enabled),
    sortOrder: Number(row.sort_order) || 0,
  };
}

function asRequest(row: {
  id: number;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  method_id: number | null;
  method_kind: string;
  method_title: string;
  amount: number | string;
  currency: string;
  usd_credit: number | string;
  payer_name: string;
  reference: string;
  note: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}): DepositRequest {
  const status: DepositStatus =
    row.status === "approved" || row.status === "rejected" ? row.status : "pending";
  return {
    id: Number(row.id),
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    methodId: row.method_id == null ? null : Number(row.method_id),
    methodKind: row.method_kind,
    methodTitle: row.method_title,
    amount: Number(row.amount),
    currency: row.currency,
    usdCredit: Number(row.usd_credit),
    payerName: row.payer_name,
    reference: row.reference,
    note: row.note,
    status,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

async function staffCount(): Promise<number> {
  const sql = await getSql();
  const rows = await sql<{ n: number | string }>`select count(*)::int as n from app_staff`;
  return Number(rows[0]?.n) || 0;
}

async function isAdmin(userId: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ role: string }>`
    select role from app_staff where user_id = ${userId}
  `;
  return rows[0]?.role === "admin";
}

async function assertAdmin(userId: string) {
  if (!(await isAdmin(userId))) {
    throw new Error("Admin only.");
  }
}

export const getMyOps = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<MeOps> => {
    const count = await staffCount();
    return {
      userId: context.userId,
      isAdmin: await isAdmin(context.userId),
      canClaim: count === 0,
      staffCount: count,
    };
  });

export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<MeOps> => {
    const sql = await getSql();
    const count = await staffCount();
    if (count === 0) {
      await sql`insert into app_staff (user_id, role) values (${context.userId}, 'admin')`;
    } else if (!(await isAdmin(context.userId))) {
      throw new Error("An admin already exists.");
    }
    return {
      userId: context.userId,
      isAdmin: true,
      canClaim: false,
      staffCount: Math.max(count, 1),
    };
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AdminOverview> => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    const users = await sql<{ n: number | string }>`select count(*)::int as n from "user"`;
    const pending = await sql<{ n: number | string }>`
      select count(*)::int as n from deposit_requests where status = 'pending'
    `;
    const aum = await sql<{ n: number | string }>`
      select coalesce(sum(balance), 0) as n from trading_accounts
    `;
    const today = await sql<{ n: number | string }>`
      select count(*)::int as n from deposit_requests
      where status = 'approved' and reviewed_at::date = current_date
    `;
    return {
      users: Number(users[0]?.n) || 0,
      pending: Number(pending[0]?.n) || 0,
      paperAum: Number(aum[0]?.n) || 0,
      approvedToday: Number(today[0]?.n) || 0,
    };
  });

export const listCurrencies = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql<{
      code: string;
      name: string;
      symbol: string;
      units_per_usd: number | string;
      enabled: boolean;
      sort_order: number;
    }>`
      select code, name, symbol, units_per_usd, enabled, sort_order
      from app_currencies
      order by sort_order, code
    `;
    return rows.map(asCurrency);
  });

export const listPaymentMethods = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input?: { all?: boolean }) => input ?? {})
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const admin = data.all ? await isAdmin(context.userId) : false;
    const rows = admin
      ? await sql<{
          id: number;
          kind: string;
          title: string;
          currency: string;
          details_json: string;
          enabled: boolean;
          sort_order: number;
        }>`
          select id, kind, title, currency, details_json, enabled, sort_order
          from payment_methods
          order by sort_order, id
        `
      : await sql<{
          id: number;
          kind: string;
          title: string;
          currency: string;
          details_json: string;
          enabled: boolean;
          sort_order: number;
        }>`
          select id, kind, title, currency, details_json, enabled, sort_order
          from payment_methods
          where enabled = true
          order by sort_order, id
        `;
    return rows.map(asMethod);
  });

export const listMyDeposits = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      user_id: string;
      user_name: string | null;
      user_email: string | null;
      method_id: number | null;
      method_kind: string;
      method_title: string;
      amount: number | string;
      currency: string;
      usd_credit: number | string;
      payer_name: string;
      reference: string;
      note: string | null;
      status: string;
      admin_note: string | null;
      created_at: string;
      reviewed_at: string | null;
    }>`
      select
        d.id, d.user_id, u."name" as user_name, u."email" as user_email,
        d.method_id, d.method_kind, d.method_title, d.amount, d.currency, d.usd_credit,
        d.payer_name, d.reference, d.note, d.status, d.admin_note, d.created_at, d.reviewed_at
      from deposit_requests d
      left join "user" u on u."id" = d.user_id
      where d.user_id = ${context.userId}
      order by d.id desc
      limit 40
    `;
    return rows.map(asRequest);
  });

type CreateDepositInput = {
  methodId: number;
  amount: number;
  payerName: string;
  reference: string;
  note?: string;
};

export const createDepositRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: CreateDepositInput) => input)
  .handler(async ({ context, data }) => {
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount.");
    const payerName = String(data.payerName || "").trim().slice(0, 80);
    const reference = String(data.reference || "").trim().slice(0, 80);
    if (payerName.length < 2) throw new Error("Enter the name on the transfer.");
    if (reference.length < 4) throw new Error("Enter UTR / UPI / wire reference.");

    const book = await loadOrCreate(context.userId);
    if (book.status === "frozen") throw new Error("Account is frozen.");

    const sql = await getSql();
    const pending = await sql<{ n: number | string }>`
      select count(*)::int as n from deposit_requests
      where user_id = ${context.userId} and status = 'pending'
    `;
    if (Number(pending[0]?.n) >= 5) throw new Error("You already have 5 pending requests.");

    const methods = await sql<{
      id: number;
      kind: string;
      title: string;
      currency: string;
      details_json: string;
      enabled: boolean;
      sort_order: number;
    }>`
      select id, kind, title, currency, details_json, enabled, sort_order
      from payment_methods where id = ${Number(data.methodId)} and enabled = true
    `;
    const method = methods[0];
    if (!method) throw new Error("That payment method is off.");

    const currencies = await sql<{
      code: string;
      name: string;
      symbol: string;
      units_per_usd: number | string;
      enabled: boolean;
      sort_order: number;
    }>`
      select code, name, symbol, units_per_usd, enabled, sort_order
      from app_currencies where code = ${method.currency} and enabled = true
    `;
    const ccy = currencies[0];
    if (!ccy) throw new Error("Currency is disabled.");

    const usd = toUsd(amount, Number(ccy.units_per_usd));
    if (usd < MIN_REQUEST_USD) throw new Error("Amount is too small.");
    if (usd > MAX_REQUEST_USD) throw new Error("Amount is above the $100,000 request cap.");
    if (book.balance + usd > MAX_BALANCE) throw new Error("This would exceed the wallet cap.");

    const note = String(data.note || "").trim().slice(0, 200) || null;
    const inserted = await sql<{ id: number }>`
      insert into deposit_requests (
        user_id, method_id, method_kind, method_title, amount, currency, usd_credit,
        payer_name, reference, note, status
      )
      values (
        ${context.userId}, ${method.id}, ${method.kind}, ${method.title}, ${amount},
        ${method.currency}, ${usd}, ${payerName}, ${reference}, ${note}, 'pending'
      )
      returning id
    `;
    return { id: Number(inserted[0]?.id), usdCredit: usd };
  });

export const listAllDeposits = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input?: { status?: string }) => input ?? {})
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    const status = data.status === "approved" || data.status === "rejected" || data.status === "pending"
      ? data.status
      : null;
    const rows = status
      ? await sql<{
          id: number;
          user_id: string;
          user_name: string | null;
          user_email: string | null;
          method_id: number | null;
          method_kind: string;
          method_title: string;
          amount: number | string;
          currency: string;
          usd_credit: number | string;
          payer_name: string;
          reference: string;
          note: string | null;
          status: string;
          admin_note: string | null;
          created_at: string;
          reviewed_at: string | null;
        }>`
          select
            d.id, d.user_id, u."name" as user_name, u."email" as user_email,
            d.method_id, d.method_kind, d.method_title, d.amount, d.currency, d.usd_credit,
            d.payer_name, d.reference, d.note, d.status, d.admin_note, d.created_at, d.reviewed_at
          from deposit_requests d
          left join "user" u on u."id" = d.user_id
          where d.status = ${status}
          order by d.id desc
          limit 80
        `
      : await sql<{
          id: number;
          user_id: string;
          user_name: string | null;
          user_email: string | null;
          method_id: number | null;
          method_kind: string;
          method_title: string;
          amount: number | string;
          currency: string;
          usd_credit: number | string;
          payer_name: string;
          reference: string;
          note: string | null;
          status: string;
          admin_note: string | null;
          created_at: string;
          reviewed_at: string | null;
        }>`
          select
            d.id, d.user_id, u."name" as user_name, u."email" as user_email,
            d.method_id, d.method_kind, d.method_title, d.amount, d.currency, d.usd_credit,
            d.payer_name, d.reference, d.note, d.status, d.admin_note, d.created_at, d.reviewed_at
          from deposit_requests d
          left join "user" u on u."id" = d.user_id
          order by case when d.status = 'pending' then 0 else 1 end, d.id desc
          limit 80
        `;
    return rows.map(asRequest);
  });

type ReviewInput = {
  id: number;
  action: "approve" | "reject";
  usdCredit?: number;
  adminNote?: string;
};

export const reviewDeposit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: ReviewInput) => input)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const id = Number(data.id);
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      user_id: string;
      usd_credit: number | string;
      status: string;
      currency: string;
      amount: number | string;
    }>`
      select id, user_id, usd_credit, status, currency, amount
      from deposit_requests where id = ${id}
    `;
    const row = rows[0];
    if (!row) throw new Error("Request not found.");
    if (row.status !== "pending") throw new Error("Already reviewed.");

    const note = String(data.adminNote || "").trim().slice(0, 200) || null;

    if (data.action === "reject") {
      await sql`
        update deposit_requests
        set status = 'rejected', admin_id = ${context.userId}, admin_note = ${note},
            reviewed_at = now()
        where id = ${id}
      `;
      return { ok: true as const, status: "rejected" as const };
    }

    const usd =
      data.usdCredit != null && Number.isFinite(Number(data.usdCredit))
        ? Number(Number(data.usdCredit).toFixed(2))
        : Number(row.usd_credit);
    if (usd < MIN_REQUEST_USD) throw new Error("Credit is too small.");
    if (usd > MAX_REQUEST_USD) throw new Error("Credit is above the request cap.");

    const book = await loadOrCreate(row.user_id);
    if (book.balance + usd > MAX_BALANCE) throw new Error("Wallet cap would be exceeded.");

    await creditUserBalance(
      row.user_id,
      usd,
      "deposit",
      `Approved #${id} · ${row.currency} ${Number(row.amount)}`,
    );
    await sql`
      update deposit_requests
      set status = 'approved', usd_credit = ${usd}, admin_id = ${context.userId},
          admin_note = ${note}, reviewed_at = now()
      where id = ${id}
    `;
    return { ok: true as const, status: "approved" as const, usdCredit: usd };
  });

export const listDeskUsers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      name: string;
      email: string;
      created_at: string;
      balance: number | string | null;
      status: string | null;
      role: string | null;
      pending: number | string;
      positions_json: string | null;
    }>`
      select
        u."id", u."name", u."email", u."createdAt" as created_at,
        a.balance, a.status, s.role,
        (select count(*) from deposit_requests d where d.user_id = u."id" and d.status = 'pending') as pending,
        a.positions_json
      from "user" u
      left join trading_accounts a on a.user_id = u."id"
      left join app_staff s on s.user_id = u."id"
      order by u."createdAt" desc
      limit 200
    `;
    return rows.map((r): DeskUser => {
      let open = 0;
      try {
        const parsed = JSON.parse(r.positions_json || "[]") as unknown[];
        open = Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        open = 0;
      }
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        createdAt: r.created_at,
        balance: Number(r.balance) || 0,
        status: r.status === "frozen" ? "frozen" : "active",
        role: r.role === "admin" ? "admin" : "user",
        pendingDeposits: Number(r.pending) || 0,
        openPositions: open,
      };
    });
  });

type CreditInput = { userId: string; amount: number; note?: string };

export const adminCredit = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: CreditInput) => input)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount === 0) throw new Error("Enter a non-zero amount.");
    if (Math.abs(amount) > MAX_BALANCE) throw new Error("Amount is too large.");
    const target = String(data.userId || "").slice(0, 80);
    if (!target) throw new Error("Missing user.");
    const note = String(data.note || "").trim().slice(0, 200) || "Admin adjustment";
    const next = await creditUserBalance(
      target,
      Number(amount.toFixed(2)),
      amount > 0 ? "credit" : "debit",
      note,
    );
    return { balance: next };
  });

export const setUserFrozen = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string; frozen: boolean }) => input)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const target = String(data.userId || "").slice(0, 80);
    await loadOrCreate(target);
    const status: AccountStatus = data.frozen ? "frozen" : "active";
    const sql = await getSql();
    await sql`
      update trading_accounts set status = ${status}, updated_at = now()
      where user_id = ${target}
    `;
    return { status };
  });

export const setUserAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string; admin: boolean }) => input)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const target = String(data.userId || "").slice(0, 80);
    const sql = await getSql();
    if (data.admin) {
      await sql`
        insert into app_staff (user_id, role) values (${target}, 'admin')
        on conflict (user_id) do update set role = 'admin'
      `;
      return { role: "admin" as const };
    }
    if (target === context.userId) throw new Error("You cannot demote yourself.");
    const admins = await sql<{ n: number | string }>`
      select count(*)::int as n from app_staff where role = 'admin'
    `;
    if (Number(admins[0]?.n) <= 1) throw new Error("Keep at least one admin.");
    await sql`delete from app_staff where user_id = ${target}`;
    return { role: "user" as const };
  });

type SaveCurrencyInput = {
  code: string;
  name: string;
  symbol: string;
  unitsPerUsd: number;
  enabled: boolean;
};

export const saveCurrency = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: SaveCurrencyInput) => input)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const code = String(data.code || "").trim().toUpperCase().slice(0, 8);
    if (!/^[A-Z]{3,8}$/.test(code)) throw new Error("Use a 3–8 letter currency code.");
    const name = String(data.name || "").trim().slice(0, 40) || code;
    const symbol = String(data.symbol || "").trim().slice(0, 8) || code;
    const units = Number(data.unitsPerUsd);
    if (!Number.isFinite(units) || units <= 0) throw new Error("Rate must be greater than 0.");
    const sql = await getSql();
    await sql`
      insert into app_currencies (code, name, symbol, units_per_usd, enabled)
      values (${code}, ${name}, ${symbol}, ${units}, ${Boolean(data.enabled)})
      on conflict (code) do update set
        name = ${name},
        symbol = ${symbol},
        units_per_usd = ${units},
        enabled = ${Boolean(data.enabled)}
    `;
    return { ok: true as const };
  });

type SaveMethodInput = {
  id?: number;
  kind: MethodKind;
  title: string;
  currency: string;
  details: PaymentDetails;
  enabled: boolean;
};

export const savePaymentMethod = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: SaveMethodInput) => input)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    if (!KINDS.has(data.kind)) throw new Error("Unknown method type.");
    const title = String(data.title || "").trim().slice(0, 60);
    if (title.length < 2) throw new Error("Give the method a name.");
    const currency = String(data.currency || "USD").trim().toUpperCase().slice(0, 8);
    const details = JSON.stringify(data.details ?? {});
    const sql = await getSql();
    if (data.id) {
      await sql`
        update payment_methods
        set kind = ${data.kind}, title = ${title}, currency = ${currency},
            details_json = ${details}, enabled = ${Boolean(data.enabled)}
        where id = ${Number(data.id)}
      `;
      return { id: Number(data.id) };
    }
    const inserted = await sql<{ id: number }>`
      insert into payment_methods (kind, title, currency, details_json, enabled)
      values (${data.kind}, ${title}, ${currency}, ${details}, ${Boolean(data.enabled)})
      returning id
    `;
    return { id: Number(inserted[0]?.id) };
  });

export const deletePaymentMethod = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    await sql`delete from payment_methods where id = ${Number(id)}`;
    return { ok: true as const };
  });
