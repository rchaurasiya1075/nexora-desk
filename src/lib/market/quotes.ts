import { createServerFn } from "@tanstack/react-start";
import { pullQuotesServer } from "./quotes-core";

export { pullQuotes } from "./quotes-core";

export const fetchLiveQuotes = createServerFn({ method: "GET" }).handler(async () => {
  return pullQuotesServer();
});
