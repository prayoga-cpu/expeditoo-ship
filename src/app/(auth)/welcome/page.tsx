"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, PackagePlus, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import { AuthShell } from "@/features/auth/ui";

import { useAuth } from "@/lib/auth-context";
import {
  hasDriverAccess,
  setStoredAccessMode,
  type AccessMode,
} from "@/lib/active-access";

/**
 * The first thing a brand-new account sees, right after signup — both the
 * email/password path (verify-email/page.tsx) and a first-time Google
 * sign-in (useAuthActions.ts' newUserCallbackURL) land here.
 *
 * Picking a focus sets the client-side access-mode preference the sidebar
 * switcher reads (active-access.ts) — a hint, not a grant. It never blocks
 * on a role that does not exist yet: "drive and earn" sends the visitor
 * straight into the existing KYC application, the only real way to become a
 * carrier (roles_spec.md §2 — never self-granted).
 */
export default function WelcomePage() {
  const router = useRouter();
  const t = useTranslations("auth.welcome");
  const { user } = useAuth();
  const [pending, setPending] = useState<AccessMode | null>(null);

  const choose = (mode: AccessMode, destination: string) => {
    setPending(mode);
    // Looking at « Expédier » must not park someone who already drives on a
    // nav with no board: the hint is only stored when it cannot do that.
    if (!(mode === "user" && hasDriverAccess(user?.roles ?? []))) {
      setStoredAccessMode(mode);
    }
    router.push(destination);
  };

  return (
    <AuthShell>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {t("title")}
          </h1>
          <p className="text-muted-foreground mb-6">
            {t("subtitle")}
          </p>

          <div className="space-y-4">
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => choose("user", "/home")}
              className="w-full flex items-start gap-4 rounded-lg border border-border p-5 text-left transition-colors hover:border-foreground/40 hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PackagePlus className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="block font-semibold text-foreground">
                  {t("shipTitle")}
                </span>
                <span className="block text-sm text-muted-foreground mt-1">
                  {t("shipDescription")}
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary mt-3">
                  {t("shipCta")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </span>
            </button>

            <button
              type="button"
              disabled={pending !== null}
              onClick={() => choose("carrier", "/carrier/application")}
              className="w-full flex items-start gap-4 rounded-lg border border-border p-5 text-left transition-colors hover:border-foreground/40 hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Truck className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="block font-semibold text-foreground">
                  {t("driveTitle")}
                </span>
                <span className="block text-sm text-muted-foreground mt-1">
                  {t("driveDescription")}
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary mt-3">
                  {t("driveCta")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </span>
            </button>
          </div>
    </AuthShell>
  );
}
