import { loadDesk } from "@/lib/desk/local-store";
import type { DeskUser } from "@/lib/ops/types";

export type DirectoryUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  lastLogin: string | null;
  balance: number;
  status: "active" | "frozen";
  openPositions: number;
  role: "admin" | "user";
};

let lastError: string | null = null;

export function directoryError() {
  return lastError;
}

export function profileFromDesk(user: {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
  lastLogin?: string | null;
}): DirectoryUser {
  const desk = loadDesk();
  const book = desk.accounts[user.id];
  return {
    id: user.id,
    name: user.name || "Trader",
    email: user.email || "",
    createdAt: user.createdAt || new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    balance: Number(book?.balance) || 0,
    status: book?.status === "frozen" ? "frozen" : "active",
    openPositions: book?.positions?.length ?? 0,
    role: desk.staff.includes(user.id) ? "admin" : "user",
  };
}

export async function publishProfiles(_rows: DirectoryUser[]) {
  return;
}

export async function fetchDirectory(): Promise<DirectoryUser[]> {
  return [];
}

export function toDeskUser(row: DirectoryUser): DeskUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.createdAt,
    lastLogin: row.lastLogin,
    balance: Number(row.balance) || 0,
    status: row.status === "frozen" ? "frozen" : "active",
    role: row.role === "admin" ? "admin" : "user",
    pendingDeposits: 0,
    openPositions: Number(row.openPositions) || 0,
  };
}
