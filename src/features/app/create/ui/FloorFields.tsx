"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { NumericInput, useNumericText } from "@/components/ui/numeric-input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { NUMERIC_RULES } from "@/lib/numeric-input";
import { floorRequired, hasFloors, liftRequired } from "@/lib/location-types";
import type { Side } from "../address-book";
import type { JobFormApi } from "../hooks/useJobForm";
import { FieldError } from "./FieldError";

/**
 * The floor of one end, and its lift (client_feedback_2026_10_31_spec.md §3):
 * shown for every place with floors, required on an apartment and on any such
 * place in a move. The lift is a « Oui / Non » asked from the first floor up —
 * a switch could not say « non » until it had been switched on and off again,
 * and a ground floor has nothing to climb.
 */
export function FloorFields({ form, side }: { form: JobFormApi["form"]; side: Side }) {
  const t = useTranslations("create.where");
  const { setValue, watch, formState } = form;
  const endpoint = watch(side);
  const isMoving = watch("jobKind") === "moving";
  const error = formState.errors[side];
  const type = endpoint?.locationType;
  if (!hasFloors(type)) return null;

  const floor = typeof endpoint?.floor === "number" ? endpoint.floor : undefined;
  const lift = endpoint?.hasLift;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor={`${side}-floor`} required={floorRequired(type, isMoving)}>
          {t("floor")}
        </Label>
        <FloorInput
          id={`${side}-floor`}
          value={endpoint?.floor}
          onChange={(next) => {
            setValue(`${side}.floor`, next, { shouldValidate: Boolean(error?.floor) });
            // A ground floor has no lift to ask about; nor does no floor.
            if (next === undefined || next < 1) setValue(`${side}.hasLift`, undefined);
          }}
        />
        <p className="mt-1 text-xs text-muted-foreground">{t("floorHint")}</p>
        <FieldError message={error?.floor?.message} />
      </div>

      {floor !== undefined && floor >= 1 && (
        <div>
          <Label id={`${side}-lift-label`} required={liftRequired(type, isMoving, floor)}>
            {t("lift")}
          </Label>
          <ToggleGroup
            type="single"
            variant="outline"
            aria-labelledby={`${side}-lift-label`}
            className="mt-1 w-full"
            value={lift === undefined ? "" : lift ? "yes" : "no"}
            // Radix answers "" when the pressed item is pressed again; an
            // answer given stays given.
            onValueChange={(next) => {
              if (!next) return;
              setValue(`${side}.hasLift`, next === "yes", {
                shouldValidate: Boolean(error?.hasLift),
              });
            }}
          >
            <ToggleGroupItem value="yes">{t("liftYes")}</ToggleGroupItem>
            <ToggleGroupItem value="no">{t("liftNo")}</ToggleGroupItem>
          </ToggleGroup>
          <FieldError message={error?.hasLift?.message} />
        </div>
      )}
    </div>
  );
}

/**
 * An apartment's floor: a number in the form, its own text in the box
 * (numeric_input_spec.md §6). A deletion keeps the zeros it exposes, and
 * « 00 » is a text no number reads back as: re-derived from the floor, the
 * box was rewritten to « 0 » with the caret thrown to the end, so « 100 »
 * with its « 1 » deleted and a « 2 » typed in its place gave floor 2, not
 * 200 (found in review).
 */
function FloorInput({
  id,
  value,
  onChange,
}: {
  id: string;
  /**
   * The form's floor, typed `unknown` as every preprocessed field is
   * (numeric_input_spec.md §7): a number, or `undefined`.
   */
  value: unknown;
  onChange: (floor: number | undefined) => void;
}) {
  const field = useNumericText(value, (floor) =>
    floor == null ? "" : String(floor)
  );
  return (
    <NumericInput
      id={id}
      rules={NUMERIC_RULES.COUNT}
      value={field.text}
      onChange={(e) => {
        const text = e.target.value;
        const floor = text === "" ? undefined : Number(text);
        field.typed(text, floor);
        onChange(floor);
      }}
    />
  );
}
