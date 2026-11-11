"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  ILLUSTRATION_KINDS,
  guessIllustration,
  illustrationSrc,
  type IllustrationKind,
} from "@/lib/illustrations";
import { cn } from "@/lib/utils";
import type { JobFormApi } from "../hooks/useJobForm";

/**
 * With no photo, offer one of four generic illustrations — and use it only if
 * the requester ticks the box (client feedback 2026-11-06, A07). It is a picture
 * of the kind of thing, not of their object, and says so wherever it appears.
 * Adding a real photo withdraws it.
 */
export function IllustrationField({
  form,
  photos,
}: {
  form: JobFormApi["form"];
  photos: string[];
}) {
  const t = useTranslations("create.illustration");
  const title = (form.watch("title") as string | undefined) ?? "";
  const description = (form.watch("description") as string | undefined) ?? "";
  const accepted = (form.watch("illustration") as IllustrationKind | "" | undefined) || "";

  const suggested = guessIllustration(title, description);
  const [picked, setPicked] = useState<IllustrationKind | null>(null);
  const kind = picked ?? suggested;

  // A real photo always wins; an illustration never sits beside one.
  useEffect(() => {
    if (photos.length > 0 && accepted) form.setValue("illustration", "");
  }, [photos.length, accepted, form]);

  if (photos.length > 0 || title.trim().length < 2) return null;

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-3">
      <div>
        <p className="text-sm font-medium">{t("title")}</p>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("choose")}>
        {ILLUSTRATION_KINDS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={kind === option}
            onClick={() => {
              setPicked(option);
              if (accepted) form.setValue("illustration", option);
            }}
            className={cn(
              "relative h-16 w-16 overflow-hidden rounded-lg border-2 transition-colors",
              kind === option ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
            )}
          >
            <img src={illustrationSrc(option)} alt={t(`kind.${option}`)} className="h-full w-full" />
          </button>
        ))}
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="accept-illustration"
          checked={accepted !== ""}
          onCheckedChange={(checked) => form.setValue("illustration", checked === true ? kind : "")}
          className="mt-0.5"
        />
        <Label htmlFor="accept-illustration" className="cursor-pointer text-sm font-normal leading-snug">
          {t("consent")}
        </Label>
      </div>
    </div>
  );
}
