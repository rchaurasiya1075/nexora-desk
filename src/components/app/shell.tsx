import { Link, useRouterState } from "@tanstack/react-router";
import { Briefcase, Home, LineChart, User, ArrowLeftRight } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { market } from "@/lib/market/engine";
import { useTradeStore } from "@/lib/trading/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home, center: false, search: undefined, key: "home" },
  { to: "/markets", label: "Markets", icon: LineChart, center: false, search: undefined, key: "markets" },
  { to: "/trade", label: "Trade", icon: ArrowLeftRight, center: true, search: undefined, key: "trade" },
  { to: "/trade", label: "Positions", icon: Briefcase, center: false, search: { view: "positions" as const }, key: "positions" },
  { to: "/account", label: "Profile", icon: User, center: false, search: undefined, key: "profile" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const view = useRouterState({
    select: (s) => (s.location.search as { view?: string }).view,
  });
  const openCount = useTradeStore((s) => s.positions.length);

  useEffect(() => {
    market.start();
    void useTradeStore.getState().hydrateFromServer();
  }, []);

  function active(key: string) {
    if (key === "home") return pathname === "/";
    if (key === "markets") return pathname.startsWith("/markets");
    if (key === "profile") return pathname.startsWith("/account");
    if (key === "positions") return pathname.startsWith("/trade") && view === "positions";
    return pathname.startsWith("/trade") && view !== "positions";
  }

  return (
    <div className="min-h-dvh bg-bg text-fg md:pl-56">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-border bg-bg px-3 py-5 md:flex">
        <Link to="/" className="px-3 text-[1.15rem] font-bold uppercase tracking-[0.14em]">
          SIKKAAA
        </Link>
        <p className="mt-1 px-3 text-[11px] uppercase tracking-[0.16em] text-subtle">Paper trading</p>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const on = active(item.key);
            return (
              <Link
                key={item.key}
                to={item.to}
                search={item.search}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm",
                  on ? "bg-bg-subtle text-fg" : "text-muted hover:text-fg",
                )}
              >
                <Icon className="size-4" />
                {item.label}
                {item.key === "positions" && openCount > 0 && (
                  <span className="ml-auto rounded-full bg-buy px-1.5 text-[11px] text-buy-fg">{openCount}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur md:hidden">
        <span className="text-sm font-bold uppercase tracking-[0.16em]">SIKKAAA</span>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
          Paper
        </span>
      </header>

      <main className="pb-24 md:pb-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur md:hidden">
        <ul className="grid grid-cols-5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const on = active(item.key);
            return (
              <li key={item.key}>
                <Link
                  to={item.to}
                  search={item.search}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[10px]",
                    on ? "text-fg" : "text-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center",
                      item.center && "size-11 -mt-5 rounded-full bg-fg text-bg shadow-lg",
                      item.center && on && "ring-2 ring-buy",
                    )}
                  >
                    <Icon className={item.center ? "size-5" : "size-5"} />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
