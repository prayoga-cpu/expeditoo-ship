"use client";

import { useRouter } from "next/navigation";
import { useAccessMode } from "@/lib/access-mode-context";

/**
 * The one way to `/carrier/application` from the app shell — the nav
 * entries, the access switcher's « Devenir chauffeur » row and the
 * onboarding dialog all go through it (become_driver_spec.md §2).
 *
 * The mode is set before the push, never after:
 * - a driver-qualified account switches to Driver, so it lands on its
 *   application with the Driver nav rather than stranded in User mode;
 * - an account that cannot drive yet but is browsing as Admin switches to
 *   its first non-admin mode. The application renders in `MainLayout`, whose
 *   guard sends Admin mode straight back to `/admin/expedion` — which is how
 *   « Ajouter l'accès transporteur » used to flash the page and bounce;
 * - anyone else keeps their mode. Never `carrier` for an account that does
 *   not qualify: `resolveAccessMode` would drop it and fall back to the
 *   strongest mode, which for an admin is Admin, and that bounces too.
 */
export function useApplicationNav() {
  const router = useRouter();
  const { mode, qualifiedModes, setMode } = useAccessMode();

  return () => {
    if (qualifiedModes.includes("carrier")) {
      setMode("carrier");
    } else if (mode === "admin") {
      setMode(qualifiedModes.find((candidate) => candidate !== "admin") ?? "user");
    }
    router.push("/carrier/application");
  };
}
