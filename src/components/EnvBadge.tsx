import { APP_ENV } from "@/lib/env";

/**
 * Marks a preview deployment — `dev.expeditop.fr` and every pull-request
 * preview — so two browser tabs cannot be mistaken for each other. Production
 * renders nothing, and so does a laptop, where the address bar already says
 * localhost.
 *
 * `fixed`, not `absolute`, and outside the app shells: an absolutely
 * positioned element inside a scrolling `<main>` is what grew the document on
 * /create (CLAUDE.md gotcha 14). It takes no clicks.
 */
export function EnvBadge() {
  if (APP_ENV !== "preview") return null;

  return (
    <div
      aria-hidden
      data-testid="env-badge"
      className="pointer-events-none fixed left-1/2 top-[env(safe-area-inset-top)] z-[100] -translate-x-1/2 rounded-b-md bg-warning px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-black shadow-sm"
    >
      Dev
    </div>
  );
}
