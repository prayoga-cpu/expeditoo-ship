"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/fetcher";
import { createAddress } from "@/features/app/profile/api/addresses.api";
import { addressBookKeys } from "./useAddressBook";
import {
  jobFormSchema,
  STEP_FIELDS,
  type JobFormValues,
  type JobFormOutput,
} from "../schemas";
import { jobsApi } from "../api/jobs.api";
import {
  defaultTimingState,
  resolveTimingWindows,
  type TimingState,
} from "../timing";

/** Step order. Labels are looked up from `create.steps.*`, never shown raw. */
export const JOB_STEPS = ["what", "where", "when", "budget"] as const;

const WHERE_STEP = 1;

const emptyEndpoint = {
  address: "",
  city: "",
  postalCode: "",
  locationType: "house" as const,
  note: "",
  contactName: "",
  contactPhone: "",
  saveAddress: false,
  addressLabel: "",
};

/**
 * `handleNext` only validates the current step, so RHF's own
 * `shouldFocusError` (which runs inside `handleSubmit`) never fires for it —
 * a failed "Next" left the reader wherever they already were, with no sign of
 * which field stopped them. Several controls on this form (the weight and
 * size cards, the location picker) are `setValue`-driven rather than
 * `register`-ed, so `form.setFocus` cannot reach them either; every field's
 * error, however it is displayed, always goes through `<FieldError>`, so that
 * is what this looks for instead.
 */
function scrollToFirstError() {
  const firstError = document.querySelector<HTMLElement>("[data-field-error]");
  if (!firstError) return;

  const group = firstError.parentElement ?? firstError;
  group.scrollIntoView({ behavior: "smooth", block: "center" });

  const focusable = group.querySelector<HTMLElement>(
    "input, textarea, select, button, [role='radio'], [tabindex]"
  );
  focusable?.focus({ preventScroll: true });
}

export function useJobForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("create");
  const [currentStep, setCurrentStep] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  // The "When" step's own shape — see `../timing.ts`. Lives here rather than
  // inside `WhenStep` because that component unmounts on every step change,
  // which would otherwise throw away a request's exact date/time the moment
  // someone clicked "Next" and came back.
  const [timing, setTiming] = useState<TimingState>(() => defaultTimingState());

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    mode: "onBlur",
    defaultValues: {
      title: "",
      description: "",
      // No `weightBracket`: it is a required choice, and seeding one would
      // submit a weight nobody picked.
      sizeMode: "preset",
      quantity: 1,
      isFragile: false,
      needsHelp: false,
      photos: [],
      publishMode: "now",
      pickup: { ...emptyEndpoint },
      dropoff: { ...emptyEndpoint },
      ...resolveTimingWindows(timing),
    },
  });

  const handleTimingChange = useCallback(
    (next: TimingState) => {
      setTiming(next);
      const windows = resolveTimingWindows(next);
      form.setValue("pickupFrom", windows.pickupFrom, { shouldValidate: true });
      form.setValue("pickupUntil", windows.pickupUntil, { shouldValidate: true });
      form.setValue("dropoffFrom", windows.dropoffFrom, { shouldValidate: true });
      form.setValue("dropoffUntil", windows.dropoffUntil, {
        shouldValidate: true,
      });
      form.setValue("isFlexible", windows.isFlexible);
    },
    [form]
  );

  const createJob = useMutation({
    mutationFn: ({
      values,
      publish,
    }: {
      values: JobFormOutput;
      publish: boolean;
    }) => jobsApi.create(values, publish),
    onSuccess: (_job, variables) => {
      const scheduled = variables.values.publishMode === "schedule";
      toast.success(
        !variables.publish
          ? t("toast.draftSaved")
          : scheduled
            ? t("toast.scheduled")
            : t("toast.posted")
      );
      // A scheduled job is not live yet, so there is nothing to highlight on
      // /home — it stays on /listings/me, the same as a draft, until the
      // cron actually publishes it.
      router.push(
        variables.publish && !scheduled ? "/home" : "/listings/me"
      );
    },
    onError: (error) => {
      // The one server rejection a person can actually act on, so it gets its
      // own sentence rather than the raw code.
      if (error instanceof ApiError && error.code === "PICKUP_TOO_SOON") {
        toast.error(t("toast.pickupTooSoon"));
        return;
      }
      if (error instanceof ApiError && error.code === "SCHEDULED_PUBLISH_IN_PAST") {
        toast.error(t("toast.schedulePast"));
        return;
      }
      toast.error(t("toast.failed"));
    },
  });

  const handlePhotosChange = useCallback(
    (next: string[]) => {
      setPhotos(next);
      form.setValue("photos", next);
    },
    [form]
  );

  /**
   * A saved-address checkbox left checked on either endpoint, fired once
   * when the Where step is left rather than reactively on every keystroke —
   * one write per visit, not one per character typed. Failure toasts but
   * does not block advancing: the job itself does not depend on this.
   */
  const saveRequestedAddresses = useCallback(async () => {
    const values = form.getValues();
    for (const side of ["pickup", "dropoff"] as const) {
      const endpoint = values[side];
      if (!endpoint?.saveAddress) continue;

      try {
        await createAddress({
          label: endpoint.addressLabel?.trim() || t(`where.${side}`),
          street: endpoint.address,
          city: endpoint.city,
          zip: endpoint.postalCode,
          country: "France",
          lat: endpoint.lat,
          lng: endpoint.lng,
        });
        form.setValue(`${side}.saveAddress`, false);
        form.setValue(`${side}.addressLabel`, "");
        queryClient.invalidateQueries({ queryKey: addressBookKeys.all });
      } catch {
        toast.error(t("toast.addressSaveFailed"));
      }
    }
  }, [form, queryClient, t]);

  /** Only validates the fields on the current step, not the whole form. */
  const handleNext = useCallback(async () => {
    const fields = STEP_FIELDS[currentStep];
    const valid = await form.trigger(fields as never);
    if (!valid) {
      // `trigger` resolves once `formState.errors` is updated, but React has
      // not necessarily painted the new `FieldError` text yet — wait a frame
      // so the element we're about to scroll to actually exists.
      requestAnimationFrame(scrollToFirstError);
      return;
    }

    if (currentStep === WHERE_STEP) await saveRequestedAddresses();

    setCurrentStep((step) => Math.min(step + 1, JOB_STEPS.length - 1));
  }, [currentStep, form, saveRequestedAddresses]);

  const handlePrev = useCallback(
    () => setCurrentStep((step) => Math.max(step - 1, 0)),
    []
  );

  const submit = useCallback(
    (publish: boolean) =>
      form.handleSubmit((values) =>
        createJob.mutate({
          values: values as unknown as JobFormOutput,
          publish,
        })
      )(),
    [form, createJob]
  );

  return {
    form,
    photos,
    currentStep,
    steps: JOB_STEPS,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === JOB_STEPS.length - 1,
    isSubmitting: createJob.isPending,
    timing,
    handleTimingChange,
    handlePhotosChange,
    handleNext,
    handlePrev,
    publish: () => submit(true),
    saveDraft: () => submit(false),
  };
}

/**
 * Taken from the hook rather than written as `UseFormReturn<JobFormValues>`: a
 * resolver adds a third generic for the transformed output, so the spelled-out
 * version is a different type from the one `useJobForm` actually returns. It
 * lives here so every step component can name it without importing the form.
 */
export type JobFormApi = ReturnType<typeof useJobForm>;
