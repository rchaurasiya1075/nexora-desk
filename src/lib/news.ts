export type Article = {
  slug: string;
  kicker: string;
  title: string;
  standfirst: string;
  date: string;
  body: string[];
};

export const ARTICLES: Article[] = [
  {
    slug: "gold-4400-test",
    kicker: "Metals",
    title: "Gold holds the $4,400 handle as the dollar loses its bid",
    standfirst:
      "Spot gold recovered toward $4,386 after a softer US 10-year, keeping the 7-day gold book in play for the Asia open.",
    date: "20 Sep 2026",
    body: [
      "XAU/USD spent the weekend bid after Friday’s 0.6% bounce. COMEX last printed $4,385.90 as US 10-year yields cooled to 5.00% and the dollar index faded its post-Fed spike.",
      "The technical test is straightforward: a daily close above $4,400 opens $4,455, the August swing high. Failure there puts $4,310 back in view — the 20-day volume-weighted average.",
      "Sikkaaa’s demo gold book is open seven days. Use smaller size into Sunday gaps; the live spread on XAU/USD typically sits around 0.32 on Standard and 0.12 on RAW.",
    ],
  },
  {
    slug: "btc-78k",
    kicker: "Crypto",
    title: "Bitcoin reclaims $78,000 despite ETF outflows",
    standfirst:
      "BTC recovered to the $77.9k area even as spot ETFs saw another $746m leave. ETH is probing $2,500.",
    date: "19 Sep 2026",
    body: [
      "The tape is two-speed: ETFs keep bleeding, but the perpetual basis has normalised and weekend volumes in Asia are supporting the $77k shelf.",
      "ETH’s bull flag still points toward $3,300 if $2,500 holds on a daily close. XRP is a cleaner mean-revert around $1.50.",
      "Crypto CFDs on this desk run 24/7 with 5:1 leverage. Weekend spreads widen — size down, or wait for the Monday London overlap.",
    ],
  },
  {
    slug: "oil-100",
    kicker: "Energy",
    title: "Brent holds $100 as the complex shrugs off a quiet inventory print",
    standfirst:
      "Brent last $103.37, WTI $95.42. The complex is up more than 60% year-on-year and positioning is stretched.",
    date: "19 Sep 2026",
    body: [
      "A $100 floor in Brent has become self-reinforcing: refiners restocked into last week’s dip and speculative length remains elevated.",
      "The risk is a stronger dollar plus a hotter US 2-year. Until then, dips toward $98 have been bought.",
      "Energy CFDs here use 10:1 leverage. A $1 move in WTI on 1.00 lot is $100 — same math as a live futures-linked CFD.",
    ],
  },
  {
    slug: "eurusd-115",
    kicker: "FX",
    title: "EUR/USD parks at 1.15 as US yields stall at 5%",
    standfirst:
      "The euro is unchanged on the week around 1.1483. Cable is firmer at 1.3393. USD/INR sits near 88.42.",
    date: "20 Sep 2026",
    body: [
      "G10 FX is a range market until the next US labour print. EUR/USD has mean-reverted between 1.1420 and 1.1560 for eleven sessions.",
      "USD/INR remains the cleaner India-linked expression. The pair is heavy under 88.80; exporters typically fade pops toward 88.70–88.90.",
      "Standard EUR/USD spread on this desk is 1.0 pip. RAW is 0.2 pip plus $3.50 per side per lot — all-in cost is usually similar unless you scalp.",
    ],
  },
  {
    slug: "us-tech-open",
    kicker: "Indices",
    title: "US Tech 100 holds 29,500 into the Monday cash open",
    standfirst:
      "Nasdaq 100 last 29,522, S&P 500 7,650, Dow 51,770. Extended-hours share CFDs stay live on the desk.",
    date: "20 Sep 2026",
    body: [
      "Index futures digested Friday’s modest bid. Breadth was narrow — a handful of megacaps did the lifting.",
      "Share CFDs in NVDA, TSLA, AAPL, MSFT, AMZN and GOOGL are 0-commission on both account types, with 5:1 leverage and extended hours.",
      "Index stop-outs are brutal when the cash open gaps. Place stops in price, not in hope, and keep margin level above 200% into US hours.",
    ],
  },
];
