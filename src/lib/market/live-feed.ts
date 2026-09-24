import { market } from "./engine";
import { fetchLiveQuotes } from "./quotes";
import { pullQuotes } from "./quotes-core";

let timer: ReturnType<typeof setInterval> | null = null;
let started = false;

async function refresh() {
  try {
    let merged: Record<string, number> = {};
    try {
      merged = await fetchLiveQuotes();
    } catch {
      merged = {};
    }
    if (Object.keys(merged).length === 0) {
      merged = await pullQuotes();
    }
    const keys = Object.keys(merged);
    if (keys.length === 0) {
      market.markFeed(false);
      return;
    }
    for (const [symbol, mid] of Object.entries(merged)) {
      market.anchor(symbol, mid);
    }
  } catch {
    market.markFeed(false);
  }
}

export function startLiveFeed() {
  if (started || typeof window === "undefined") return;
  started = true;
  void refresh();
  timer = setInterval(() => void refresh(), 12_000);
}

export function stopLiveFeed() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}
