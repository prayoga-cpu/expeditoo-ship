"use client";

import { useTranslations } from "next-intl";

import { illustrationSrc, type IllustrationKind } from "@/lib/illustrations";
import { cn } from "@/lib/utils";

/**
 * A built-in illustration standing in for a request's photo, always carrying
 * its label — never mistakable for the owner's own picture
 * (client feedback 2026-11-06, A07).
 */
export function IllustrationImage({
  kind,
  className,
  compact = false,
}: {
  kind: IllustrationKind;
  className?: string;
  /** A thumbnail: the label becomes a small ribbon over the picture's foot. */
  compact?: boolean;
}) {
  const t = useTranslations("create.illustration");
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <img src={illustrationSrc(kind)} alt={t(`kind.${kind}`)} className="h-full w-full object-cover" />
      <span
        className={cn(
          "absolute inset-x-0 bottom-0 bg-black/55 text-center font-medium text-white",
          compact ? "px-0.5 py-px text-[9px] leading-tight" : "px-2 py-0.5 text-xs"
        )}
      >
        {t("label")}
      </span>
    </div>
  );
}
