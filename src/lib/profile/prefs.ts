export type CheckStatus = "unverified" | "pending" | "verified";

export type BankAccount = {
  id: string;
  bankName: string;
  beneficiary: string;
  accountNumber: string;
  ifsc: string;
  primary: boolean;
};

export type UpiHandle = {
  id: string;
  vpa: string;
  primary: boolean;
};

export type ProfilePrefs = {
  phone: string;
  kycId: CheckStatus;
  kycAddress: CheckStatus;
  idKind: "PAN" | "Passport" | "National ID";
  idLast4: string;
  address: string;
  risk: "Retail" | "Professional";
  banks: BankAccount[];
  upis: UpiHandle[];
  usdt: string;
  twoFa: boolean;
  currency: "USD" | "INR";
  theme: "dark" | "light";
  alerts: { trade: boolean; price: boolean; funding: boolean };
};

const EMPTY: ProfilePrefs = {
  phone: "",
  kycId: "unverified",
  kycAddress: "unverified",
  idKind: "PAN",
  idLast4: "",
  address: "",
  risk: "Retail",
  banks: [],
  upis: [],
  usdt: "",
  twoFa: false,
  currency: "USD",
  theme: "light",
  alerts: { trade: true, price: true, funding: true },
};

function key(userId: string) {
  return `sikkaaa.profile.v1:${userId}`;
}

export function loadPrefs(userId: string): ProfilePrefs {
  if (typeof window === "undefined") return structuredClone(EMPTY);
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return structuredClone(EMPTY);
    const parsed = JSON.parse(raw) as Partial<ProfilePrefs>;
    const theme = typeof window !== "undefined" && localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
    return {
      ...structuredClone(EMPTY),
      ...parsed,
      theme,
      alerts: { ...EMPTY.alerts, ...parsed.alerts },
      banks: parsed.banks ?? [],
      upis: parsed.upis ?? [],
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

export function savePrefs(userId: string, prefs: ProfilePrefs) {
  localStorage.setItem(key(userId), JSON.stringify(prefs));
  applyTheme(prefs.theme);
}

const THEME_KEY = "morgan.theme";

export function applyTheme(theme: "dark" | "light") {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("theme-dark", theme === "dark");
  localStorage.setItem(THEME_KEY, theme);
}

export function bootTheme() {
  if (typeof window === "undefined") return;
  applyTheme(localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light");
}

export function maskTail(value: string) {
  const clean = value.replace(/\s/g, "");
  if (clean.length <= 4) return "••••";
  return `XXXX${clean.slice(-4)}`;
}

export function traderTier(equity: number) {
  if (equity >= 25000) return "VIP";
  if (equity >= 5000) return "Pro Trader";
  return "Standard";
}
