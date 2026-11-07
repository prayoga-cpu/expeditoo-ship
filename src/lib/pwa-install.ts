"use client";

import { useSyncExternalStore } from "react";

/**
 * One answer to "is this running as an installed app, and can I open the
 * installer?" for every button in the chrome.
 *
 * The `<pwa-install>` element mounted by `PWAInstall` owns the install
 * experience — one tap where the browser exposes `beforeinstallprompt`,
 * illustrated steps where it does not (iOS Safari). Buttons only ask it to open
 * its dialog. Pattern ported from the sibling Epidom app.
 *
 * `null` means "not determined yet": it is the state the server renders, so a
 * button gated on it appears after hydration instead of flashing in the wrong
 * state for a frame.
 */
type InstallElement = HTMLElement & { showDialog?: (force?: boolean) => void };

let installElement: InstallElement | null = null;
let standalone: boolean | null = null;
const subscribers = new Set<() => void>();

function detectStandalone() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    // iOS Safari reports none of the above for a home-screen launch.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function refresh() {
  const next = detectStandalone();
  if (next === standalone) return;
  standalone = next;
  subscribers.forEach((fn) => fn());
}

function subscribe(onChange: () => void) {
  subscribers.add(onChange);
  if (standalone === null) refresh();
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("appinstalled", refresh);
  return () => {
    subscribers.delete(onChange);
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("appinstalled", refresh);
  };
}

/** Called by `PWAInstall` when its element mounts and unmounts. */
export function registerInstallElement(el: InstallElement | null) {
  installElement = el;
}

/**
 * Force-open the installer. `showDialog(true)` opens even where the browser has
 * no install prompt, so a tap never silently does nothing.
 */
export async function showPwaInstallDialog() {
  await customElements.whenDefined("pwa-install").catch(() => undefined);
  installElement?.showDialog?.(true);
}

export function usePwaInstaller() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => standalone,
    () => null
  );
  return {
    /** Already running as an installed app. Assumed true until known. */
    isStandalone: snapshot ?? true,
    showInstallDialog: showPwaInstallDialog,
  };
}
