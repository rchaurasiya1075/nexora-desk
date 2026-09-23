import { getAuthMode } from "@/lib/desk/auth-mode";
import * as firebaseApi from "@/lib/firebase/desk";
import * as localApi from "@/lib/ops/local-api";

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
  return api().createDepositRequest(input);
}
export async function listAllDeposits(input?: Parameters<typeof localApi.listAllDeposits>[0]) {
  return api().listAllDeposits(input);
}
export async function reviewDeposit(input: Parameters<typeof localApi.reviewDeposit>[0]) {
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
    for (const user of await firebaseApi.listVisibleTraders()) {
      const sameEmail = [...byId.values()].find(
        (row) => row.email && user.email && row.email.toLowerCase() === user.email.toLowerCase(),
      );
      if (sameEmail && sameEmail.id !== user.id) byId.delete(sameEmail.id);
      const prev = sameEmail && sameEmail.id === user.id ? sameEmail : undefined;
      byId.set(user.id, {
        ...user,
        balance: user.balance || prev?.balance || sameEmail?.balance || 0,
        openPositions: user.openPositions || prev?.openPositions || sameEmail?.openPositions || 0,
        pendingDeposits: user.pendingDeposits || prev?.pendingDeposits || sameEmail?.pendingDeposits || 0,
        role: user.role === "admin" || prev?.role === "admin" || sameEmail?.role === "admin" ? "admin" : "user",
        lastLogin: user.lastLogin || prev?.lastLogin || sameEmail?.lastLogin || null,
      });
    }
  } catch {
    /* Firestore rules still private, or the project has no traders yet */
  }
  return [...byId.values()].sort((a, b) =>
    (b.lastLogin || b.createdAt).localeCompare(a.lastLogin || a.createdAt),
  );
}
export async function adminCredit(input: Parameters<typeof localApi.adminCredit>[0]) {
  return api().adminCredit(input);
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
