import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { AuthSlot } from "@/components/auth/auth-slot";
import { cn } from "@/lib/utils";
import { useOps } from "@/lib/ops/use-ops";

const LINKS = [
  { to: "/markets", label: "Markets" },
  { to: "/pricing", label: "Pricing" },
  { to: "/news", label: "News" },
  { to: "/trade", label: "Web trader" },
];

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 text-fg">
      <span className="relative flex size-8 items-center justify-center rounded-full bg-fg text-bg">
        <span className="font-display text-lg leading-none">S</span>
        <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-buy" />
      </span>
      {!compact && (
        <span className="font-display text-[1.05rem] tracking-[0.22em]">SIKKAAA</span>
      )}
    </Link>
  );
}

export function SiteHeader({ solid = false }: { solid?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const ops = useOps();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border",
        solid ? "bg-bg" : "bg-bg/85 backdrop-blur-md",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "text-sm text-muted transition-colors duration-150 hover:text-fg",
                pathname === l.to && "text-fg",
              )}
            >
              {l.label}
            </Link>
          ))}
          {(ops.isAdmin || ops.canClaim) && (
            <Link
              to="/admin/login"
              className={cn(
                "text-sm text-muted transition-colors duration-150 hover:text-fg",
                pathname.startsWith("/admin") && "text-fg",
              )}
            >
              Admin
            </Link>
          )}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <AuthSlot />
        </div>
        <button
          type="button"
          className="flex size-11 items-center justify-center rounded-sm text-fg md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-border bg-bg px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="flex h-11 items-center text-sm text-fg"
              >
                {l.label}
              </Link>
            ))}
            {(ops.isAdmin || ops.canClaim) && (
              <Link
                to="/admin/login"
                onClick={() => setOpen(false)}
                className="flex h-11 items-center text-sm text-fg"
              >
                Admin
              </Link>
            )}
            <div className="mt-3" onClick={() => setOpen(false)}>
              <AuthSlot />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-bg">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm text-muted">
            See the price. Take the trade. Sikkaaa is a paper desk for global
            markets — forex, gold, crypto, indices and shares. Funding is
            admin-approved paper credit, not a live broker payout.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm">
          <div className="flex flex-col gap-2">
            <p className="text-subtle">Trade</p>
            <Link to="/trade" className="text-muted hover:text-fg">
              Web trader
            </Link>
            <Link to="/account" className="text-muted hover:text-fg">
              Account & deposit
            </Link>
            <Link to="/markets" className="text-muted hover:text-fg">
              Markets
            </Link>
            <Link to="/pricing" className="text-muted hover:text-fg">
              Pricing
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-subtle">Learn</p>
            <Link to="/news" className="text-muted hover:text-fg">
              News & analysis
            </Link>
            <Link to="/login" className="text-muted hover:text-fg">
              Sign in
            </Link>
            <Link to="/admin/login" className="text-muted hover:text-fg">
              Admin desk
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-border px-4 py-5">
        <p className="mx-auto max-w-6xl text-xs leading-relaxed text-subtle">
          Risk warning: CFDs are complex instruments and come with a high risk of
          losing money rapidly due to leverage. This product is a demonstration
          only. Indian residents: offshore retail forex/CFD trading may be
          restricted under FEMA/RBI rules — this demo does not open a broker
          account and does not execute live orders.
        </p>
      </div>
    </footer>
  );
}
