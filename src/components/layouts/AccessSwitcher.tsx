"use client";

import { useState } from "react";
import { ChevronDown, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCarrierApplication } from "@/features/app/carrier/hooks/useCarrier";
import { DriverOnboardingDialog } from "@/features/app/carrier/ui/DriverOnboardingDialog";
import { useAuth } from "@/lib/auth-context";
import { type AccessMode } from "@/lib/active-access";
import { useActiveAccessMode } from "@/lib/use-active-access-mode";
import { cn } from "@/lib/utils";

/** Where switching to a mode lands. Both non-admin modes share `/home` —
 * which nav items render there is the switcher's business, not the route's;
 * see MainLayout.tsx and BottomNav.tsx. */
const MODE_LANDING: Record<AccessMode, string> = {
  user: "/home",
  carrier: "/home",
  admin: "/admin/expedion",
};

/** Loud for staff and driving access, quiet for the default — same intent as
 * the badge this replaces: an admin who forgot which access they are
 * browsing with is the whole reason this exists. */
const MODE_TONE: Record<AccessMode, string> = {
  admin: "bg-destructive/15 text-destructive border-destructive/30",
  carrier: "bg-success/15 text-success border-success/30",
  user: "bg-muted text-muted-foreground border-border",
};

/**
 * Which access the signed-in person is browsing with — and, for an account
 * that holds more than one, a way to switch.
 *
 * Roles come from the session (`customSession` in auth.ts reads `user_roles`
 * per request); the *mode* is a client-side preference on top of that
 * (active-access.ts) — switching never grants or revokes anything, it only
 * changes which nav this person sees. Renders nothing while the session is
 * loading or absent, rather than flashing a placeholder.
 */
export function AccessSwitcher({
  className,
  defaultOpen,
}: {
  className?: string;
  /** Opens the menu on mount rather than on click — jsdom in this repo's
   * test suite cannot dispatch the pointer sequence Radix opens on, so tests
   * render it already open instead (see radix-dialogs-in-jsdom in project
   * memory). Never passed in production. */
  defaultOpen?: boolean;
}) {
  const t = useTranslations("common.roles");
  const tSwitch = useTranslations("common.accessSwitcher");
  const tStatus = useTranslations("carrier.onboarding.status");
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { mode, qualifiedModes, setMode } = useActiveAccessMode();
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  // Only a genuinely multi-mode account gets a dropdown at all — an ordinary
  // single-role account already has « Devenir chauffeur » in the sidebar and
  // the mobile bar, and does not need its badge to turn into a control just
  // to repeat that entry.
  const interactive = qualifiedModes.length > 1;
  const canAddCarrier = interactive && !qualifiedModes.includes("carrier");
  const { data: application } = useCarrierApplication({ enabled: canAddCarrier });

  if (isLoading || !user) return null;

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 text-[10px] uppercase tracking-wide",
        MODE_TONE[mode],
        className
      )}
      title={t("hint")}
    >
      {t(mode)}
      {interactive && <ChevronDown className="h-2.5 w-2.5" />}
    </Badge>
  );

  if (!interactive) return badge;

  const handleSelect = (next: AccessMode) => {
    setMode(next);
    router.push(MODE_LANDING[next]);
  };

  // The dialog sits beside the menu, not inside it, and opens from
  // `onSelect`: the menu closes first, so focus is not handed back to its
  // trigger out from under the dialog. This row used to push straight to
  // /carrier/application without leaving Admin mode, and MainLayout bounced
  // that back to the panel (become_driver_spec.md §1.1).
  return (
    <>
      <DropdownMenu defaultOpen={defaultOpen}>
        <DropdownMenuTrigger
          aria-label={tSwitch("srLabel")}
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {badge}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {qualifiedModes.map((candidate) => (
            <DropdownMenuItem
              key={candidate}
              onClick={() => handleSelect(candidate)}
              className={cn(candidate === mode && "font-semibold")}
            >
              {t(candidate)}
            </DropdownMenuItem>
          ))}
          {canAddCarrier && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setOnboardingOpen(true)}>
                <Truck className="h-4 w-4 text-success" />
                {application ? tSwitch("myApplication") : tSwitch("becomeDriver")}
                {application && (
                  <span className="ml-auto pl-3 text-xs text-muted-foreground">
                    {tStatus(application.status)}
                  </span>
                )}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {canAddCarrier && (
        <DriverOnboardingDialog open={onboardingOpen} onOpenChange={setOnboardingOpen} />
      )}
    </>
  );
}
