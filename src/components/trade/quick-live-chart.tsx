import { useEffect, useRef } from "react";
import { market } from "@/lib/market/engine";
import { getInstrument } from "@/lib/market/instruments";
import { formatPrice } from "@/lib/utils";

type Point = { t: number; p: number };
const trails = new Map<string, Point[]>();

function seed(symbol: string) {
  const now = Date.now();
  const quote = market.getQuote(symbol);
  const price = quote?.mid ?? 0;
  if (!price) return;
  trails.set(symbol, [
    { t: now - 8_000, p: price },
    { t: now - 4_000, p: price },
    { t: now, p: price },
  ]);
}

type CrowdBet = { t: number; p: number; side: "buy" | "sell"; amount: number; letter: string; color: string };

const AMOUNTS = [10, 25, 50, 100, 200, 500];
const LETTERS = ["A", "R", "S", "K", "M", "P", "N", "V"];
const COLORS = ["#3b82f6", "#7c3aed", "#d97706", "#0f766e", "#db2777", "#15803d"];

export function QuickLiveChart({
  symbol,
  entry,
  openedAt,
  expiry,
  stakeLabel,
  side,
  trader,
}: {
  symbol: string;
  entry?: number | null;
  openedAt?: number | null;
  expiry?: number | null;
  stakeLabel?: string | null;
  side?: "call" | "put" | null;
  trader?: string | null;
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
    const crowd: CrowdBet[] = [];
    let nextCrowd = Date.now() + 2800;

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
      const kept = trail.filter((point) => now - point.t < 90_000);
      trails.set(symbol, kept);
      if (now >= nextCrowd) {
        crowd.push({
          t: now - 600,
          p: shown,
          side: Math.random() > 0.5 ? "buy" : "sell",
          amount: AMOUNTS[Math.floor(Math.random() * AMOUNTS.length)] ?? 50,
          letter: LETTERS[Math.floor(Math.random() * LETTERS.length)] ?? "A",
          color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#3b82f6",
        });
        if (crowd.length > 3) crowd.shift();
        nextCrowd = now + 4800 + Math.random() * 4200;
      }
      for (let i = crowd.length - 1; i >= 0; i -= 1) {
        if (now - crowd[i].t > 22_000) crowd.splice(i, 1);
      }

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
      const candles = market.getCandles(symbol, "1m").slice(-20);
      const future = expiry && expiry > now ? expiry - now + 8_000 : 50_000;
      const t0 = candles[0]?.t ?? now - 18 * 60_000;
      const t1 = Math.max(now + future, (candles[candles.length - 1]?.t ?? now) + 60_000);
      const marks = candles.flatMap((candle) => [candle.h, candle.l]);
      marks.push(shown);
      if (entry && entry > 0) marks.push(entry);
      let min = Math.min(...marks);
      let max = Math.max(...marks);
      const minSpan = Math.max(quote.mid * 0.00045, inst.pip * 10);
      if (max - min < minSpan) {
        const mid = (max + min) / 2 || quote.mid;
        min = mid - minSpan / 2;
        max = mid + minSpan / 2;
      }
      const pad = (max - min) * 0.1;
      min -= pad;
      max += pad;

      const padL = 8;
      const padR = 74;
      const padT = 12;
      const padB = 22;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;
      const xOf = (t: number) => padL + ((t - t0) / (t1 - t0)) * plotW;
      const yOf = (level: number) => padT + ((max - level) / (max - min)) * plotH;
      const bodyW = Math.max(3, ((60_000 / (t1 - t0)) * plotW) * 0.62);

      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "11px Inter, sans-serif";
      for (let i = 0; i <= 4; i++) {
        const level = min + ((max - min) * i) / 4;
        const y = yOf(level);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillText(formatPrice(level, inst.digits), w - padR + 6, y + 4);
      }

      candles.forEach((candle) => {
        const x = xOf(candle.t + 30_000);
        const up = candle.c >= candle.o;
        const color = up ? "#1f9d55" : "#e23b3b";
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, yOf(candle.h));
        ctx.lineTo(x, yOf(candle.l));
        ctx.stroke();
        const top = yOf(Math.max(candle.o, candle.c));
        const bot = yOf(Math.min(candle.o, candle.c));
        ctx.fillRect(x - bodyW / 2, top, bodyW, Math.max(1.5, bot - top));
      });

      const visible = kept.filter((point) => point.t >= t0 && point.t <= t1);
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
        const floor = h - padB;
        ctx.beginPath();
        visible.forEach((point, index) => {
          const x = xOf(point.t);
          const y = yOf(point.p);
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.lineTo(xOf(visible[visible.length - 1].t), floor);
        ctx.lineTo(xOf(visible[0].t), floor);
        ctx.closePath();
        const wash = ctx.createLinearGradient(0, padT, 0, floor);
        wash.addColorStop(0, "rgba(74,163,255,0.28)");
        wash.addColorStop(1, "rgba(74,163,255,0.02)");
        ctx.fillStyle = wash;
        ctx.fill();

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

        for (const bet of crowd) {
          if (bet.t < t0) continue;
          const x = xOf(bet.t);
          const y = yOf(bet.p);
          const up = bet.side === "buy";
          const text = `$${bet.amount}`;
          ctx.fillStyle = bet.color;
          ctx.beginPath();
          ctx.arc(x, up ? y - 18 : y + 18, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 10px Inter, sans-serif";
          ctx.fillText(bet.letter, x - 3, (up ? y - 18 : y + 18) + 3);
          ctx.font = "11px Inter, sans-serif";
          const tw = ctx.measureText(text).width + 10;
          const ty = up ? y - 40 : y + 28;
          ctx.globalAlpha = 0.92;
          ctx.fillStyle = up ? "rgba(20,128,74,0.9)" : "rgba(197,54,58,0.9)";
          ctx.beginPath();
          ctx.roundRect(x - tw / 2, ty, tw, 16, 8);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.fillText(text, x - tw / 2 + 5, ty + 12);
          ctx.globalAlpha = 1;
          ctx.fillStyle = up ? "#35d07f" : "#ff5a6a";
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        if (entry && entry > 0 && openedAt && stakeLabel) {
          const x1 = xOf(openedAt);
          const y = yOf(entry);
          const mineUp = side !== "put";
          const tag = mineUp ? `BUY ${stakeLabel}` : `SELL ${stakeLabel}`;
          const face = (trader || "Y").slice(0, 1).toUpperCase();
          ctx.fillStyle = "#2563eb";
          ctx.beginPath();
          ctx.arc(x1, mineUp ? y - 16 : y + 16, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 11px Inter, sans-serif";
          ctx.fillText(face, x1 - 4, (mineUp ? y - 16 : y + 16) + 4);
          ctx.font = "11px Inter, sans-serif";
          const tw = ctx.measureText(tag).width + 16;
          const ty = mineUp ? y - 40 : y + 28;
          ctx.fillStyle = mineUp ? "#14804a" : "#c5363a";
          ctx.beginPath();
          ctx.roundRect(Math.max(8, x1 - tw / 2), ty, tw, 20, 10);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.fillText(tag, Math.max(8, x1 - tw / 2) + 8, ty + 14);
        }
        const tip = visible[visible.length - 1]!;
        const tx = xOf(now);
        const ty = yOf(shown);
        ctx.fillStyle = "#4aa3ff";
        ctx.beginPath();
        ctx.arc(tx, ty, 4, 0, Math.PI * 2);
        ctx.fill();
        const label = formatPrice(shown, inst.digits);
        const pillW = 68;
        ctx.fillStyle = shown >= (entry || quote.open) ? "#1f9d55" : "#e23b3b";
        ctx.beginPath();
        ctx.roundRect(w - padR + 2, ty - 11, pillW, 22, 4);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, w - padR + 6, ty + 4);
        if (entry && entry > 0) {
          const ey = yOf(entry);
          ctx.fillStyle = "#35d07f";
          ctx.fillRect(w - padR + 2, ey - 9, pillW, 18);
          ctx.fillStyle = "#06210f";
          ctx.fillText(formatPrice(entry, inst.digits), w - padR + 6, ey + 4);
        }
        void tip;
      }

      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const stamp = (t: number) => {
        const d = new Date(t);
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      };
      const first = candles[0]?.t ?? t0;
      const opened = new Date(first);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "11px Inter, sans-serif";
      ctx.fillText(`${opened.getDate()} ${months[opened.getMonth()]}  ${stamp(first)}`, padL, h - 6);
      if (candles.length > 8) ctx.fillText(stamp(candles[Math.floor(candles.length / 2)]!.t), xOf(candles[Math.floor(candles.length / 2)]!.t), h - 6);
      const live = new Date(now);
      ctx.fillText(`${stamp(now)}:${String(live.getSeconds()).padStart(2, "0")}`, Math.min(w - padR - 52, xOf(now) - 18), h - 6);

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [symbol, entry, openedAt, expiry, stakeLabel, side, trader]);

  return (
    <div ref={wrapRef} className="h-full min-h-[180px] w-full bg-[#0c1424]">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
