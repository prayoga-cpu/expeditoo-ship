"use client";

import { useEffect, useLayoutEffect } from "react";
import type Lenis from "lenis";
import "lenis/dist/lenis.css";
import { registerSmoothScroll, samePageHash, smoothScroll } from "../landing-scroll";

/**
 * The home page's motion, as progressive enhancement (landing_2026_11_spec.md
 * §6.2): nothing here is needed to read the page, and none of it runs under
 * `prefers-reduced-motion`.
 */
const reducedMotion = () =>
  // No `matchMedia` (jsdom, very old browsers): treated as « reduce », so the
  // page is simply static.
  !window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A mouse or trackpad: Lenis never takes over a finger's scroll. */
const finePointer = () =>
  !!window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/**
 * Same-page anchors glide through Lenis, landing under the floating header
 * (it reads each section's `scroll-margin-top`). Captured before Next's Link
 * sees the click: `preventDefault` there is what stops the router's own
 * instant jump fighting the glide. One frame later, so a menu that closes on
 * the same click has unlocked the page first — `start()` resets any scroll in
 * flight.
 */
function onAnchorClick(event: MouseEvent) {
  const lenis = smoothScroll();
  if (!lenis || event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = (event.target as Element | null)?.closest?.("a[href]");
  if (!(link instanceof HTMLAnchorElement)) return;
  const hash = samePageHash(link);
  if (!hash || !document.getElementById(decodeURIComponent(hash.slice(1)))) return;
  event.preventDefault();
  window.history.pushState(null, "", hash);
  requestAnimationFrame(() => lenis.scrollTo(decodeURIComponent(hash), { force: true }));
}

function useSmoothScroll() {
  useEffect(() => {
    if (reducedMotion() || !finePointer()) return;
    let cancelled = false;
    let instance: Lenis | null = null;
    // Loaded after the page is up: smooth scrolling is never on the
    // critical path.
    void import("lenis").then(({ default: LenisClass }) => {
      if (cancelled) return;
      instance = new LenisClass({ autoRaf: true, lerp: 0.1, respectReducedMotion: true });
      registerSmoothScroll(instance);
    });
    document.addEventListener("click", onAnchorClick, true);
    return () => {
      cancelled = true;
      document.removeEventListener("click", onAnchorClick, true);
      registerSmoothScroll(null);
      instance?.destroy();
    };
  }, []);
}

/**
 * Blocks marked `data-reveal` fade up from a light blur as they enter. Those
 * already on screen are marked first, so setting `lp-motion` hides only what
 * the visitor cannot see yet — nothing blinks. A layout effect, so it lands
 * before the first paint after hydration.
 */
function useReveal() {
  useLayoutEffect(() => {
    if (reducedMotion() || typeof IntersectionObserver === "undefined") return;
    const root = document.documentElement;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const fold = window.innerHeight;
    for (const node of nodes) {
      if (node.getBoundingClientRect().top < fold * 0.95) node.dataset.in = "";
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.in = "";
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    nodes.filter((node) => node.dataset.in === undefined).forEach((node) => observer.observe(node));
    root.classList.add("lp-motion");
    return () => {
      observer.disconnect();
      root.classList.remove("lp-motion");
    };
  }, []);
}

export function LandingMotion() {
  useSmoothScroll();
  useReveal();
  return null;
}
