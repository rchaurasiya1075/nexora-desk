import { Link, useRouterState } from "@tanstack/react-router";
import { Briefcase, Home, LineChart, User, ArrowLeftRight } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { market } from "@/lib/market/engine";
import { settleOptions } from "@/lib/trading/options-book";
import { settleQuick } from "@/lib/trading/quick";
import { useTradeStore } from "@/lib/trading/store";
import { Logo } from "@/components/layout/site-header";
import { CurrencyToggle } from "@/lib/money/display-ccy";
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
    const timer = setInterval(() => {
      settleQuick();
      settleOptions();
    }, 1000);
    return () => clearInterval(timer);
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
        <Logo />
        <p className="mt-1 px-3 text-[11px] tracking-[0.08em] text-subtle">Trade smarter</p>
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
                  on ? "bg-white/10 text-fg" : "text-muted hover:text-fg",
                )}
              >
                <Icon className="size-4" />
                {item.label}
                {item.key === "positions" && openCount > 0 && (
                  <span className="ml-auto rounded-full bg-white/10 px-1.5 text-[11px] text-fg">{openCount}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {pathname !== "/" && (
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur md:hidden">
          <Logo />
          <CurrencyToggle />
        </header>
      )}

      <main className="pb-28 md:pb-8">
        <div key={`${pathname}:${view ?? "trade"}`} className="screen-in">
          {children}
        </div>
      </main>

      <nav className="fixed inset-x-3 bottom-3 z-30 md:hidden">
        <ul className="grid grid-cols-5 rounded-2xl border border-white/10 bg-[#12141a]/92 px-1 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          {NAV.map((item) => {
            const Icon = item.icon;
            const on = active(item.key);
            return (
              <li key={item.key}>
                <Link
                  to={item.to}
                  search={item.search}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] tracking-wide",
                    on ? "bg-white text-[#111214]" : "text-[#8b919c]",
                  )}
                >
                  <Icon className="size-4" />
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
