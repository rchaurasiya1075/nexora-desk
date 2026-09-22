async function readJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

function inv(n: number | undefined): number | undefined {
  return n && n > 0 ? 1 / n : undefined;
}

function fxFromUsd(r: Record<string, number>): Record<string, number> {
  const eurusd = inv(r.eur ?? r.EUR);
  const gbpusd = inv(r.gbp ?? r.GBP);
  const audusd = inv(r.aud ?? r.AUD);
  const nzdusd = inv(r.nzd ?? r.NZD);
  const jpy = r.jpy ?? r.JPY;
  const chf = r.chf ?? r.CHF;
  const cad = r.cad ?? r.CAD;
  const inr = r.inr ?? r.INR;
  const out: Record<string, number> = {};
  if (eurusd) out.EURUSD = eurusd;
  if (gbpusd) out.GBPUSD = gbpusd;
  if (jpy) out.USDJPY = jpy;
  if (chf) out.USDCHF = chf;
  if (audusd) out.AUDUSD = audusd;
  if (cad) out.USDCAD = cad;
  if (nzdusd) out.NZDUSD = nzdusd;
  if (inr) out.USDINR = inr;
  if (eurusd && gbpusd) out.EURGBP = eurusd / gbpusd;
  if (eurusd && jpy) out.EURJPY = eurusd * jpy;
  if (gbpusd && jpy) out.GBPJPY = gbpusd * jpy;
  const btc = inv(r.btc);
  const eth = inv(r.eth);
  const sol = inv(r.sol);
  const xrp = inv(r.xrp);
  const xau = inv(r.xau ?? r.paxg);
  if (btc) out.BTCUSD = btc;
  if (eth) out.ETHUSD = eth;
  if (sol) out.SOLUSD = sol;
  if (xrp) out.XRPUSD = xrp;
  if (xau) out.XAUUSD = xau;
  return out;
}

/** jsDelivr currency-api — CORS-friendly, resolves in India. */
export async function pullCdn(): Promise<Record<string, number>> {
  const data = (await readJson(
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json",
  )) as { usd?: Record<string, number> };
  if (!data.usd) return {};
  return fxFromUsd(data.usd);
}

export async function pullFx(): Promise<Record<string, number>> {
  const data = (await readJson("https://open.er-api.com/v6/latest/USD")) as {
    rates?: Record<string, number>;
  };
  const r = data.rates;
  if (!r) return {};
  return fxFromUsd({
    EUR: r.EUR,
    GBP: r.GBP,
    JPY: r.JPY,
    CHF: r.CHF,
    AUD: r.AUD,
    CAD: r.CAD,
    NZD: r.NZD,
    INR: r.INR,
  });
}

export async function pullCoinbase(): Promise<Record<string, number>> {
  const data = (await readJson(
    "https://api.coinbase.com/v2/exchange-rates?currency=USD",
  )) as { data?: { rates?: Record<string, string> } };
  const rates = data.data?.rates;
  if (!rates) return {};
  const num: Record<string, number> = {};
  for (const [k, v] of Object.entries(rates)) {
    const n = Number(v);
    if (n > 0) num[k.toLowerCase()] = n;
  }
  return fxFromUsd(num);
}

const BINANCE_MAP: Record<string, string> = {
  BTCUSD: "BTCUSDT",
  ETHUSD: "ETHUSDT",
  SOLUSD: "SOLUSDT",
  XRPUSD: "XRPUSDT",
};

export async function pullBinance(): Promise<Record<string, number>> {
  const rows = (await readJson(
    "https://api.binance.com/api/v3/ticker/price",
  )) as Array<{ symbol: string; price: string }>;
  const bySym = new Map(rows.map((r) => [r.symbol, Number(r.price)]));
  const out: Record<string, number> = {};
  for (const [ours, theirs] of Object.entries(BINANCE_MAP)) {
    const px = bySym.get(theirs);
    if (px && Number.isFinite(px) && px > 0) out[ours] = px;
  }
  const paxg = bySym.get("PAXGUSDT");
  if (paxg && Number.isFinite(paxg) && paxg > 0) out.XAUUSD = paxg;
  return out;
}

/** Browser-safe: only hosts that resolve + send CORS. */
export async function pullQuotes(): Promise<Record<string, number>> {
  const parts = await Promise.all([
    pullCdn().catch(() => ({}) as Record<string, number>),
    pullFx().catch(() => ({}) as Record<string, number>),
    pullCoinbase().catch(() => ({}) as Record<string, number>),
  ]);
  const merged: Record<string, number> = {};
  for (const part of parts) Object.assign(merged, part);
  return merged;
}

export async function pullQuotesServer(): Promise<Record<string, number>> {
  const parts = await Promise.all([
    pullCdn().catch(() => ({}) as Record<string, number>),
    pullFx().catch(() => ({}) as Record<string, number>),
    pullCoinbase().catch(() => ({}) as Record<string, number>),
    pullBinance().catch(() => ({}) as Record<string, number>),
  ]);
  const merged: Record<string, number> = {};
  for (const part of parts) Object.assign(merged, part);
  return merged;
}
