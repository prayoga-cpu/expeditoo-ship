"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The browser Fullscreen API for the whole page — the header toolbox's
 * toggle. Ported from the sibling Epidom app.
 *
 * Includes the WebKit-prefixed calls: older iPadOS Safari (the main cashier
 * device) only had `webkitRequestFullscreen`. `supported` is false where there
 * is no API at all (iPhone Safari, some embedded webviews), so a caller can hide
 * its button instead of offering one that does nothing. It starts false and is
 * filled in after mount, so the server render and hydration agree.
 */
type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenEnabled?: boolean;
};
type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function fullscreenElement(): Element | null {
  const doc = document as WebkitDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const doc = document as WebkitDocument;
    const root = document.documentElement as WebkitElement;
    setSupported(
      typeof root.requestFullscreen === "function" ||
        typeof root.webkitRequestFullscreen === "function"
    );

    const sync = () => setIsFullscreen(!!fullscreenElement());
    sync();
    doc.addEventListener("fullscreenchange", sync);
    doc.addEventListener("webkitfullscreenchange", sync);
    return () => {
      doc.removeEventListener("fullscreenchange", sync);
      doc.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const toggle = useCallback(() => {
    const doc = document as WebkitDocument;
    const root = document.documentElement as WebkitElement;
    // Feature-checked, not just try/caught: where a method is undefined the call
    // throws *synchronously*, so a bare `.catch()` never runs and the TypeError
    // escapes the click handler. Promise.resolve() covers the prefixed calls,
    // which return nothing on older WebKit.
    try {
      if (fullscreenElement()) {
        const exit = doc.exitFullscreen?.bind(doc) ?? doc.webkitExitFullscreen?.bind(doc);
        void Promise.resolve(exit?.()).catch(() => {});
        return;
      }
      const enter = root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root);
      void Promise.resolve(enter?.()).catch(() => {});
    } catch {
      // Fullscreen refused (a policy block, an embedded webview). The page is
      // perfectly usable windowed.
    }
  }, []);

  return { isFullscreen, supported, toggle };
}
