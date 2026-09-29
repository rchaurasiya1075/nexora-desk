import { useEffect, useRef } from "react";
import { market, type Candle } from "@/lib/market/engine";
import { getInstrument } from "@/lib/market/instruments";
import { formatPrice } from "@/lib/utils";

const BUCKET = 2000;

export function QuickLiveChart({
  symbol,
  entry,
  secondsLeft,
}: {
  symbol: string;
  entry?: number | null;
  secondsLeft?: number | null;
}) {
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
        barsRef.current = market.getCandles(symbol, "1m").slice(-40).map((candle) => ({ ...candle }));
      }
      const bars = barsRef.current;
      const bucket = Math.floor(now / BUCKET) * BUCKET;
      const price = quote.mid;
      const last = bars[bars.length - 1];
      if (!last || bucket > last.t) {
        bars.push({ t: bucket, o: last?.c ?? price, h: price, l: price, c: price });
        if (bars.length > 80) bars.shift();
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
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);

      const inst = getInstrument(symbol);
      const visible = bars.slice(-36);
      const marks = visible.flatMap((candle) => [candle.h, candle.l, quote.bid, quote.ask]);
      if (entry && entry > 0) marks.push(entry);
      let min = Math.min(...marks);
      let max = Math.max(...marks);
      const minSpan = Math.max(price * 0.00045, inst.pip * 6);
      if (max - min < minSpan) {
        const mid = (max + min) / 2 || price;
        min = mid - minSpan / 2;
        max = mid + minSpan / 2;
      }
      const pad = (max - min) * 0.08;
      min -= pad;
      max += pad;

      const padL = 6;
      const padR = 78;
      const padT = 10;
      const padB = 22;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const slot = plotW / visible.length;
      const yOf = (level: number) => padT + ((max - level) / (max - min)) * plotH;

      ctx.strokeStyle = "#eceff3";
      ctx.lineWidth = 1;
      ctx.font = "11px Inter, sans-serif";
      ctx.fillStyle = "#8b909a";
      for (let i = 0; i <= 4; i++) {
        const level = min + ((max - min) * i) / 4;
        const y = yOf(level);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillText(formatPrice(level, inst.digits), w - padR + 8, y + 4);
      }

      visible.forEach((candle, index) => {
        const x = padL + index * slot + slot / 2;
        const up = candle.c >= candle.o;
        const color = up ? "#1f9d55" : "#e23b3b";
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, yOf(candle.h));
        ctx.lineTo(x, yOf(candle.l));
        ctx.stroke();
        const top = yOf(Math.max(candle.o, candle.c));
        const bot = yOf(Math.min(candle.o, candle.c));
        const bw = Math.max(4, slot * 0.62);
        ctx.fillRect(x - bw / 2, top, bw, Math.max(1.5, bot - top));
        if (index === 0 || index === Math.floor(visible.length / 2) || index === visible.length - 1) {
          const stamp = new Date(candle.t);
          const label = `${String(stamp.getHours()).padStart(2, "0")}:${String(stamp.getMinutes()).padStart(2, "0")}`;
          ctx.fillStyle = "#8b909a";
          ctx.fillText(label, Math.max(padL, x - 14), h - 6);
        }
      });

      const pill = (y: number, text: string, bg: string) => {
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.roundRect(w - padR + 2, y - 9, 72, 18, 3);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, w - padR + 6, y + 4);
      };
      pill(yOf(quote.ask), formatPrice(quote.ask, inst.digits), "#1f9d55");
      pill(yOf(quote.bid), formatPrice(quote.bid, inst.digits), "#e23b3b");

      if (entry && entry > 0) {
        const ey = yOf(entry);
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = "#1f9d55";
        ctx.beginPath();
        ctx.moveTo(padL, ey);
        ctx.lineTo(w - padR, ey);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#1f9d55";
        ctx.fillRect(padL, ey - 9, 86, 18);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`IN ${formatPrice(entry, inst.digits)}`, padL + 4, ey + 4);
      }

      if (secondsLeft != null && secondsLeft > 0) {
        const label = `${secondsLeft}s`;
        ctx.fillStyle = "#5c6370";
        ctx.beginPath();
        ctx.roundRect(w - padR - 54, 12, 46, 22, 8);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, w - padR - 42, 27);
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
  }, [symbol, entry, secondsLeft]);

  return (
    <div ref={wrapRef} className="h-full min-h-[280px] w-full bg-white">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
