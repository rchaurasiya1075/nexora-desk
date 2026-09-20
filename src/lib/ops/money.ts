export function toUsd(amount: number, unitsPerUsd: number): number {
  const rate = unitsPerUsd > 0 ? unitsPerUsd : 1;
  return Number((amount / rate).toFixed(2));
}

export function fromUsd(usd: number, unitsPerUsd: number): number {
  const rate = unitsPerUsd > 0 ? unitsPerUsd : 1;
  return Number((usd * rate).toFixed(2));
}

export function currencySymbol(code: string): string {
  const map: Record<string, string> = {
    USD: "$",
    INR: "₹",
    EUR: "€",
    GBP: "£",
    AED: "AED ",
    AUD: "A$",
    CAD: "C$",
    SGD: "S$",
    HKD: "HK$",
    JPY: "¥",
  };
  return map[code] ?? `${code} `;
}

export function formatAmount(n: number, code = "USD", digits = 2): string {
  const abs = Math.abs(n);
  const locale = code === "INR" ? "en-IN" : "en-US";
  const formatted = abs.toLocaleString(locale, {
    minimumFractionDigits: code === "JPY" ? 0 : digits,
    maximumFractionDigits: code === "JPY" ? 0 : digits,
  });
  const sign = n < 0 ? "−" : "";
  return `${sign}${currencySymbol(code)}${formatted}`;
}

export function upiUri(details: {
  vpa?: string;
  payee?: string;
  note?: string;
  amount?: number;
  currency?: string;
}): string {
  const pa = (details.vpa || "").trim();
  const params = new URLSearchParams();
  params.set("pa", pa);
  if (details.payee) params.set("pn", details.payee);
  if (details.currency === "INR" && details.amount && details.amount > 0) {
    params.set("am", details.amount.toFixed(2));
    params.set("cu", "INR");
  }
  if (details.note) params.set("tn", details.note);
  return `upi://pay?${params.toString()}`;
}
