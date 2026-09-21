import {
  appendLedger,
  ensureAccount,
  loadDesk,
  mutateDesk,
  requireUser,
} from "@/lib/desk/local-store";
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

export async function loadAccount(): Promise<AccountBook> {
  const user = requireUser();
  const desk = loadDesk();
  return structuredClone(ensureAccount(user.id, desk));
}

export async function listLedger(): Promise<LedgerRow[]> {
  const user = requireUser();
  return [...(loadDesk().ledger[user.id] ?? [])];
}

export async function saveBook(input: { data: AccountBook } | AccountBook) {
  const user = requireUser();
  const book = "data" in input ? input.data : input;
  mutateDesk((desk) => {
    const current = ensureAccount(user.id, desk);
    current.balance = Math.max(0, Math.min(MAX_BALANCE, Number(book.balance) || 0));
    current.pricing = book.pricing === "raw" ? "raw" : "standard";
    current.selected = String(book.selected || "EURUSD").slice(0, 16);
    current.positions = book.positions ?? [];
    current.pending = book.pending ?? [];
    current.history = (book.history ?? []).slice(0, 80);
  });
  const desk = loadDesk();
  return { ok: true as const, status: desk.accounts[user.id]?.status ?? "active" };
}

export function creditLocal(userId: string, amount: number, kind: string, note: string): number {
  let next = 0;
  mutateDesk((desk) => {
    const book = ensureAccount(userId, desk);
    next = Math.max(0, Math.min(MAX_BALANCE, Number((book.balance + amount).toFixed(2))));
    book.balance = next;
    appendLedger(desk, userId, kind, amount, note);
  });
  return next;
}
