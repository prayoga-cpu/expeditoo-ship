"use client";

import { useTranslations } from "next-intl";

import { ChangelogView, MarketingPageShell } from "@/features/marketing/ui";
import type { ReleaseDTO } from "@/server/services/changelog.service";

/**
 * The client half of `/changelog`.
 *
 * It exists only so the page above can stay a server component that reads
 * `CHANGELOG.md` at build time while the copy still resolves through
 * `useTranslations` — `MarketingPageShell` is a client component, and the intl
 * provider is not mounted on the server.
 */
export function ChangelogShell({ releases }: { releases: ReleaseDTO[] }) {
  const t = useTranslations("marketing.changelog");

  return (
    <MarketingPageShell
      eyebrow={t("eyebrow")}
      title={t("title")}
      intro={t("intro")}
    >
      <ChangelogView releases={releases} />
    </MarketingPageShell>
  );
}
