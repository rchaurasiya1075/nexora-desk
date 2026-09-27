import { useEffect, useRef } from "react";
import { market, type Candle } from "@/lib/market/engine";
import { getInstrument } from "@/lib/market/instruments";
import { formatPrice } from "@/lib/utils";

const BUCKET = 2000;

export function QuickLiveChart({ symbol, entry }: { symbol: string; entry?: number | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<Candle[]>([]);
  const symbolRef = useRef("");

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const draw = () => {
      const quote = market.getQuote(symbol);
      if (!quote) return;
      const now = Date.now();
      if (symbolRef.current !== symbol) {
        symbolRef.current = symbol;
        barsRef.current = market.getCandles(symbol, "1m").slice(-18).map((candle) => ({ ...candle }));
      }
      const bars = barsRef.current;
      const bucket = Math.floor(now / BUCKET) * BUCKET;
      const price = quote.mid;
      const last = bars[bars.length - 1];
      if (!last || bucket > last.t) {
        bars.push({ t: bucket, o: last?.c ?? price, h: price, l: price, c: price });
        if (bars.length > 42) bars.shift();
      } else {
        last.c = price;
        last.h = Math.max(last.h, price);
        last.l = Math.min(last.l, price);
      }

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
      ctx.fillStyle = "#0b0c0f";
      ctx.fillRect(0, 0, w, h);

      const inst = getInstrument(symbol);
      const visible = bars.slice(-32);
      const marks = visible.flatMap((candle) => [candle.h, candle.l]);
      if (entry && entry > 0) marks.push(entry);
      let min = Math.min(...marks);
      let max = Math.max(...marks);
      const minSpan = Math.max(price * 0.0006, inst.pip * 8);
      if (max - min < minSpan) {
        const mid = (max + min) / 2 || price;
        min = mid - minSpan / 2;
        max = mid + minSpan / 2;
      }
      const pad = (max - min) * 0.12;
      min -= pad;
      max += pad;

      const padL = 8;
      const padR = 72;
      const padT = 16;
      const padB = 8;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const slot = plotW / visible.length;
      const yOf = (level: number) => padT + ((max - level) / (max - min)) * plotH;

      ctx.strokeStyle = "rgba(242,241,237,0.06)";
      ctx.font = "11px Outfit, sans-serif";
      ctx.fillStyle = "#8d8d96";
      for (let i = 0; i <= 4; i++) {
        const level = min + ((max - min) * i) / 4;
        const y = yOf(level);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillText(formatPrice(level, inst.digits), w - padR + 6, y + 4);
      }

      visible.forEach((candle, index) => {
        const x = padL + index * slot + slot / 2;
        const up = candle.c >= candle.o;
        ctx.strokeStyle = up ? "#2F9E6B" : "#D05660";
        ctx.fillStyle = up ? "#2F9E6B" : "#D05660";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, yOf(candle.h));
        ctx.lineTo(x, yOf(candle.l));
        ctx.stroke();
        const top = yOf(Math.max(candle.o, candle.c));
        const bot = yOf(Math.min(candle.o, candle.c));
        const bw = Math.max(3, slot * 0.62);
        ctx.fillRect(x - bw / 2, top, bw, Math.max(1, bot - top));
      });

      const liveY = yOf(price);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = price >= (entry || price) ? "rgba(47,158,107,0.7)" : "rgba(208,86,96,0.7)";
      ctx.beginPath();
      ctx.moveTo(padL, liveY);
      ctx.lineTo(w - padR, liveY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = price >= (visible[0]?.o ?? price) ? "#2F9E6B" : "#D05660";
      ctx.fillRect(w - padR, liveY - 9, 68, 18);
      ctx.fillStyle = "#08110c";
      ctx.fillText(formatPrice(price, inst.digits), w - padR + 4, liveY + 4);

      if (entry && entry > 0) {
        const ey = yOf(entry);
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = "#F2F1ED";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(padL, ey);
        ctx.lineTo(w - padR, ey);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#F2F1ED";
        ctx.fillRect(padL, ey - 10, 78, 18);
        ctx.fillStyle = "#111214";
        ctx.fillText(`RATE ${formatPrice(entry, inst.digits)}`, padL + 4, ey + 3);
      }
    };

    draw();
    const unsub = market.subscribe(draw);
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => {
      unsub();
      ro.disconnect();
    };
  }, [symbol, entry]);

  return (
    <div ref={wrapRef} className="h-full min-h-[240px] w-full bg-[#0b0c0f]">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
