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

export function TradingViewChart({ symbol }: { symbol: string }) {
  const pair = TV[symbol] ?? `FX:${symbol}`;
  const src =
    "https://www.tradingview.com/widgetembed/?symbol=" +
    encodeURIComponent(pair) +
    "&interval=15&hidesidetoolbar=1&hidetoptoolbar=0&symboledit=0&saveimage=0" +
    "&toolbarbg=0b0c0f&theme=dark&style=1&timezone=Asia%2FKolkata&withdateranges=1" +
    "&hideideas=1&locale=en&utm_source=sikkaaa.in&utm_medium=widget&utm_campaign=chart";

  return (
    <iframe
      key={pair}
      title={`${symbol} chart`}
      src={src}
      className="absolute inset-0 h-full w-full border-0 bg-[#0b0c0f]"
      allow="fullscreen; clipboard-write"
      allowFullScreen
      referrerPolicy="origin"
    />
  );
}
