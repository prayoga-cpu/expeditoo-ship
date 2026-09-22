"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FieldError } from "./FieldError";
import { forInput } from "../timing";
import { PUBLISH_MODES, type PublishMode } from "../schemas";
import type { JobFormApi } from "../hooks/useJobForm";

/**
 * Lead time before a schedule is offered at all: enough that the value
 * survives the round trip to the server without landing in the past under
 * ordinary clock skew.
 */
const MIN_SCHEDULE_LEAD_MS = 5 * 60 * 1000;

/**
 * "Publish now" or "schedule for later" — the last choice in `/create`.
 *
 * Not built on `TimingField.tsx`: that machinery turns a day plus a time-of-
 * day preference into an arrival *window*, a different shape from "one
 * precise instant". A plain native `datetime-local` input, registered
 * directly on the form the same way `budgetEuros` is, gets the platform's
 * own picker for free.
 */
export function PublishTimingField({ form }: { form: JobFormApi["form"] }) {
  const t = useTranslations("create.budget.publish");
  const { register, watch, setValue, formState } = form;
  const mode = watch("publishMode");
  const minLocal = forInput(Date.now() + MIN_SCHEDULE_LEAD_MS);

  return (
    <div className="space-y-3 border-t border-border pt-5">
      <Label>{t("label")}</Label>
      <ToggleGroup
        type="single"
        variant="outline"
        value={mode}
        onValueChange={(next) => {
          if (!next) return;
          setValue("publishMode", next as PublishMode, {
            shouldValidate: true,
          });
          if (next === "now") setValue("scheduledPublishAt", "");
        }}
        className="w-full"
      >
        {PUBLISH_MODES.map((publishMode) => (
          <ToggleGroupItem key={publishMode} value={publishMode} className="flex-1">
            {t(publishMode)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {mode === "schedule" && (
        <div>
          <Label htmlFor="scheduledPublishAt">{t("pickerLabel")}</Label>
          <Input
            id="scheduledPublishAt"
            type="datetime-local"
            min={minLocal}
            defaultValue={minLocal}
            {...register("scheduledPublishAt")}
          />
          <FieldError message={formState.errors.scheduledPublishAt?.message} />
          <p className="mt-1 text-xs text-muted-foreground">{t("hint")}</p>
        </div>
      )}
    </div>
  );
}
