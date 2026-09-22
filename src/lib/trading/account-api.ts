import { getAuthMode } from "@/lib/desk/auth-mode";
import type { AccountBook, LedgerRow } from "@/lib/firebase/account-types";
import * as firebaseDesk from "@/lib/firebase/desk";
import * as localDesk from "@/lib/trading/account-local";

export type { AccountBook, LedgerRow };

export async function loadAccount() {
  return getAuthMode() === "local" ? localDesk.loadAccount() : firebaseDesk.loadAccount();
}

export async function listLedger() {
  return getAuthMode() === "local" ? localDesk.listLedger() : firebaseDesk.listLedger();
}

export async function saveBook(
  ...args: Parameters<typeof firebaseDesk.saveBook>
) {
  return getAuthMode() === "local"
    ? localDesk.saveBook(...args)
    : firebaseDesk.saveBook(...args);
}

export async function creditUserBalance(
  ...args: Parameters<typeof firebaseDesk.creditUserBalance>
) {
  if (getAuthMode() === "local") {
    return localDesk.creditLocal(args[0], args[1], args[2], args[3]);
  }
  return firebaseDesk.creditUserBalance(...args);
}

export async function loadOrCreate(userId: string) {
  if (getAuthMode() === "local") return localDesk.loadAccount();
  return firebaseDesk.loadOrCreateAccount(userId);
}
