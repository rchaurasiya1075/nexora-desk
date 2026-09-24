import type { CurrencyRow, PaymentMethod } from "@/lib/ops/types";

export function builtinCurrencies(): CurrencyRow[] {
  return [
    { code: "USD", name: "US Dollar", symbol: "$", unitsPerUsd: 1, enabled: true, sortOrder: 0 },
    { code: "INR", name: "Indian Rupee", symbol: "₹", unitsPerUsd: 83.5, enabled: true, sortOrder: 1 },
    { code: "EUR", name: "Euro", symbol: "€", unitsPerUsd: 0.92, enabled: true, sortOrder: 2 },
    { code: "GBP", name: "British Pound", symbol: "£", unitsPerUsd: 0.78, enabled: true, sortOrder: 3 },
  ];
}

export function builtinMethods(): PaymentMethod[] {
  return [
    {
      id: 1,
      kind: "upi",
      title: "UPI",
      currency: "INR",
      details: { vpa: "sikkaaa@upi", payee: "SIKKAAA", note: "Sikkaaa desk" },
      enabled: true,
      sortOrder: 0,
    },
    {
      id: 2,
      kind: "qr",
      title: "UPI QR",
      currency: "INR",
      details: { vpa: "sikkaaa@upi", payee: "SIKKAAA", note: "Scan to pay" },
      enabled: true,
      sortOrder: 1,
    },
    {
      id: 3,
      kind: "bank",
      title: "Bank transfer",
      currency: "INR",
      details: {
        bankName: "HDFC Bank",
        accountName: "SIKKAAA",
        accountNumber: "50100012345678",
        ifsc: "HDFC0001234",
        branch: "Mumbai",
      },
      enabled: true,
      sortOrder: 2,
    },
  ];
}
