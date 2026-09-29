import { useSyncExternalStore } from "react";
import { formatMoney } from "@/lib/utils";

const KEY = "morgan.display-ccy";
type Ccy = "USD" | "INR";
const listeners = new Set<() => void>();

export function readDisplayCcy(): Ccy {
  if (typeof window === "undefined") return "USD";
  return window.localStorage.getItem(KEY) === "INR" ? "INR" : "USD";
}

export function setDisplayCcy(next: Ccy) {
  window.localStorage.setItem(KEY, next);
  listeners.forEach((fn) => fn());
}

export function inrPerUsd() {
  return 88.42;
}

export function useDisplayCcy() {
  return useSyncExternalStore(
    (onStore) => {
      listeners.add(onStore);
      return () => listeners.delete(onStore);
    },
    readDisplayCcy,
    () => "USD" as Ccy,
  );
}

export function showMoney(usd: number, ccy: Ccy = readDisplayCcy()) {
  if (ccy === "INR") return formatMoney(usd * inrPerUsd(), "INR");
  return formatMoney(usd);
}

export function showFrozen(usd: number, ccy: Ccy = readDisplayCcy(), fx?: number) {
  const rate = fx && fx > 1 ? fx : 88.42;
  const value = ccy === "INR" ? usd * rate : usd;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatMoney(Math.abs(value), ccy === "INR" ? "INR" : "USD")}`;
}

export function showSigned(usd: number, ccy: Ccy = readDisplayCcy()) {
  const value = ccy === "INR" ? usd * inrPerUsd() : usd;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatMoney(Math.abs(value), ccy === "INR" ? "INR" : "USD")}`;
}

export function CurrencyToggle() {
  const ccy = useDisplayCcy();
  return (
    <button
      type="button"
      onClick={() => setDisplayCcy(ccy === "INR" ? "USD" : "INR")}
      className="h-8 rounded-full bg-white/10 px-3 text-[11px] font-medium tracking-wide"
    >
      {ccy === "INR" ? "₹ INR" : "$ USD"}
    </button>
  );
}
