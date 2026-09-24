import { getAuthMode } from "@/lib/desk/auth-mode";
import { getSessionUser, loadDesk } from "@/lib/desk/local-store";
import { addDoc, collection } from "firebase/firestore";
import { db, firebaseAuth } from "@/lib/firebase/client";
import { readerDb } from "@/lib/firebase/reader";
import { builtinCurrencies, builtinMethods } from "@/lib/ops/rails";
import { toUsd } from "@/lib/ops/money";
import { adjustUserBalance, balanceOverride } from "@/lib/ops/balance-adjust";
import { fetchDirectory, profileFromDesk, publishProfiles, toDeskUser } from "@/lib/ops/directory";
import * as firebaseApi from "@/lib/firebase/desk";
import * as localApi from "@/lib/ops/local-api";

let firestoreListError: string | null = null;

export function firestoreDirectoryError() {
  return firestoreListError;
}

function api() {
  return (getAuthMode() === "local" ? localApi : firebaseApi) as typeof localApi;
}

export async function getMyOps() {
  return api().getMyOps();
}
export async function claimAdmin() {
  return api().claimAdmin();
}
export async function getAdminOverview() {
  return api().getAdminOverview();
}
export async function listCurrencies() {
  return api().listCurrencies();
}
export async function listPaymentMethods(input?: Parameters<typeof localApi.listPaymentMethods>[0]) {
  return api().listPaymentMethods(input);
}
export async function listMyDeposits() {
  return api().listMyDeposits();
}
export async function createDepositRequest(
  input: Parameters<typeof localApi.createDepositRequest>[0],
) {
  const method = builtinMethods().find((row) => row.id === Number(input.data.methodId));
  const rate = builtinCurrencies().find((row) => row.code === method?.currency)?.unitsPerUsd ?? 83.5;
  const usd = method ? toUsd(Number(input.data.amount) || 0, rate) : 0;
  let result: { id: number; usdCredit: number } | null = null;
  try {
    result = await api().createDepositRequest(input);
  } catch {
    result = null;
  }
  const person = firebaseAuth.currentUser;
  const local = getSessionUser();
  const userId = person?.uid || local?.id || "";
  if (userId && method) {
    try {
      const database = person ? db : await readerDb();
      const ref = await addDoc(collection(database, "deposits"), {
        userId,
        userName: person?.displayName || local?.name || person?.email || local?.email || "Trader",
        userEmail: person?.email || local?.email || "",
        amountLocal: Number(input.data.amount) || 0,
        amountUSD: result?.usdCredit || usd,
        currencyLocal: method.currency,
        paymentMethod: method.title,
        methodTitle: method.title,
        methodKind: method.kind,
        amount: Number(input.data.amount) || 0,
        currency: method.currency,
        usdCredit: result?.usdCredit || usd,
        payerName: input.data.payerName,
        reference: input.data.reference,
        utrNumber: input.data.reference,
        note: input.data.note || null,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      if (!result) result = { id: stableDepositId(ref.id), usdCredit: usd };
    } catch {
      /* local request still stands when the first call succeeded */
    }
  }
  if (!result) throw new Error("Could not submit the deposit. Sign in and enter the UTR.");
  return result;
}

function stableDepositId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash || 1;
}
export async function listAllDeposits(input?: Parameters<typeof localApi.listAllDeposits>[0]) {
  return api().listAllDeposits(input);
}
export async function reviewDeposit(input: Parameters<typeof localApi.reviewDeposit>[0]) {
  const docId = input.data.docId;
  if (docId && !/^\d+$/.test(docId)) {
    return firebaseApi.syncDepositStatus(docId, input.data.action, input.data.usdCredit);
  }
  return api().reviewDeposit(input);
}
export async function listDeskUsers() {
  const byId = new Map<string, Awaited<ReturnType<typeof localApi.listDeskUsers>>[number]>();
  try {
    for (const user of await localApi.listDeskUsers()) byId.set(user.id, user);
  } catch {
    /* viewer is not the local operator */
  }
  try {
    const desk = loadDesk();
    await publishProfiles(desk.users.map((user) => profileFromDesk(user)));
  } catch {
    /* directory is best-effort */
  }
  try {
    for (const user of await firebaseApi.listFirestoreProfiles()) mergeUser(byId, user);
    firestoreListError = null;
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    firestoreListError = /permission/i.test(text)
      ? "Firestore rules are locked, so Rohit and other saved users cannot be read. Firestore → Rules → replace the file → Publish."
      : text;
  }
  try {
    for (const user of await firebaseApi.listVisibleTraders()) mergeUser(byId, user);
  } catch {
    /* older traders collection may still be denied */
  }
  for (const user of await fetchDirectory()) mergeUser(byId, toDeskUser(user));
  return [...byId.values()].sort((a, b) =>
    (b.lastLogin || b.createdAt).localeCompare(a.lastLogin || a.createdAt),
  );
}

function mergeUser(
  byId: Map<string, Awaited<ReturnType<typeof localApi.listDeskUsers>>[number]>,
  user: Awaited<ReturnType<typeof localApi.listDeskUsers>>[number],
) {
  const sameEmail = [...byId.values()].find(
    (row) => row.email && user.email && row.email.toLowerCase() === user.email.toLowerCase(),
  );
  if (sameEmail && sameEmail.id !== user.id) byId.delete(sameEmail.id);
  const prev = sameEmail;
  byId.set(user.id, {
    ...user,
    name: user.name || prev?.name || "Trader",
    email: user.email || prev?.email || "",
    createdAt: user.createdAt || prev?.createdAt || "",
    balance: balanceOverride(user.id) ?? (user.balance || prev?.balance || 0),
    openPositions: user.openPositions || prev?.openPositions || 0,
    pendingDeposits: user.pendingDeposits || prev?.pendingDeposits || 0,
    role: user.role === "admin" || prev?.role === "admin" ? "admin" : "user",
    lastLogin: user.lastLogin || prev?.lastLogin || null,
    status: user.status === "frozen" || prev?.status === "frozen" ? "frozen" : "active",
  });
}
export async function adminCredit(input: {
  data: { userId: string; amount: number; note?: string; currentBalance?: number };
}) {
  return adjustUserBalance(
    input.data.userId,
    Number(input.data.amount),
    input.data.note || "Admin adjustment",
    input.data.currentBalance ?? 0,
  );
}
export async function setUserFrozen(input: Parameters<typeof localApi.setUserFrozen>[0]) {
  return api().setUserFrozen(input);
}
export async function setUserAdmin(input: Parameters<typeof localApi.setUserAdmin>[0]) {
  return api().setUserAdmin(input);
}
export async function saveCurrency(input: Parameters<typeof localApi.saveCurrency>[0]) {
  return api().saveCurrency(input);
}
export async function savePaymentMethod(input: Parameters<typeof localApi.savePaymentMethod>[0]) {
  return api().savePaymentMethod(input);
}
export async function deletePaymentMethod(
  input: Parameters<typeof localApi.deletePaymentMethod>[0],
) {
  return api().deletePaymentMethod(input);
}
