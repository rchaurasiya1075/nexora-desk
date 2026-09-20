import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "neutral",
  children,
}: {
  className?: string;
  tone?: "neutral" | "buy" | "sell" | "warn";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide",
        tone === "neutral" && "bg-bg-subtle text-muted",
        tone === "buy" && "bg-buy/15 text-buy",
        tone === "sell" && "bg-sell/15 text-sell",
        tone === "warn" && "bg-accent/12 text-accent",
        className,
      )}
    >
      {children}
    </span>
  );
}
