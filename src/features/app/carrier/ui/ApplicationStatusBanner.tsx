"use client";

import { useTranslations } from "next-intl";
import { BadgeCheck, Clock, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { qualifiedAccessModes } from "@/lib/active-access";
import { useAuth } from "@/lib/auth-context";
import type { CarrierApplication } from "../api/carrier.api";

/**
 * Where an application stands, in one line the applicant can act on.
 *
 * Lives in its own file because two screens need it: the application itself,
 * and the driver dashboard, which leads with it whenever someone is not yet
 * approved — that is the single most important thing on their home screen.
 *
 * A draft renders nothing. It is not a status the applicant is waiting on; it
 * is just an unfinished form, and the form below already says so.
 *
 * "Approved" is only claimed while the session can actually drive. An admin
 * can remove `carrier` and `driver` from an approved account, and production's
 * own admin was in exactly that state, reading « Vous êtes un chauffeur
 * approuvé » beside a switcher offering to add the access
 * (become_driver_spec.md §5). Waits for the session before deciding, so an
 * approved driver never sees the warning flash while it loads.
 */
export function ApplicationStatusBanner({
  application,
}: {
  application: CarrierApplication;
}) {
  const t = useTranslations("carrier.application.banner");
  const { user } = useAuth();
  const { status } = application;

  if (status === "draft") return null;

  const inactive =
    status === "approved" &&
    user !== null &&
    !qualifiedAccessModes(user.roles ?? []).includes("carrier");
  const copy = inactive ? "approvedInactive" : status;
  const failed = inactive || status === "rejected" || status === "suspended";
  const reason =
    status === "rejected"
      ? application.rejectionReason
      : status === "suspended"
        ? application.suspensionReason
        : null;

  return (
    <Alert variant={failed ? "destructive" : "default"}>
      {status === "approved" && !inactive ? (
        <BadgeCheck />
      ) : failed ? (
        <ShieldAlert />
      ) : (
        <Clock />
      )}
      <AlertTitle>{t(`${copy}.title`)}</AlertTitle>
      <AlertDescription>
        <p>{t(`${copy}.description`)}</p>
        {reason && (
          <p>
            {t("reasonLabel")}: {reason}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
