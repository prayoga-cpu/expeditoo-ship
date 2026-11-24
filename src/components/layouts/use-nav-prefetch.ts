import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Every destination of a shell's navigation is fetched ahead, once the page
 * has settled (2.96.0 #36), so a tap on the bar or the sidebar lands on a
 * route the router already holds.
 *
 * The visible links prefetch themselves (`prefetch` on their `<Link>`), but
 * only while they are on screen: the sidebar is `display: none` below `lg`
 * and the bar is gone from `lg`, so half of each shell's destinations were
 * never fetched before the tap. This asks the router for all of them, in an
 * idle callback so it never competes with the first paint or with hydration.
 *
 * Off outside production, like `<Link>`'s own prefetching: in `next dev` a
 * prefetch compiles the route, and doing that for every destination on every
 * page load is what the dev server should not be asked to do.
 */
export function useNavPrefetch(
  hrefs: readonly (string | null | undefined)[],
  { enabled = process.env.NODE_ENV === "production" }: { enabled?: boolean } = {}
) {
  const router = useRouter();
  const done = useRef(new Set<string>());
  // Joined so the effect follows the list's content, not the array identity a
  // render hands it.
  const key = hrefs.filter((href): href is string => Boolean(href)).join("\n");

  useEffect(() => {
    if (!enabled || !key) return;
    const pending = [...new Set(key.split("\n"))].filter(
      (href) => href.startsWith("/") && !done.current.has(href)
    );
    if (pending.length === 0) return;

    const run = () => {
      for (const href of pending) {
        done.current.add(href);
        try {
          router.prefetch(href);
        } catch {
          // A prefetch is a head start, never a requirement: the tap still
          // navigates without one.
        }
      }
    };
    return whenIdle(run);
  }, [enabled, key, router]);
}

/** `requestIdleCallback` where it exists (not Safari before 18), else a timer. */
function whenIdle(run: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: 2000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, 200);
  return () => window.clearTimeout(id);
}
