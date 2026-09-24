import { loadDesk } from "@/lib/desk/local-store";
import type { DeskUser } from "@/lib/ops/types";

const BIN = "https://extendsclass.com/api/json-storage/bin/edbaeed";

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

function asUsers(data: unknown): DirectoryUser[] {
  if (!data || typeof data !== "object") return [];
  const rows = (data as { users?: unknown }).users;
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => row && typeof row === "object" && typeof (row as DirectoryUser).id === "string") as DirectoryUser[];
}

async function readBin(): Promise<DirectoryUser[]> {
  const res = await fetch(`${BIN}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Directory read failed (${res.status}).`);
  return asUsers(await res.json());
}

async function writeBin(users: DirectoryUser[]) {
  const res = await fetch(BIN, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ users: users.slice(0, 500) }),
  });
  if (!res.ok) throw new Error(`Directory write failed (${res.status}).`);
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

export async function publishProfiles(rows: DirectoryUser[]) {
  if (!rows.length || typeof window === "undefined") return;
  let error: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const current = await readBin();
      const next = [...current];
      for (const row of rows) {
        const idx = next.findIndex(
          (item) =>
            item.id === row.id ||
            (item.email && row.email && item.email.toLowerCase() === row.email.toLowerCase()),
        );
        if (idx >= 0) {
          next[idx] = {
            ...next[idx],
            ...row,
            createdAt: next[idx].createdAt || row.createdAt,
            balance: row.balance || next[idx].balance,
          };
        } else {
          next.unshift(row);
        }
      }
      next.sort((a, b) => (b.lastLogin || "").localeCompare(a.lastLogin || ""));
      await writeBin(next);
      const check = await readBin();
      const lost = current.some(
        (item) =>
          !check.some(
            (kept) =>
              kept.id === item.id ||
              (kept.email && item.email && kept.email.toLowerCase() === item.email.toLowerCase()),
          ),
      );
      const missing = rows.some(
        (row) =>
          !check.some(
            (item) =>
              item.id === row.id ||
              (item.email && row.email && item.email.toLowerCase() === row.email.toLowerCase()),
          ),
      );
      if (!lost && !missing) {
        lastError = null;
        return;
      }
    } catch (err) {
      error = err;
    }
  }
  lastError = error instanceof Error ? error.message : "Could not publish the sign-in.";
}

export async function fetchDirectory(): Promise<DirectoryUser[]> {
  try {
    const rows = await readBin();
    lastError = null;
    return rows;
  } catch (err) {
    lastError = err instanceof Error ? err.message : "Could not load the user directory.";
    return [];
  }
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
