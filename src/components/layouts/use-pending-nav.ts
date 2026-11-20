import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { usePathname } from "next/navigation";

/**
 * A tap on a navigation bar answers at once (2.92.0 #36).
 *
 * The active pill follows `usePathname()`, which only changes once the new
 * route has committed — after the session check in the proxy and the route's
 * own payload. Until then a tap changed nothing on screen, so it read as
 * ignored and was repeated, three or four times on a slow connection. The bar
 * now marks the tapped item as the one in progress immediately, and a second
 * tap on it while it is still on its way is dropped rather than queued as
 * another navigation.
 *
 * Nothing here navigates: the `<Link>` does. `pendingHref` is remembered
 * together with the path it was tapped *from*, so it expires by itself the
 * moment the path changes — no effect has to notice the arrival. The timeout
 * covers the navigation that never lands (offline, a redirect back to the same
 * page): the bar goes back to telling the truth instead of pointing at a page
 * the person is not on.
 */
const PENDING_TIMEOUT_MS = 8000;

interface Pending {
  href: string;
  from: string | null;
}

/** A click the browser handles itself — new tab, new window, download. */
const isModified = (event: MouseEvent) =>
  event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

export function usePendingNav(timeoutMs: number = PENDING_TIMEOUT_MS) {
  const pathname = usePathname();
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setPending(null), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [pending, timeoutMs]);

  const pendingHref = pending && pending.from === pathname ? pending.href : null;

  /** For a link's `onClick`. `current` is whether the link is already the page. */
  const onNavigate = useCallback(
    (event: MouseEvent, href: string, current: boolean) => {
      if (event.defaultPrevented || isModified(event)) return;
      if (pendingHref === href) {
        event.preventDefault();
        return;
      }
      // Already there: the link may still pop a child route back to its
      // parent, but there is no arrival to wait for and nothing to mark.
      if (current && pathname === href) return;
      setPending({ href, from: pathname });
    },
    [pathname, pendingHref]
  );

  return { pendingHref, onNavigate };
}

/** The classes of a bar item under the finger: no 300 ms double-tap wait, no
 * grey flash, and a pressed look that does not depend on the network. */
export const NAV_PRESS =
  "touch-manipulation select-none [-webkit-tap-highlight-color:transparent] active:scale-[0.97] active:bg-nav-active";
