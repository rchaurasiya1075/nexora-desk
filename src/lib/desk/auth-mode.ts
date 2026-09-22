const KEY = "nexora.auth.mode";

export type AuthMode = "firebase" | "local";

export function getAuthMode(): AuthMode {
  if (typeof window === "undefined") return "firebase";
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === "local" || v === "firebase") return v;
  } catch {
    /* ignore */
  }
  return "firebase";
}

export function setAuthMode(mode: AuthMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, mode);
  } catch {
    /* ignore */
  }
}

export function useLocalDesk() {
  return getAuthMode() === "local";
}
