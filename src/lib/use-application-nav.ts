"use client";

import { useRouter } from "next/navigation";
import { useAccessMode } from "@/lib/access-mode-context";

/**
 * Reaching "My application" flips the access mode to Driver first, the same
 * way picking it from the switcher does — so a driver-qualified person who
 * clicks it from the User nav lands on the application in Driver mode, not
 * stranded in User mode looking at a Driver-only concern.
 *
 * A person who has not yet applied holds only the `user` mode — there is
 * nothing to switch to for them (`qualifiedAccessModes` never includes
 * `carrier` before the `carrier`/`driver` role exists), so this is a no-op
 * mode change and a plain navigation, which is already the only path this
 * population has to `/carrier/application`.
 */
export function useApplicationNav() {
  const router = useRouter();
  const { qualifiedModes, setMode } = useAccessMode();

  return () => {
    if (qualifiedModes.includes("carrier")) setMode("carrier");
    router.push("/carrier/application");
  };
}
