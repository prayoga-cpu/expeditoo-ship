"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * « Retour » for a page reached from another one. Goes back in history when
 * there is some, and to `fallbackHref` when the page was opened cold (a link in
 * an email, a new tab) — a back button that does nothing is a dead end
 * (no_dead_ends_spec.md).
 */
export function BackButton({
  fallbackHref,
  className,
}: {
  fallbackHref: string;
  className?: string;
}) {
  const router = useRouter();
  const t = useTranslations("common.buttons");

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("-ml-2 gap-1.5 text-muted-foreground", className)}
      onClick={() =>
        window.history.length > 1 ? router.back() : router.push(fallbackHref)
      }
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {t("back")}
    </Button>
  );
}
