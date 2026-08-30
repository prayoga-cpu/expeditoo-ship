"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import {
  HEAVY_BRACKET_ID,
  WEIGHT_BRACKET_IDS,
  type WeightBracketId,
} from "../cargo";
import type { JobFormApi } from "../hooks/useJobForm";
import { FieldError } from "./FieldError";

/**
 * Six cards instead of an empty spinner. Nobody knows what their sofa weighs,
 * and the old field answered that by underlining "must be greater than 0".
 *
 * The last card is the exception that keeps the freight case reachable: the DTO
 * accepts up to 44 t, so `over1000` asks for the figure rather than pretending
 * a ladder of chips can express one.
 */
export function WeightBracketField({ form }: { form: JobFormApi["form"] }) {
  const t = useTranslations("create.what");
  const { register, setValue, watch, formState } = form;
  const bracket = watch("weightBracket");

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{t("weight")}</legend>

      <RadioGroup
        value={bracket ?? ""}
        onValueChange={(value) =>
          setValue("weightBracket", value as WeightBracketId, {
            shouldValidate: true,
          })
        }
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {WEIGHT_BRACKET_IDS.map((id) => (
          <OptionCard
            key={id}
            id={`weight-${id}`}
            value={id}
            selected={bracket === id}
            label={t(`weightBrackets.${id}.label`)}
            hint={t(`weightBrackets.${id}.example`)}
          />
        ))}
      </RadioGroup>
      <FieldError message={formState.errors.weightBracket?.message} />

      {bracket === HEAVY_BRACKET_ID && (
        <div>
          <Label htmlFor="exactWeightKg">{t("weightExact")}</Label>
          <Input
            id="exactWeightKg"
            type="number"
            step="1"
            min={1000}
            {...register("exactWeightKg")}
          />
          <FieldError message={formState.errors.exactWeightKg?.message} />
        </div>
      )}
    </fieldset>
  );
}

/**
 * A radio that looks like a card. The input stays in the tree rather than being
 * replaced by a `<button>` so the group keeps radio semantics and arrow-key
 * navigation; `sr-only` hides it, and the focus ring moves to the card so a
 * keyboard user can still see where they are.
 */
export function OptionCard({
  id,
  value,
  selected,
  label,
  hint,
  detail,
}: {
  id: string;
  value: string;
  selected: boolean;
  label: string;
  hint: string;
  detail?: string;
}) {
  return (
    <Label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/40"
      )}
    >
      <RadioGroupItem id={id} value={value} className="sr-only" />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs font-normal text-muted-foreground">{hint}</span>
      {detail && (
        <span className="font-mono text-[11px] font-normal text-muted-foreground">
          {detail}
        </span>
      )}
    </Label>
  );
}
