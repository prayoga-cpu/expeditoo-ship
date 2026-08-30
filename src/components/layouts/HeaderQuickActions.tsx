"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PackagePlus, Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

/**
 * The two things a driver came here to do, in the header chrome.
 *
 * Modelled on Cocolis, whose header carries its primary verbs ("Expédier ou
 * recevoir un colis", "Voir les annonces") beside the account controls rather
 * than leaving the bar empty. Ours had a logo on the left and three utility
 * controls on the right with nothing between them, while posting a request was
 * reachable only from the sidebar — which does not exist below `xl`.
 *
 * Gated on driver access, so an applicant who has not been approved yet is not
 * shown a board they cannot bid on. `carrier` counts as `driver`: approval
 * grants both (`carrier.service.ts`) and they are one person here — the same
 * collapse `primaryRole` makes. Deliberately not `primaryRole` itself, which
 * answers "which label do we print" and would hide these from an admin who is
 * also an approved driver.
 */
const ACTIONS = [
  // Distinct glyphs on purpose. The sidebar draws jobs with a PlusCircle,
  // which sits fine under a text label in a vertical list but reads as a
  // second "create" button next to PackagePlus at header size — post and
  // browse are opposite intents and must not look like one control.
  { href: "/create", labelKey: "requestTransport", icon: PackagePlus },
  { href: "/expedion", labelKey: "jobs", icon: Search },
] as const;

export function HeaderQuickActions() {
  const pathname = usePathname();
  const t = useTranslations("common.navigation");
  const { user, isLoading } = useAuth();

  const roles = user?.roles ?? [];
  const isDriver = roles.includes("driver") || roles.includes("carrier");

  // Nothing while the session resolves: two buttons that appear a beat after
  // the header paints shove the language toggle sideways under the cursor.
  if (isLoading || !isDriver) return null;

  return (
    <>
      <div className="flex min-w-0 items-center gap-0.5">
        {ACTIONS.map(({ href, labelKey, icon: Icon }) => {
          const isActive = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              // The label is the accessible name in both layouts — below `md`
              // the button is the icon alone, and an icon with no name is a
              // button nobody can find by voice or by screen reader.
              aria-label={t(labelKey)}
              title={t(labelKey)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors md:px-3",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden truncate md:inline">{t(labelKey)}</span>
            </Link>
          );
        })}
      </div>
      {/* Carried here rather than in the header so the rule disappears with
          the buttons instead of hanging beside the language toggle alone. */}
      <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />
    </>
  );
}
