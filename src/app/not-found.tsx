"use client";

import Link from "next/link";
import { Compass } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";

/**
 * An address that leads nowhere. Without this file Next served its own
 * English « 404 — This page could not be found. », with nothing to press.
 *
 * A client component for the same reason `error.tsx` is: it renders inside the
 * root layout, whose providers carry the catalogue and the visitor's language.
 * The one button goes to `/`, which sends a signed-in visitor on to their own
 * home, so it is a way back for everyone.
 */
export default function NotFound() {
  const t = useTranslations("common.notFound");

  return (
    <CenteredEmptyState
      variant="page"
      icon={Compass}
      title={t("title")}
      description={t("description")}
    >
      <Button asChild>
        <Link href="/">{t("home")}</Link>
      </Button>
    </CenteredEmptyState>
  );
}
