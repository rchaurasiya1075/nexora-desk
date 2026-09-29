import { useEffect, useRef } from "react";
import { market } from "@/lib/market/engine";
import { getInstrument } from "@/lib/market/instruments";
import { formatPrice } from "@/lib/utils";

type Point = { t: number; p: number };
const trails = new Map<string, Point[]>();

function seed(symbol: string) {
  const now = Date.now();
  const candles = market.getCandles(symbol, "1m").slice(-25);
  const quote = market.getQuote(symbol);
  const points: Point[] = [];
  for (const candle of candles) {
    points.push({ t: candle.t, p: candle.o });
    points.push({ t: candle.t + 20_000, p: candle.h });
    points.push({ t: candle.t + 40_000, p: candle.l });
    points.push({ t: candle.t + 55_000, p: candle.c });
  }
  if (quote) points.push({ t: now, p: quote.mid });
  trails.set(symbol, points.filter((point) => now - point.t < 180_000));
}

export function QuickLiveChart({
  symbol,
  entry,
  openedAt,
  expiry,
}: {
  symbol: string;
  entry?: number | null;
  openedAt?: number | null;
  expiry?: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    if (!trails.has(symbol)) seed(symbol);
    let shown = market.getQuote(symbol)?.mid ?? entry ?? 0;
    let frame = 0;

    const draw = () => {
      const quote = market.getQuote(symbol);
      if (!quote) {
        frame = requestAnimationFrame(draw);
        return;
      }
      shown += (quote.mid - shown) * 0.28;
      const now = Date.now();
      const trail = trails.get(symbol) ?? [];
      const last = trail[trail.length - 1];
      if (!last || now - last.t > 160) trail.push({ t: now, p: shown });
      else last.p = shown;
      const kept = trail.filter((point) => now - point.t < 180_000);
      trails.set(symbol, kept);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w < 8 || h < 8) {
        frame = requestAnimationFrame(draw);
        return;
      }
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0c1424";
      ctx.fillRect(0, 0, w, h);

      const inst = getInstrument(symbol);
      const future = Math.max(28_000, expiry ? expiry - now + 12_000 : 28_000);
      const t0 = now - 62_000;
      const t1 = now + future;
      const visible = kept.filter((point) => point.t >= t0 - 1000);
      const marks = visible.map((point) => point.p);
      marks.push(quote.mid, shown);
      if (entry && entry > 0) marks.push(entry);
      let min = Math.min(...marks);
      let max = Math.max(...marks);
      const span = Math.max(max - min, quote.mid * 0.00035, inst.pip * 8);
      const mid = (max + min) / 2 || quote.mid;
      min = mid - span / 2;
      max = mid + span / 2;
      const padY = (max - min) * 0.16;
      min -= padY;
      max += padY;

      const padL = 8;
      const padR = 16;
      const padT = 18;
      const padB = 26;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const xOf = (t: number) => padL + ((t - t0) / (t1 - t0)) * plotW;
      const yOf = (level: number) => padT + ((max - level) / (max - min)) * plotH;

      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "11px Inter, sans-serif";
      for (let i = 0; i <= 4; i++) {
        const level = min + ((max - min) * i) / 4;
        const y = yOf(level);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
      }

      if (entry && entry > 0 && openedAt && expiry) {
        const x1 = xOf(openedAt);
        const x2 = xOf(expiry);
        const y = yOf(entry);
        ctx.strokeStyle = "#3d9eff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1, padT);
        ctx.lineTo(x1, h - padB);
        ctx.stroke();
        ctx.strokeStyle = "#35d07f";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
        ctx.strokeStyle = "#f5a524";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x2, padT);
        ctx.lineTo(x2, h - padB);
        ctx.stroke();
        ctx.fillStyle = "#35d07f";
        ctx.beginPath();
        ctx.arc(x1, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (visible.length > 1) {
        ctx.beginPath();
        visible.forEach((point, index) => {
          const x = xOf(point.t);
          const y = yOf(point.p);
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = "#4aa3ff";
        ctx.lineWidth = 2.4;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke();
        const tip = visible[visible.length - 1]!;
        const tx = xOf(now);
        const ty = yOf(shown);
        ctx.fillStyle = "#4aa3ff";
        ctx.beginPath();
        ctx.arc(tx, ty, 4, 0, Math.PI * 2);
        ctx.fill();
        const label = formatPrice(shown, inst.digits);
        ctx.fillStyle = "#2f80ed";
        ctx.beginPath();
        ctx.roundRect(8, ty - 12, 78, 24, 12);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, 16, ty + 4);
        void tip;
      }

      const start = new Date(t0);
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillText(`${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`, padL, h - 8);
      const live = new Date(now);
      ctx.fillText(`${String(live.getHours()).padStart(2, "0")}:${String(live.getMinutes()).padStart(2, "0")}:${String(live.getSeconds()).padStart(2, "0")}`, w / 2 - 28, h - 8);
      if (expiry) {
        const end = new Date(expiry);
        ctx.fillText(`${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}:${String(end.getSeconds()).padStart(2, "0")}`, Math.min(w - 70, xOf(expiry) - 24), h - 8);
      }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [symbol, entry, openedAt, expiry]);

  return (
    <div ref={wrapRef} className="h-full min-h-[320px] w-full bg-[#0c1424]">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
