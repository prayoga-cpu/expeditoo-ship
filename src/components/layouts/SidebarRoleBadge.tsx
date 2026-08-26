"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { primaryRole, type PrimaryRole } from "@/lib/primary-role";
import { cn } from "@/lib/utils";

/**
 * How loud each label is.
 *
 * Staff access is the thing worth noticing — an admin who has forgotten they
 * are signed in as an admin is the whole reason this badge exists — so the
 * back-office roles carry colour and the ordinary ones stay quiet. Tokens, not
 * raw colours, so both themes are covered.
 */
const TONE: Record<PrimaryRole, string> = {
  admin: "bg-destructive/15 text-destructive border-destructive/30",
  finance: "bg-warning/15 text-warning border-warning/30",
  support: "bg-warning/15 text-warning border-warning/30",
  operator: "bg-primary/15 text-primary border-primary/30",
  driver: "bg-success/15 text-success border-success/30",
  carrier: "bg-success/15 text-success border-success/30",
  shipper: "bg-muted text-muted-foreground border-border",
  user: "bg-muted text-muted-foreground border-border",
};

/**
 * Which access the signed-in person is browsing with.
 *
 * Roles come from the session (`customSession` in auth.ts reads `user_roles`
 * per request), so a granted or revoked role shows up on the next session
 * refresh without a round trip of its own — the same source the admin entry in
 * the app sidebar already trusts.
 *
 * Renders nothing while the session is loading or absent, rather than flashing
 * a placeholder role: a badge that says "User" for a moment and then "Admin"
 * is worse than one that arrives a beat late.
 */
export function SidebarRoleBadge({ className }: { className?: string }) {
  const t = useTranslations("common.roles");
  const { user, isLoading } = useAuth();

  if (isLoading || !user) return null;

  const role = primaryRole(user.roles ?? []);

  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] uppercase tracking-wide", TONE[role], className)}
      title={t("hint")}
    >
      {t(role)}
    </Badge>
  );
}
