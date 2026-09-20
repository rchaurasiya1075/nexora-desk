export type StaffRole = "admin";

export type MethodKind = "upi" | "qr" | "bank" | "swift";

export type DepositStatus = "pending" | "approved" | "rejected";

export type AccountStatus = "active" | "frozen";

export type CurrencyRow = {
  code: string;
  name: string;
  symbol: string;
  unitsPerUsd: number;
  enabled: boolean;
  sortOrder: number;
};

export type PaymentDetails = {
  vpa?: string;
  payee?: string;
  note?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  ifsc?: string;
  swift?: string;
  iban?: string;
  branch?: string;
  payload?: string;
};

export type PaymentMethod = {
  id: number;
  kind: MethodKind;
  title: string;
  currency: string;
  details: PaymentDetails;
  enabled: boolean;
  sortOrder: number;
};

export type DepositRequest = {
  id: number;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  methodId: number | null;
  methodKind: string;
  methodTitle: string;
  amount: number;
  currency: string;
  usdCredit: number;
  payerName: string;
  reference: string;
  note: string | null;
  status: DepositStatus;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type DeskUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  balance: number;
  status: AccountStatus;
  role: "admin" | "user";
  pendingDeposits: number;
  openPositions: number;
};

export type AdminOverview = {
  users: number;
  pending: number;
  paperAum: number;
  approvedToday: number;
};

export type MeOps = {
  userId: string;
  isAdmin: boolean;
  canClaim: boolean;
  staffCount: number;
};
