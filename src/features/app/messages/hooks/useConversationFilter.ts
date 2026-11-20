import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_CONVERSATION_FILTER,
  isConversationFilter,
  type ConversationFilter,
} from "@/lib/conversation-filter";

/**
 * The Messages filter, held in the URL (`?filter=`) so opening a thread and
 * coming Back lands on the list as it was left (client feedback 2026-11-19, #26).
 *
 * Read from `window.location` through `useSyncExternalStore` rather than
 * `useSearchParams`: the list hook is called from the page and the chips are
 * rendered below it, and both must read one value without the page handing it
 * down — and `useSearchParams` in a page with no Suspense boundary above it is
 * a build error. Written with `history.replaceState`, which the App Router
 * observes, so the entry Back returns to carries the filter and choosing one
 * adds no history step of its own.
 */

const PARAM = "filter";
const CHANGED = "expeditop:conversation-filter";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

/** An unknown or absent value reads as « all », never as an error. */
export function readConversationFilter(search: string): ConversationFilter {
  const value = new URLSearchParams(search).get(PARAM);
  return isConversationFilter(value) ? value : DEFAULT_CONVERSATION_FILTER;
}

/** The query string with the filter set — or dropped, for « all ». */
export function writeConversationFilter(
  search: string,
  filter: ConversationFilter
): string {
  const params = new URLSearchParams(search);
  if (filter === DEFAULT_CONVERSATION_FILTER) params.delete(PARAM);
  else params.set(PARAM, filter);
  const query = params.toString();
  return query ? `?${query}` : "";
}

const snapshot = () => readConversationFilter(window.location.search);
const serverSnapshot = () => DEFAULT_CONVERSATION_FILTER;

export function useConversationFilter() {
  const filter = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  const setFilter = useCallback((next: ConversationFilter) => {
    const { pathname, search, hash } = window.location;
    const query = writeConversationFilter(search, next);
    // `null`, not the current state: the router copies its own bookkeeping
    // into a null state, and ignores a call that already carries it.
    window.history.replaceState(null, "", `${pathname}${query}${hash}`);
    window.dispatchEvent(new Event(CHANGED));
  }, []);

  return { filter, setFilter };
}
