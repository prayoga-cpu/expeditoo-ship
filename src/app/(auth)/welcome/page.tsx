"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, PackagePlus, Truck } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { BrandMark } from "@/components/ui/brand-mark";
import { setStoredAccessMode, type AccessMode } from "@/lib/active-access";

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
  const [pending, setPending] = useState<AccessMode | null>(null);

  const choose = (mode: AccessMode, destination: string) => {
    setPending(mode);
    setStoredAccessMode(mode);
    router.push(destination);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-primary/10 via-background to-background py-8 px-4 overflow-hidden relative">
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="flex items-center justify-center gap-2 mb-8">
          <BrandMark size={40} />
          <span className="text-2xl font-bold text-foreground">EXPEDITOO</span>
        </div>

        <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-8">
          <h1 className="text-2xl font-bold text-foreground mb-2 text-center">
            {t("title")}
          </h1>
          <p className="text-muted-foreground mb-6 text-center">
            {t("subtitle")}
          </p>

          <div className="space-y-4">
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => choose("user", "/home")}
              className="w-full flex items-start gap-4 rounded-xl border border-border/50 bg-background/50 p-5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <PackagePlus className="h-6 w-6" />
              </span>
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
              className="w-full flex items-start gap-4 rounded-xl border border-border/50 bg-background/50 p-5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <Truck className="h-6 w-6" />
              </span>
              <span>
                <span className="block font-semibold text-foreground">
                  {t("driveTitle")}
                </span>
                <span className="block text-sm text-muted-foreground mt-1">
                  {t("driveDescription")}
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-success mt-3">
                  {t("driveCta")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
