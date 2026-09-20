import { useEffect, useRef, useState } from "react";
import { TIMEFRAMES, market, type Timeframe } from "@/lib/market/engine";
import { getInstrument } from "@/lib/market/instruments";
import { useMarketTick } from "@/lib/market/use-market";
import { cn, formatPrice } from "@/lib/utils";

export function CandleChart({ symbol }: { symbol: string }) {
  useMarketTick();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drawRef = useRef<() => void>(() => {});
  const hoverRef = useRef<{ x: number; y: number; i: number } | null>(null);
  const [tf, setTf] = useState<Timeframe>("15m");
  const [hover, setHover] = useState<{ x: number; y: number; i: number } | null>(
    null,
  );

  const inst = getInstrument(symbol);
  const quote = market.getQuote(symbol);
  const candles = market.getCandles(symbol, tf);

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
      const padT = 16;
      const padB = 22;
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
        ctx.strokeStyle = up ? "#3D9A78" : "#C45B66";
        ctx.fillStyle = up ? "#3D9A78" : "#C45B66";
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
      ctx.fillStyle = "#C5CAD3";
      ctx.fillRect(w - padR + 4, py - 9, 56, 16);
      ctx.fillStyle = "#09090B";
      ctx.fillText(formatPrice(q.mid, inst.digits), w - padR + 8, py + 3);

      const hoverNow = hoverRef.current;
      if (hoverNow && hoverNow.i >= 0 && hoverNow.i < visible.length) {
        const c = visible[hoverNow.i]!;
        const x = padL + hoverNow.i * slot + slot / 2;
        ctx.strokeStyle = "rgba(242,241,237,0.2)";
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, h - padB);
        ctx.moveTo(padL, hoverNow.y);
        ctx.lineTo(w - padR, hoverNow.y);
        ctx.stroke();
        const boxW = 168;
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
  }, [symbol, tf, inst.digits]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="font-display text-lg text-fg">{inst.display}</h2>
            <span className="text-xs text-muted">{inst.name}</span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-3 text-sm num">
            <span className={quote.change >= 0 ? "text-buy" : "text-sell"}>
              {formatPrice(quote.mid, inst.digits)}
            </span>
            <span className={quote.change >= 0 ? "text-buy" : "text-sell"}>
              {quote.change >= 0 ? "+" : ""}
              {quote.changePct.toFixed(2)}%
            </span>
            <span className="text-xs text-subtle">
              Bid {formatPrice(quote.bid, inst.digits)} · Ask{" "}
              {formatPrice(quote.ask, inst.digits)}
            </span>
          </div>
        </div>
        <div className="flex rounded-md bg-bg-subtle p-1">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTf(t.id)}
              className={cn(
                "h-8 min-w-9 rounded-sm px-2 text-[12px] font-medium text-muted",
                tf === t.id && "bg-bg-elevated text-fg",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={wrapRef}
        className="relative min-h-[220px] flex-1"
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
        {hover ? (
          <span className="sr-only">
            Crosshair on candle {hover.i + 1}
          </span>
        ) : null}
      </div>
    </div>
  );
}
