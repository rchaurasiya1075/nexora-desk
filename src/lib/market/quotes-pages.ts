import { pullQuotes } from "./quotes-core";

export { pullQuotes };

export async function fetchLiveQuotes() {
  return pullQuotes();
}
