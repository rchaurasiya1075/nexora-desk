import { Link } from "@tanstack/react-router";
import { ARTICLES } from "@/lib/news";

export function NewsDesk() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-elevated">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="text-[12px] font-medium text-fg">News</p>
        <Link to="/news" className="text-[11px] text-muted hover:text-fg">
          All headlines
        </Link>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {ARTICLES.map((a) => (
          <li key={a.slug} className="border-b border-border px-3 py-3">
            <p className="text-[10px] uppercase tracking-wide text-subtle">
              {a.kicker} · {a.date}
            </p>
            <p className="mt-1 text-[13px] leading-snug text-fg">{a.title}</p>
            <p className="mt-1 line-clamp-2 text-[12px] text-muted">{a.standfirst}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
