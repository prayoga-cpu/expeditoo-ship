import type Lenis from "lenis";

/**
 * The home page's smooth scroll, shared between the component that owns it
 * (`LandingMotion`) and the one that must stop it (the full-screen menu).
 * `null` whenever Lenis is not running: on touch, under reduced motion, and
 * on every page but `/` (landing_2026_11_spec.md §6.2).
 */
let active: Lenis | null = null;

export function registerSmoothScroll(instance: Lenis | null) {
  active = instance;
}

export function smoothScroll(): Lenis | null {
  return active;
}

/**
 * Holds the page still behind the menu. `overflow: hidden` on <html> stops
 * the wheel and the keyboard; Lenis is stopped too, or it would keep easing
 * towards a target the visitor can no longer see.
 */
export function lockPageScroll(locked: boolean) {
  const root = document.documentElement;
  if (locked) {
    active?.stop();
    root.style.overflow = "hidden";
    return;
  }
  root.style.overflow = "";
  active?.start();
}

/**
 * A same-page anchor (`/#how`, `#how`) on the page it points into, or null.
 * Read from the link's own `href`, so the header and footer — which say
 * `/#…` because they also appear on other pages — are covered.
 */
export function samePageHash(link: HTMLAnchorElement): string | null {
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  if (url.pathname !== window.location.pathname) return null;
  return url.hash.length > 1 ? url.hash : null;
}
