import { useEffect, useReducer } from "react";
import { market } from "./engine";

export function useMarketTick() {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => market.subscribe(bump), []);
}
