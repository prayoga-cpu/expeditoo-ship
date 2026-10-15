"use client";

import { useTranslations } from "next-intl";
import { IdCard } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineLoader } from "@/components/ui/page-loader";
import { useStaffContactDetails } from "../hooks/useContactDetails";
import { ContactSummary } from "./ContactDetailsCard";

/**
 * An account's « Coordonnées personnelles », for staff looking at it from the
 * admin panel (client_feedback_2026_10_spec.md §7b). Only the admin pages
 * mount it; the endpoint refuses anyone who is not admin or operator anyway.
 */
export function StaffContactCard({ userId }: { userId: string }) {
  const t = useTranslations("profile.contact");
  const { data, isLoading, isError } = useStaffContactDetails(userId, true);

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <IdCard className="h-5 w-5 text-primary" />
          {t("staffTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <InlineLoader size="md" className="h-16" />
        ) : isError || !data ? (
          <p className="text-sm text-destructive">{t("loadError")}</p>
        ) : (
          <ContactSummary details={data} />
        )}
      </CardContent>
    </Card>
  );
}
