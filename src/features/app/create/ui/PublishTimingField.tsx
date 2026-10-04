"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FieldError } from "./FieldError";
import { MOMENT_FORMAT } from "./PublicationNotice";
import { forInput } from "../timing";
import { PUBLISH_MODES, type PublishMode } from "../schemas";
import { MIN_SCHEDULE_LEAD_MS, type ScheduleIssue } from "../publication";
import type { JobFormApi } from "../hooks/useJobForm";

/**
 * "Publish now" or "schedule for later" — the last choice in `/create`.
 *
 * Not built on `TimingField.tsx`: that machinery turns a day plus a time-of-
 * day preference into an arrival *window*, a different shape from "one
 * precise instant". A plain native `datetime-local` input, registered
 * directly on the form the same way `budgetEuros` is, gets the platform's
 * own picker for free.
 */
export function PublishTimingField({
  form,
  scheduleIssue,
}: {
  form: JobFormApi["form"];
  /** From `publicationIssues` — a publication rule, so never a schema error. */
  scheduleIssue: ScheduleIssue | null;
}) {
  const t = useTranslations("create.budget.publish");
  const tCreate = useTranslations("create");
  const format = useFormatter();
  const { register, watch, setValue, formState } = form;
  const mode = watch("publishMode");
  const minLocal = forInput(Date.now() + MIN_SCHEDULE_LEAD_MS);

  const issueMessage = !scheduleIssue
    ? undefined
    : scheduleIssue.kind === "required"
      ? tCreate("validation.scheduledPublishRequired")
      : scheduleIssue.kind === "past"
        ? tCreate("validation.scheduledPublishPast")
        : scheduleIssue.kind === "unschedulable"
          ? tCreate("publication.scheduleImpossible")
          : tCreate("publication.scheduleTooClose", {
              latest: format.dateTime(scheduleIssue.latest, MOMENT_FORMAT),
            });

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
          <FieldError
            message={formState.errors.scheduledPublishAt?.message ?? issueMessage}
          />
          <p className="mt-1 text-xs text-muted-foreground">{t("hint")}</p>
        </div>
      )}
    </div>
  );
}
