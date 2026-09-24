import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Crosshair,
  Minus,
  TrendingUp,
} from "lucide-react";
import { TIMEFRAMES, market, type Timeframe } from "@/lib/market/engine";
import { getInstrument } from "@/lib/market/instruments";
import { useMarketTick } from "@/lib/market/use-market";
import { useTradeStore, type Side } from "@/lib/trading/store";
import { cn, formatPrice } from "@/lib/utils";

type Tool = "cross" | "hline" | "trend";

export function CandleChart({
  symbol,
  onTrade,
}: {
  symbol: string;
  onTrade?: (side: Side) => void;
}) {
  useMarketTick();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawRef = useRef<() => void>(() => {});
  const hoverRef = useRef<{ x: number; y: number; i: number } | null>(null);
  const [tf, setTf] = useState<Timeframe>("15m");
  const [macdOn, setMacdOn] = useState(true);
  const [tool, setTool] = useState<Tool>("cross");
  const [hover, setHover] = useState<{ x: number; y: number; i: number } | null>(null);

  const inst = getInstrument(symbol);
  const quote = market.getQuote(symbol);
  const candles = market.getCandles(symbol, tf);
  const oneClick = useTradeStore((s) => s.oneClick);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w < 8 || h < 8) return;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const padL = 8;
      const padR = 64;
      const padT = 8;
      const macdH = macdOn ? Math.max(64, h * 0.22) : 0;
      const padB = 18 + macdH;
      const data = market.getCandles(symbol, tf);
      if (data.length === 0) return;

      const visible = data.slice(-120);
      const highs = visible.map((c) => c.h);
      const lows = visible.map((c) => c.l);
      let min = Math.min(...lows);
      let max = Math.max(...highs);
      const pad = (max - min) * 0.08 || visible[0]!.c * 0.002;
      min -= pad;
      max += pad;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const slot = plotW / visible.length;
      const yOf = (p: number) => padT + ((max - p) / (max - min)) * plotH;

      ctx.strokeStyle = "rgba(242,241,237,0.06)";
      ctx.lineWidth = 1;
      ctx.font = "11px IBM Plex Sans, sans-serif";
      ctx.fillStyle = "#6E6E76";
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const p = min + ((max - min) * i) / steps;
        const y = yOf(p);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillText(formatPrice(p, inst.digits), w - padR + 8, y + 4);
      }

      visible.forEach((c, i) => {
        const x = padL + i * slot + slot / 2;
        const up = c.c >= c.o;
        ctx.strokeStyle = up ? "#2F9E6B" : "#D05660";
        ctx.fillStyle = up ? "#2F9E6B" : "#D05660";
        ctx.beginPath();
        ctx.moveTo(x, yOf(c.h));
        ctx.lineTo(x, yOf(c.l));
        ctx.stroke();
        const y1 = yOf(Math.max(c.o, c.c));
        const y2 = yOf(Math.min(c.o, c.c));
        const bh = Math.max(1, y2 - y1);
        const bw = Math.max(2, slot * 0.62);
        ctx.fillRect(x - bw / 2, y1, bw, bh);
      });

      const q = market.getQuote(symbol);
      const py = yOf(q.mid);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(197,202,211,0.45)";
      ctx.beginPath();
      ctx.moveTo(padL, py);
      ctx.lineTo(w - padR, py);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = q.change >= 0 ? "#2F9E6B" : "#D05660";
      ctx.fillRect(w - padR + 4, py - 9, 56, 16);
      ctx.fillStyle = "#09090B";
      ctx.fillText(formatPrice(q.mid, inst.digits), w - padR + 8, py + 3);

      if (macdOn) {
        const macd = macdOf(visible.map((c) => c.c));
        const macdTop = h - macdH;
        ctx.strokeStyle = "rgba(242,241,237,0.08)";
        ctx.beginPath();
        ctx.moveTo(padL, macdTop);
        ctx.lineTo(w - padR, macdTop);
        ctx.stroke();
        const vals = macd.flatMap((m) => [m.macd, m.signal, m.hist]);
        const mMax = Math.max(0.00001, ...vals.map((v) => Math.abs(v)));
        const my = (v: number) => macdTop + 8 + ((mMax - v) / (mMax * 2)) * (macdH - 16);
        visible.forEach((_, i) => {
          const x = padL + i * slot + slot / 2;
          const hist = macd[i]!.hist;
          ctx.fillStyle = hist >= 0 ? "rgba(47,158,107,0.55)" : "rgba(208,86,96,0.55)";
          const y0 = my(0);
          const y1 = my(hist);
          ctx.fillRect(x - slot * 0.28, Math.min(y0, y1), slot * 0.56, Math.abs(y1 - y0) || 1);
        });
        ctx.beginPath();
        visible.forEach((_, i) => {
          const x = padL + i * slot + slot / 2;
          const y = my(macd[i]!.macd);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = "#C5CAD3";
        ctx.stroke();
        ctx.beginPath();
        visible.forEach((_, i) => {
          const x = padL + i * slot + slot / 2;
          const y = my(macd[i]!.signal);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = "#D05660";
        ctx.stroke();
        ctx.fillStyle = "#6E6E76";
        ctx.fillText("MACD 12,26,9", padL, macdTop + 12);
      }

      const hoverNow = hoverRef.current;
      if (hoverNow && hoverNow.i >= 0 && hoverNow.i < visible.length) {
        const c = visible[hoverNow.i]!;
        const x = padL + hoverNow.i * slot + slot / 2;
        ctx.strokeStyle = "rgba(242,241,237,0.2)";
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, h - 18);
        if (tool === "cross") {
          ctx.moveTo(padL, hoverNow.y);
          ctx.lineTo(w - padR, hoverNow.y);
        }
        ctx.stroke();
        const boxW = 176;
        const boxX = Math.min(Math.max(8, x - boxW / 2), w - boxW - 72);
        ctx.fillStyle = "rgba(18,19,22,0.94)";
        ctx.fillRect(boxX, 8, boxW, 52);
        ctx.strokeStyle = "rgba(242,241,237,0.12)";
        ctx.strokeRect(boxX, 8, boxW, 52);
        ctx.fillStyle = "#F2F1ED";
        ctx.fillText(
          `O ${formatPrice(c.o, inst.digits)}  H ${formatPrice(c.h, inst.digits)}`,
          boxX + 8,
          28,
        );
        ctx.fillText(
          `L ${formatPrice(c.l, inst.digits)}  C ${formatPrice(c.c, inst.digits)}`,
          boxX + 8,
          46,
        );
      }
    };

    drawRef.current = draw;
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    const unsub = market.subscribe(draw);
    return () => {
      ro.disconnect();
      unsub();
    };
  }, [symbol, tf, inst.digits, macdOn, tool]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-2">
        <p className="px-1 text-sm font-medium text-fg">{inst.display}</p>
        <div className="flex rounded-sm bg-bg-subtle p-0.5">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTf(t.id)}
              className={cn(
                "h-7 min-w-8 rounded-sm px-1.5 text-[11px] font-medium text-muted",
                tf === t.id && "bg-bg-elevated text-fg",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setMacdOn((v) => !v)}
          className={cn(
            "hidden h-7 items-center gap-1 rounded-sm px-2 text-[11px] text-muted md:flex",
            macdOn && "bg-bg-subtle text-fg",
          )}
        >
          <BarChart3 className="size-3.5" />
          MACD
        </button>
        <span className="hidden text-[11px] uppercase tracking-wide text-subtle lg:inline">
          MID
        </span>
        <span className="hidden num text-[12px] text-fg lg:inline">
          {formatPrice(quote.mid, inst.digits)}
        </span>
        {quote.live && (
          <span className="hidden text-[10px] uppercase tracking-wide text-buy md:inline">
            Live
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => onTrade?.("sell")}
            className="flex h-8 min-w-20 flex-col items-center justify-center rounded-sm bg-sell px-2 text-sell-fg"
          >
            <span className="text-[9px] leading-none opacity-80">Sell</span>
            <span className="num text-[12px] font-medium leading-tight">
              {formatPrice(quote.bid, inst.digits)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onTrade?.("buy")}
            className="flex h-8 min-w-20 flex-col items-center justify-center rounded-sm bg-buy px-2 text-buy-fg"
          >
            <span className="text-[9px] leading-none opacity-80">Buy</span>
            <span className="num text-[12px] font-medium leading-tight">
              {formatPrice(quote.ask, inst.digits)}
            </span>
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-9 flex-col items-center gap-1 border-r border-border py-2 text-subtle md:flex">
          {(
            [
              ["cross", Crosshair, "Crosshair"],
              ["hline", Minus, "Horizontal"],
              ["trend", TrendingUp, "Trend"],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              onClick={() => setTool(id)}
              className={cn(
                "flex size-7 items-center justify-center rounded-sm",
                tool === id ? "bg-bg-subtle text-fg" : "hover:text-fg",
              )}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>
        <div
          ref={wrapRef}
          className="relative min-h-[180px] flex-1"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const plotW = rect.width - 72;
            const i = Math.min(
              119,
              Math.max(0, Math.floor((x / plotW) * Math.min(120, candles.length))),
            );
            const next = { x, y, i };
            hoverRef.current = next;
            setHover(next);
            drawRef.current();
          }}
          onMouseLeave={() => {
            hoverRef.current = null;
            setHover(null);
            drawRef.current();
          }}
        >
          <canvas ref={canvasRef} className="absolute inset-0 size-full" />
          {hover ? <span className="sr-only">Crosshair on candle {hover.i + 1}</span> : null}
          {oneClick && (
            <span className="pointer-events-none absolute right-2 top-2 text-[10px] uppercase tracking-wide text-subtle">
              1-click
            </span>
          )}
        </div>
      </div>
      <div className="flex h-6 shrink-0 items-center gap-3 border-t border-border px-3 text-[11px] num text-muted">
        <span>
          O {formatPrice(quote.open, inst.digits)}
        </span>
        <span>H {formatPrice(quote.high, inst.digits)}</span>
        <span>L {formatPrice(quote.low, inst.digits)}</span>
        <span className={quote.change >= 0 ? "text-buy" : "text-sell"}>
          C {formatPrice(quote.mid, inst.digits)} {quote.change >= 0 ? "+" : ""}
          {quote.changePct.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

function ema(values: number[], period: number) {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0] ?? 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    prev = i === 0 ? v : v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function macdOf(closes: number[]) {
  const e12 = ema(closes, 12);
  const e26 = ema(closes, 26);
  const macd = e12.map((v, i) => v - e26[i]!);
  const signal = ema(macd, 9);
  return macd.map((v, i) => ({ macd: v, signal: signal[i]!, hist: v - signal[i]! }));
}
