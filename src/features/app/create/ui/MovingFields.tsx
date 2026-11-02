"use client";

import { ArrowRight, Package, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { Textarea } from "@/components/ui/textarea";
import { NUMERIC_RULES } from "@/lib/numeric-input";
import type { JobKind } from "@/lib/moving";
import type { JobFormApi } from "../hooks/useJobForm";
import { FieldError } from "./FieldError";
import { PackagingField } from "./PackagingField";
import { PhotoDropzone } from "./PhotoDropzone";
import { ToggleRow } from "./ToggleRow";

/**
 * « Vous déménagez ? Cliquez plutôt ici ! » — the way from items to a move,
 * and back (client_feedback_2026_10_31_spec.md §2.2). A link in a band rather
 * than a tab: most requests are items, and the client's reference puts it
 * exactly here.
 */
export function JobKindLink({
  kind,
  onChange,
}: {
  kind: JobKind;
  onChange: (kind: JobKind) => void;
}) {
  const t = useTranslations("create.moving.switch");
  const moving = kind === "moving";
  const Icon = moving ? Package : Truck;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <span>{t(moving ? "toItemsQuestion" : "toMovingQuestion")}</span>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto gap-1 p-0 has-[>svg]:px-0 font-semibold"
        onClick={() => onChange(moving ? "items" : "moving")}
      >
        {t(moving ? "toItems" : "toMoving")}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  );
}

/**
 * « Description du déménagement »: photos, the home's surface — or its volume
 * once « Je connais le volume exact » is on — what else the movers should
 * know, and the packaging. Nothing about items: a move is one load, sized by
 * the home (spec §2.2).
 */
export function MovingFields({
  form,
  photos,
  onPhotosChange,
}: {
  form: JobFormApi["form"];
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
}) {
  const t = useTranslations("create.moving");
  const tWhat = useTranslations("create.what");
  const { register, formState, setValue, watch } = form;
  const errors = formState.errors;
  const byVolume = watch("movingSizeMode") === "volume";

  return (
    <div className="space-y-5">
      <h2 className="font-semibold">{t("heading")}</h2>

      <div>
        <Label>{tWhat("photos")}</Label>
        <p className="mb-2 mt-1 text-xs text-muted-foreground">{t("photosHint")}</p>
        <PhotoDropzone photos={photos} onPhotosChange={onPhotosChange} />
      </div>

      <ToggleRow
        id="movingExactVolume"
        label={t("exactVolume")}
        description={t("exactVolumeHint")}
        checked={byVolume}
        onChange={(on) => setValue("movingSizeMode", on ? "volume" : "surface")}
      />

      {/* The form holds each box's text; the schema reads it
          (numeric_input_spec.md §7). */}
      {byVolume ? (
        <div>
          <Label htmlFor="movingVolumeM3" required>
            {t("volume")}
          </Label>
          <NumericInput
            id="movingVolumeM3"
            rules={NUMERIC_RULES.VOLUME}
            placeholder={t("volumePlaceholder")}
            {...register("movingVolumeM3")}
          />
          <FieldError message={errors.movingVolumeM3?.message} />
        </div>
      ) : (
        <div>
          <Label htmlFor="movingSurfaceM2" required>
            {t("surface")}
          </Label>
          <NumericInput
            id="movingSurfaceM2"
            rules={NUMERIC_RULES.AREA}
            placeholder={t("surfacePlaceholder")}
            {...register("movingSurfaceM2")}
          />
          <FieldError message={errors.movingSurfaceM2?.message} />
        </div>
      )}

      <div>
        <Label htmlFor="description">{t("detailsLabel")}</Label>
        <Textarea
          id="description"
          rows={4}
          placeholder={t("detailsPlaceholder")}
          {...register("description")}
        />
        <p className="mt-1 text-xs text-muted-foreground">{t("publicNote")}</p>
        <FieldError message={errors.description?.message} />
      </div>

      <PackagingField form={form} />
    </div>
  );
}
