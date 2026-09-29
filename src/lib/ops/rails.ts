import type { CurrencyRow, PaymentMethod } from "@/lib/ops/types";

export function builtinCurrencies(): CurrencyRow[] {
  return [
    { code: "USD", name: "US Dollar", symbol: "$", unitsPerUsd: 1, enabled: true, sortOrder: 0 },
    { code: "INR", name: "Indian Rupee", symbol: "₹", unitsPerUsd: 83.5, enabled: true, sortOrder: 1 },
    { code: "EUR", name: "Euro", symbol: "€", unitsPerUsd: 0.92, enabled: true, sortOrder: 2 },
    { code: "GBP", name: "British Pound", symbol: "£", unitsPerUsd: 0.78, enabled: true, sortOrder: 3 },
  ];
}

export const DESK_BANK = {
  holder: "MORGAN MAX",
  bank: "HDFC Bank",
  number: "50100012345678",
  ifsc: "HDFC0001234",
};

export const DESK_CRYPTO = {
  asset: "USDT",
  network: "TRC-20",
  address: "DESK-USDT-TRC20-MORGAN-MAX",
};

export function builtinMethods(): PaymentMethod[] {
  return [
    {
      id: 1,
      kind: "upi",
      title: "UPI",
      currency: "INR",
      details: { vpa: "sikkaaa@upi", payee: "MORGAN MAX", note: "Morgan Max" },
      enabled: true,
      sortOrder: 0,
    },
    {
      id: 2,
      kind: "qr",
      title: "UPI QR",
      currency: "INR",
      details: { vpa: "sikkaaa@upi", payee: "MORGAN MAX", note: "Scan to pay" },
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
        accountName: "MORGAN MAX",
        accountNumber: "50100012345678",
        ifsc: "HDFC0001234",
        branch: "Mumbai",
      },
      enabled: true,
      sortOrder: 2,
    },
    {
      id: 5,
      kind: "crypto",
      title: "Crypto deposit · USDT",
      currency: "USD",
      details: {
        accountName: DESK_BANK.holder,
        accountNumber: DESK_CRYPTO.address,
        note: `${DESK_CRYPTO.asset} ${DESK_CRYPTO.network} only`,
        payload: DESK_CRYPTO.address,
      },
      enabled: true,
      sortOrder: 4,
    },
  ];
}
