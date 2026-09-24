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
