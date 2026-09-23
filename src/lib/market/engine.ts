import {
  getInstrument,
  INSTRUMENTS,
  type Instrument,
} from "./instruments";

export type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d";

export const TIMEFRAMES: { id: Timeframe; label: string; ms: number }[] = [
  { id: "1m", label: "1m", ms: 60_000 },
  { id: "5m", label: "5m", ms: 5 * 60_000 },
  { id: "15m", label: "15m", ms: 15 * 60_000 },
  { id: "30m", label: "30m", ms: 30 * 60_000 },
  { id: "1h", label: "1H", ms: 60 * 60_000 },
  { id: "4h", label: "4H", ms: 4 * 60 * 60_000 },
  { id: "1d", label: "1D", ms: 24 * 60 * 60_000 },
];

export type Quote = {
  symbol: string;
  mid: number;
  bid: number;
  ask: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  updatedAt: number;
  live: boolean;
};

export type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
};

type Listener = () => void;

const HISTORY = 240;
const LIVE_STALE_MS = 45_000;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng: () => number) {
  const u = Math.max(1e-9, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function hashSymbol(symbol: string) {
  let h = 2166136261;
  for (let i = 0; i < symbol.length; i++) {
    h ^= symbol.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function tfMs(tf: Timeframe) {
  return TIMEFRAMES.find((t) => t.id === tf)!.ms;
}

function buildHistory(inst: Instrument, tf: Timeframe, now: number): Candle[] {
  const rng = mulberry32(hashSymbol(inst.symbol) ^ tfMs(tf));
  const step = tfMs(tf);
  const aligned = Math.floor(now / step) * step;
  const start = aligned - HISTORY * step;
  const candles: Candle[] = [];
  let price = inst.base * (0.96 + rng() * 0.03);
  const vol = inst.vol * Math.sqrt(step / 60_000);

  for (let i = 0; i < HISTORY; i++) {
    const t = start + i * step;
    const o = price;
    const shock = gauss(rng) * vol;
    const c = Math.max(inst.base * 0.2, o * (1 + shock));
    const wiggle = Math.abs(gauss(rng)) * vol * 0.55;
    const h = Math.max(o, c) * (1 + wiggle);
    const l = Math.min(o, c) * (1 - wiggle);
    candles.push({ t, o, h, l, c });
    price = c;
  }

  const last = candles[candles.length - 1]!;
  const scale = inst.base / last.c;
  for (const c of candles) {
    c.o *= scale;
    c.h *= scale;
    c.l *= scale;
    c.c *= scale;
  }
  last.c = inst.base;
  last.h = Math.max(last.h, inst.base);
  last.l = Math.min(last.l, inst.base);
  return candles;
}

export type AccountPricing = "standard" | "raw";

class MarketEngine {
  private quotes = new Map<string, Quote>();
  private candles = new Map<string, Map<Timeframe, Candle[]>>();
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private pricing: AccountPricing = "standard";
  private liveTarget = new Map<string, number>();
  private liveAt = new Map<string, number>();
  /** Admin-pinned mids. While set, the tape does not drift or follow the live feed. */
  private pins = new Map<string, number>();
  private paused = new Set<string>();
  started = false;
  feedLive = false;

  constructor() {
    this.seed();
  }

  private seed() {
    const now = Date.now();
    for (const inst of INSTRUMENTS) {
      const byTf = new Map<Timeframe, Candle[]>();
      for (const tf of TIMEFRAMES) {
        byTf.set(tf.id, buildHistory(inst, tf.id, now));
      }
      this.candles.set(inst.symbol, byTf);
      const m15 = byTf.get("15m")!;
      const sessionOpen = m15.length > 20 ? m15[m15.length - 20]!.c : inst.base;
      this.quotes.set(inst.symbol, this.makeQuote(inst, inst.base, sessionOpen, now, false));
    }
  }

  setPricing(mode: AccountPricing) {
    this.pricing = mode;
    for (const inst of INSTRUMENTS) {
      const q = this.quotes.get(inst.symbol);
      if (!q) continue;
      this.quotes.set(
        inst.symbol,
        this.makeQuote(inst, q.mid, q.open, q.updatedAt, q.live),
      );
    }
    this.emit();
  }

  private spreadOf(inst: Instrument) {
    return this.pricing === "raw" ? inst.spreadRaw : inst.spreadStd;
  }

  private makeQuote(
    inst: Instrument,
    mid: number,
    open: number,
    now: number,
    live: boolean,
  ): Quote {
    const half = this.spreadOf(inst) / 2;
    const change = mid - open;
    const q = this.quotes.get(inst.symbol);
    return {
      symbol: inst.symbol,
      mid,
      bid: mid - half,
      ask: mid + half,
      change,
      changePct: (change / open) * 100,
      open,
      high: Math.max(mid, q?.high ?? open),
      low: Math.min(mid, q?.low ?? open),
      updatedAt: now,
      live,
    };
  }

  start() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    this.timer = setInterval(() => this.tick(), 280);
    void import("@/lib/ops/control-store").then((m) => m.bootControl());
    void import("./live-feed").then((m) => m.startLiveFeed());
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.started = false;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    this.start();
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  getQuote(symbol: string): Quote {
    return this.quotes.get(symbol)!;
  }

  getQuotes(): Quote[] {
    return INSTRUMENTS.map((i) => this.quotes.get(i.symbol)!);
  }

  getCandles(symbol: string, tf: Timeframe): Candle[] {
    return this.candles.get(symbol)?.get(tf) ?? [];
  }

  getSpark(symbol: string): number[] {
    const c = this.getCandles(symbol, "15m");
    return c.slice(-32).map((x) => x.c);
  }

  isLive(symbol: string) {
    const at = this.liveAt.get(symbol) ?? 0;
    return Date.now() - at < LIVE_STALE_MS;
  }

  /** Pull the tape toward a real-world mid without wiping the candle history. */
  anchor(symbol: string, liveMid: number) {
    if (this.pins.has(symbol) || this.paused.has(symbol)) return;
    if (!Number.isFinite(liveMid) || liveMid <= 0) return;
    const inst = INSTRUMENT_SAFE(symbol);
    if (!inst) return;
    const q = this.quotes.get(symbol);
    if (!q) return;
    const now = Date.now();
    this.liveTarget.set(symbol, liveMid);
    this.liveAt.set(symbol, now);
    this.feedLive = true;
    const gap = Math.abs(liveMid - q.mid) / liveMid;
    const next = gap > 0.015 ? liveMid : q.mid * 0.35 + liveMid * 0.65;
    this.applyMid(inst, next, now, true);
  }

  markFeed(ok: boolean) {
    this.feedLive = ok;
  }

  setManualPrice(symbol: string, price: number) {
    if (!Number.isFinite(price) || price <= 0) return;
    const inst = INSTRUMENT_SAFE(symbol);
    if (!inst) return;
    this.pins.set(symbol, price);
    this.liveTarget.delete(symbol);
    this.applyMid(inst, price, Date.now(), true);
    this.emit();
  }

  clearManualPrice(symbol: string) {
    this.pins.delete(symbol);
    this.emit();
  }

  setPaused(symbol: string, paused: boolean) {
    if (paused) this.paused.add(symbol);
    else this.paused.delete(symbol);
    this.emit();
  }

  isPinned(symbol: string) {
    return this.pins.has(symbol);
  }

  isPaused(symbol: string) {
    return this.paused.has(symbol);
  }

  private applyMid(inst: Instrument, next: number, now: number, live: boolean) {
    const q = this.quotes.get(inst.symbol)!;
    const half = this.spreadOf(inst) / 2;
    const change = next - q.open;
    this.quotes.set(inst.symbol, {
      ...q,
      mid: next,
      bid: next - half,
      ask: next + half,
      change,
      changePct: (change / q.open) * 100,
      high: Math.max(q.high, next),
      low: Math.min(q.low, next),
      updatedAt: now,
      live,
    });
    const byTf = this.candles.get(inst.symbol)!;
    for (const tf of TIMEFRAMES) {
      const arr = byTf.get(tf.id)!;
      const last = arr[arr.length - 1]!;
      const bucket = Math.floor(now / tf.ms) * tf.ms;
      if (bucket > last.t) {
        arr.push({ t: bucket, o: last.c, h: next, l: next, c: next });
        if (arr.length > HISTORY) arr.shift();
      } else {
        last.c = next;
        last.h = Math.max(last.h, next);
        last.l = Math.min(last.l, next);
      }
    }
  }

  private tick() {
    const now = Date.now();
    const usd = gauss(Math.random) * 0.000012;
    const risk = gauss(Math.random) * 0.000016;

    for (const inst of INSTRUMENTS) {
      const q = this.quotes.get(inst.symbol)!;
      const pin = this.pins.get(inst.symbol);
      if (pin != null) {
        if (Math.abs(q.mid - pin) > pin * 1e-8) this.applyMid(inst, pin, now, true);
        continue;
      }
      if (this.paused.has(inst.symbol)) continue;
      let drift = gauss(Math.random) * inst.vol * 0.035;

      if (inst.assetClass === "forex") {
        if (inst.symbol.startsWith("USD")) drift += usd;
        else if (inst.symbol.endsWith("USD")) drift -= usd;
        if (inst.symbol.includes("JPY")) drift += usd * 0.4;
      } else if (inst.assetClass === "metals") {
        drift -= usd * 0.7 + risk * 0.3;
      } else if (inst.assetClass === "crypto") {
        drift += risk * 1.4;
      } else if (inst.assetClass === "indices" || inst.assetClass === "shares") {
        drift += risk * 0.6 - usd * 0.25;
      } else if (inst.assetClass === "energy") {
        drift += risk * 0.5;
      }

      const target = this.liveTarget.get(inst.symbol);
      const live = this.isLive(inst.symbol);
      let next: number;
      if (target && live) {
        const pull = (target - q.mid) * 0.12;
        next = Math.max(inst.base * 0.15, q.mid * (1 + drift * 0.22) + pull);
      } else {
        next = Math.max(inst.base * 0.15, q.mid * (1 + drift));
      }
      this.applyMid(inst, next, now, live);
    }
    this.emit();
  }
}

function INSTRUMENT_SAFE(symbol: string): Instrument | null {
  try {
    return getInstrument(symbol);
  } catch {
    return null;
  }
}

export const market = new MarketEngine();
