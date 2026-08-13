"use client";

import React, { useEffect, useRef } from "react";
// @ts-ignore
import type { PWAInstallElement } from "@khmyznikov/pwa-install";

// The <pwa-install> JSX typing ships with @khmyznikov/pwa-install; declaring
// a second one here collides with it.

export function PWAInstall() {
  const pwaInstallRef = useRef<PWAInstallElement | null>(null);

  useEffect(() => {
    // Dynamic import to ensure it only runs on client and after mount
    import("@khmyznikov/pwa-install");
  }, []);

  return (
    <pwa-install
      ref={pwaInstallRef}
      manifest-url="/manifest.webmanifest"
      name="Expeditoo"
      description="Install Expeditoo for a better experience: real-time updates, offline access, and faster loading."
      icon="/icons/icon-192x192.png"
      manual-apple="true"
    ></pwa-install>
  );
}
