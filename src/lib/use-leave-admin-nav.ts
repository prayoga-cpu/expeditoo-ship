"use client";

import { useRouter } from "next/navigation";
import { useAccessMode } from "@/lib/access-mode-context";

/**
 * A push from the back office to a page of the ordinary app — a message
 * thread, a job page (admin_user_management_spec.md §7.5).
 *
 * Those pages render in `MainLayout`, whose guard sends Admin mode straight
 * back to `/admin/expedion`. « Message » on the staff view of a profile did
 * exactly that: the conversation was created, the thread flashed and the
 * admin was bounced, leaving an empty conversation behind. So the mode is
 * left **before** the push, the same order `useApplicationNav` keeps and for
 * the same reason — set it after and the guard wins the race.
 *
 * Any other mode is left alone, and so is an account with nowhere else to
 * be. `AdminLayout` re-arms Admin mode only on its own mount, so nothing
 * bounces the visitor back; returning to the panel is the switcher's job.
 */
export function useLeaveAdminNav() {
  const router = useRouter();
  const { mode, qualifiedModes, setMode } = useAccessMode();

  return (href: string) => {
    if (mode === "admin") {
      setMode(qualifiedModes.find((candidate) => candidate !== "admin") ?? "user");
    }
    router.push(href);
  };
}
