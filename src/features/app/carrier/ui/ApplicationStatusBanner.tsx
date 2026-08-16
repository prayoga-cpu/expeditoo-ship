"use client";

import { useTranslations } from "next-intl";
import { BadgeCheck, Clock, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
 */
export function ApplicationStatusBanner({
  application,
}: {
  application: CarrierApplication;
}) {
  const t = useTranslations("carrier.application.banner");
  const { status } = application;

  if (status === "draft") return null;

  const failed = status === "rejected" || status === "suspended";
  const reason =
    status === "rejected"
      ? application.rejectionReason
      : status === "suspended"
        ? application.suspensionReason
        : null;

  return (
    <Alert variant={failed ? "destructive" : "default"}>
      {status === "approved" ? (
        <BadgeCheck />
      ) : failed ? (
        <ShieldAlert />
      ) : (
        <Clock />
      )}
      <AlertTitle>{t(`${status}.title`)}</AlertTitle>
      <AlertDescription>
        <p>{t(`${status}.description`)}</p>
        {reason && (
          <p>
            {t("reasonLabel")}: {reason}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
