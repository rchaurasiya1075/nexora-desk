import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { ARTICLES } from "@/lib/news";

export const Route = createFileRoute("/news")({ component: NewsPage });

export function NewsPage() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-xs uppercase tracking-[0.18em] text-subtle">News & analysis</p>
        <h1 className="mt-2 font-display text-4xl md:text-5xl">Desk notes</h1>
        <p className="mt-4 text-muted">
          Written against the 19–20 September 2026 tape so the numbers on the
          trader and the numbers in the copy agree.
        </p>
        <div className="mt-12 space-y-14">
          {ARTICLES.map((a) => (
            <article key={a.slug} className="border-t border-border pt-10">
              <p className="text-[11px] uppercase tracking-wide text-subtle">
                {a.kicker} · {a.date}
              </p>
              <h2 className="mt-2 font-display text-3xl">{a.title}</h2>
              <p className="mt-3 text-base text-muted">{a.standfirst}</p>
              <div className="mt-5 space-y-3 text-sm leading-relaxed text-muted">
                {a.body.map((p) => (
                  <p key={p.slice(0, 24)}>{p}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
        <div className="mt-16 flex gap-3">
          <Button asChild>
            <Link to="/trade">Trade from the notes</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/markets">Open prices</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
