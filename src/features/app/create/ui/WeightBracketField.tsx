"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  HEAVY_BRACKET_ID,
  UNSURE_BRACKET_ID,
  WEIGHT_BRACKET_IDS,
  type WeightBracketId,
} from "../cargo";
import type { JobFormApi } from "../hooks/useJobForm";
import type { FieldErrors } from "react-hook-form";
import type { JobFormValues } from "../schemas";
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
      <legend className="text-sm font-medium">
        {t("weight")} <span aria-hidden="true" className="text-destructive">*</span>
      </legend>

      <RadioGroup
        value={bracket ?? ""}
        onValueChange={(value) => {
          setValue("weightBracket", value as WeightBracketId, {
            shouldValidate: true,
          });
          // A figure typed for the bracket just left behind must not survive
          // onto the new one — see the comment on `resolveWeightKg`.
          setValue("exactWeightKg", undefined);
        }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
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
        <WeightExactInput
          label={t("weightExact")}
          required
          minKg={1000}
          value={watch("exactWeightKg") as number | undefined}
          onChange={(kg) => setValue("exactWeightKg", kg, { shouldValidate: true })}
          errors={formState.errors}
        />
      )}

      {/* A bracket is a category; this is the real figure inside it, for
          whoever has it to hand. `notSure` is the one bracket that says the
          opposite, so it gets no field to contradict itself with, and
          `over1000` already has its own required one above. */}
      {bracket && bracket !== HEAVY_BRACKET_ID && bracket !== UNSURE_BRACKET_ID && (
        <WeightExactInput
          label={t("weightExactOptional")}
          minKg={1}
          value={watch("exactWeightKg") as number | undefined}
          onChange={(kg) => setValue("exactWeightKg", kg, { shouldValidate: true })}
          errors={formState.errors}
        />
      )}
    </fieldset>
  );
}

const WEIGHT_UNITS = ["kg", "t"] as const;
type WeightUnit = (typeof WEIGHT_UNITS)[number];

/**
 * The figure is always stored and validated in kilograms — `weightKg` is what
 * the DTO has always wanted, and `exactWeightKg`'s `.max(44_000)` is written
 * in kg — so the unit toggle only ever converts at the edges. `unit` is local
 * display state, never sent anywhere: switching it re-renders the same kg
 * value in the other scale rather than mutating what's stored.
 */
function WeightExactInput({
  label,
  required,
  minKg,
  value,
  onChange,
  errors,
}: {
  label: string;
  required?: boolean;
  minKg: number;
  value: number | undefined;
  onChange: (kg: number | undefined) => void;
  errors: FieldErrors<JobFormValues>;
}) {
  const t = useTranslations("create.what");
  const [unit, setUnit] = useState<WeightUnit>("kg");
  const toDisplay = (kg: number | undefined) =>
    kg === undefined ? "" : String(unit === "t" ? kg / 1000 : kg);

  return (
    <div className="space-y-1.5">
      <Label htmlFor="exactWeightKg" required={required}>
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          id="exactWeightKg"
          type="number"
          step={unit === "t" ? "0.001" : "1"}
          min={unit === "t" ? minKg / 1000 : minKg}
          value={toDisplay(value)}
          onChange={(e) => {
            const typed = e.target.value === "" ? undefined : Number(e.target.value);
            onChange(
              typed === undefined || Number.isNaN(typed)
                ? undefined
                : unit === "t"
                  ? typed * 1000
                  : typed
            );
          }}
          className="flex-1"
        />
        <Select value={unit} onValueChange={(next) => setUnit(next as WeightUnit)}>
          <SelectTrigger className="w-20" aria-label={t("weightUnit.label")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WEIGHT_UNITS.map((u) => (
              <SelectItem key={u} value={u}>
                {t(`weightUnit.${u}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <FieldError message={errors.exactWeightKg?.message} />
    </div>
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
        "flex min-h-[92px] cursor-pointer flex-col items-start justify-center gap-1 rounded-lg border p-4 text-left transition-colors",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        selected
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/40"
      )}
    >
      <RadioGroupItem id={id} value={value} className="sr-only" />
      <span className="text-base font-medium">{label}</span>
      <span className="text-sm font-normal text-muted-foreground">{hint}</span>
      {detail && (
        <span className="font-mono text-xs font-normal text-muted-foreground">
          {detail}
        </span>
      )}
    </Label>
  );
}
