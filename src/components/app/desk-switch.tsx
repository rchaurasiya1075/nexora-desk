import { Link } from "@tanstack/react-router";

const MODES = [
  { id: "quick", label: "Quick" },
  { id: "swing", label: "Swing" },
  { id: "forex", label: "Forex" },
  { id: "copy", label: "Copy" },
  { id: "options", label: "Options" },
] as const;

export type DeskMode = (typeof MODES)[number]["id"];

export function DeskSwitch({ mode }: { mode: DeskMode }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto px-3 pt-2">
      {MODES.map((item) => (
        <Link
          key={item.id}
          to="/trade"
          search={{ desk: item.id }}
          className={`shrink-0 rounded-full px-3 py-1 text-xs ${mode === item.id ? "bg-white text-[#111214]" : "bg-white/10 text-muted"}`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
