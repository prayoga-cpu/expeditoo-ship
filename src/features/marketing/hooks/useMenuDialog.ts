"use client";

import { useEffect, useRef } from "react";
import { lockPageScroll } from "../landing-scroll";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function focusables(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
}

/** Tab and Shift+Tab go round the panel and never leave it. */
function trapTab(event: KeyboardEvent, panel: HTMLElement) {
  const items = focusables(panel);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const current = document.activeElement;
  if (!panel.contains(current)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && current === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && current === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * The full-screen menu's dialog behaviour (landing_2026_11_spec.md §1.2):
 * focus moves into the panel, stays there, Escape closes it, the page behind
 * does not scroll, and focus returns to the button that opened it. Written by
 * hand rather than with Radix: the theme and language controls live inside,
 * and a portalled dropdown in a focus trap is the case Radix makes awkward.
 *
 * `onClose` must be stable (a `useCallback`), or the effect re-runs.
 */
export function useMenuDialog(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    const trigger = triggerRef.current;
    lockPageScroll(true);
    focusables(panel)[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Tab") {
        trapTab(event, panel);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      lockPageScroll(false);
      trigger?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  return { panelRef, triggerRef };
}
