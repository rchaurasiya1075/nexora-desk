import { useEffect, useId, useState } from "react";

const TV: Record<string, string> = {
  EURUSD: "FX:EURUSD",
  GBPUSD: "FX:GBPUSD",
  USDJPY: "FX:USDJPY",
  USDCHF: "FX:USDCHF",
  AUDUSD: "FX:AUDUSD",
  USDCAD: "FX:USDCAD",
  NZDUSD: "FX:NZDUSD",
  EURGBP: "FX:EURGBP",
  EURJPY: "FX:EURJPY",
  GBPJPY: "FX:GBPJPY",
  USDINR: "FX:USDINR",
  BTCUSD: "BITSTAMP:BTCUSD",
  ETHUSD: "BITSTAMP:ETHUSD",
  SOLUSD: "BINANCE:SOLUSDT",
  XRPUSD: "BITSTAMP:XRPUSD",
  XAUUSD: "OANDA:XAUUSD",
  XAGUSD: "OANDA:XAGUSD",
  XPTUSD: "TVC:PLATINUM",
  US100: "NASDAQ:NDX",
  US30: "TVC:DJI",
  US500: "SP:SPX",
  GER40: "XETR:DAX",
  UK100: "TVC:UKX",
  USOIL: "TVC:USOIL",
  UKOIL: "TVC:UKOIL",
  NATGAS: "NYMEX:NG1!",
  NVDA: "NASDAQ:NVDA",
  TSLA: "NASDAQ:TSLA",
  AAPL: "NASDAQ:AAPL",
  MSFT: "NASDAQ:MSFT",
  AMZN: "NASDAQ:AMZN",
  GOOGL: "NASDAQ:GOOGL",
};

type TVWidget = { widget: (opts: Record<string, unknown>) => void };

function loadTv(): Promise<TVWidget> {
  const w = window as Window & { TradingView?: TVWidget };
  if (w.TradingView) return Promise.resolve(w.TradingView);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-tv]");
    if (existing) {
      existing.addEventListener("load", () => {
        const api = (window as unknown as { TradingView?: TVWidget }).TradingView;
        if (api) resolve(api);
      });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.dataset.tv = "1";
    script.onload = () => {
      const api = (window as unknown as { TradingView?: TVWidget }).TradingView;
      if (api) resolve(api);
      else reject(new Error("chart"));
    };
    script.onerror = () => reject(new Error("chart"));
    document.head.appendChild(script);
  });
}

export function TradingViewChart({ symbol }: { symbol: string }) {
  const reactId = useId().replace(/:/g, "");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = document.getElementById(`tv-host-${reactId}`);
    if (!host) return;
    let cancelled = false;
    setFailed(false);
    host.innerHTML = `<div id="tv-box-${reactId}" style="height:100%;width:100%"></div>`;
    loadTv()
      .then((tv) => {
        if (cancelled) return;
        tv.widget({
          autosize: true,
          symbol: TV[symbol] ?? `FX:${symbol}`,
          interval: "15",
          timezone: "Asia/Kolkata",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#0b0c0f",
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          hide_side_toolbar: true,
          allow_symbol_change: false,
          save_image: false,
          withdateranges: true,
          details: false,
          container_id: `tv-box-${reactId}`,
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      host.innerHTML = "";
    };
  }, [symbol, reactId]);

  return (
    <div className="relative h-full w-full bg-[#0b0c0f]">
      <div id={`tv-host-${reactId}`} className="h-full w-full" />
      {failed && (
        <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted">
          Chart could not load. Check the connection and try again.
        </p>
      )}
    </div>
  );
}
