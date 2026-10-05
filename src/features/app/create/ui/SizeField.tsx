"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { RadioGroup } from "@/components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { NUMERIC_RULES } from "@/lib/numeric-input";
import {
  SIZE_MODES,
  SIZE_PRESET_DIMENSIONS,
  SIZE_PRESET_IDS,
  type SizeMode,
  type SizePresetId,
} from "../cargo";
import type { JobFormApi } from "../hooks/useJobForm";
import { FieldError } from "./FieldError";
import { OptionCard } from "./WeightBracketField";

/**
 * Size, asked two ways: a standard format for someone who knows their sofa is
 * sofa-sized, three fields for someone holding a tape measure. Both are
 * optional, as dimensions have always been.
 *
 * Each preset card shows the centimetres it resolves to, so what the driver
 * will read is never hidden from the person choosing it.
 */
export function SizeField({ form }: { form: JobFormApi["form"] }) {
  const t = useTranslations("create.what");
  const { register, setValue, watch, formState } = form;
  const mode = (watch("sizeMode") ?? "preset") as SizeMode;
  const preset = watch("sizePreset");

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{t("size")}</legend>
      <p className="text-xs text-muted-foreground">{t("sizeSkipHint")}</p>

      <ToggleGroup
        type="single"
        variant="outline"
        value={mode}
        // Radix clears the value when the active item is pressed again; a mode
        // has to be one or the other, so an empty result keeps the current one.
        onValueChange={(next) =>
          setValue("sizeMode", (next || mode) as SizeMode)
        }
        className="w-full"
      >
        {SIZE_MODES.map((id) => (
          <ToggleGroupItem key={id} value={id} className="flex-1">
            {t(`sizeModes.${id}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {mode === "preset" ? (
        <RadioGroup
          value={preset ?? ""}
          onValueChange={(value) =>
            setValue("sizePreset", value as SizePresetId)
          }
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {SIZE_PRESET_IDS.map((id) => {
            const { lengthCm, widthCm, heightCm } = SIZE_PRESET_DIMENSIONS[id];
            return (
              <OptionCard
                key={id}
                id={`size-${id}`}
                value={id}
                selected={preset === id}
                label={t(`sizePresets.${id}.label`)}
                hint={t(`sizePresets.${id}.example`)}
                detail={t("sizeUpTo", { lengthCm, widthCm, heightCm })}
              />
            );
          })}
        </RadioGroup>
      ) : (
        // The form holds each box's text, « 45,5 » included; the schema
        // reads it (numeric_input_spec.md §7).
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="lengthCm">{t("length")}</Label>
            <NumericInput
              id="lengthCm"
              rules={NUMERIC_RULES.CM}
              {...register("lengthCm")}
            />
          </div>
          <div>
            <Label htmlFor="widthCm">{t("width")}</Label>
            <NumericInput
              id="widthCm"
              rules={NUMERIC_RULES.CM}
              {...register("widthCm")}
            />
          </div>
          <div>
            <Label htmlFor="heightCm">{t("height")}</Label>
            <NumericInput
              id="heightCm"
              rules={NUMERIC_RULES.CM}
              {...register("heightCm")}
            />
          </div>
        </div>
      )}

      <FieldError message={formState.errors.lengthCm?.message} />
      <p className="text-xs text-muted-foreground">{t("sizeHint")}</p>
    </fieldset>
  );
}
