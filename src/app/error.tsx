"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";

/**
 * Catches any render error that escapes a page or a component, anywhere
 * under the root layout. Nothing else did: a single bad row of data (an
 * unexpected shape in a jsonb column, say) used to blank the entire app with
 * Next's default crash screen instead of leaving the rest of the UI usable.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common.errors");

  useEffect(() => {
    console.error("[app] unhandled render error", error);
  }, [error]);

  return (
    <CenteredEmptyState variant="page" icon={AlertTriangle} title={t("generic")}>
      <Button onClick={() => reset()}>{t("tryAgain")}</Button>
    </CenteredEmptyState>
  );
}
