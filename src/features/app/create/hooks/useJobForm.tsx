"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/fetcher";
import {
  jobFormSchema,
  STEP_FIELDS,
  type JobFormValues,
  type JobFormOutput,
} from "../schemas";
import { jobsApi } from "../api/jobs.api";

/** Step order. Labels are looked up from `create.steps.*`, never shown raw. */
export const JOB_STEPS = [
  "what",
  "where",
  "when",
  "budget",
  // The client pays when a carrier is chosen, so the card is collected before
  // the job reaches the board rather than at the award
  // (docs/specs/payment_at_booking_spec.md §7).
  "payment",
] as const;

/**
 * `datetime-local` speaks "YYYY-MM-DDTHH:mm" in the viewer's own time zone, and
 * renders nothing at all for a `Date`. Seeding the form with Date objects left
 * all four windows visibly blank while the schema believed they were filled.
 */
function forInput(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** Sensible defaults: a pickup window tomorrow, delivery the day after. */
function defaultWindows() {
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const now = Date.now();
  return {
    pickupFrom: forInput(now + day),
    pickupUntil: forInput(now + day + 8 * hour),
    dropoffFrom: forInput(now + 2 * day),
    dropoffUntil: forInput(now + 2 * day + 8 * hour),
  };
}

const emptyEndpoint = {
  address: "",
  city: "",
  postalCode: "",
  locationType: "house" as const,
};

export function useJobForm() {
  const router = useRouter();
  const t = useTranslations("create");
  const [currentStep, setCurrentStep] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  // Reported by the payment step. A draft needs no card; a posted job does.
  const [hasCard, setHasCard] = useState(false);

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
      isFlexible: false,
      photos: [],
      pickup: { ...emptyEndpoint },
      dropoff: { ...emptyEndpoint },
      ...defaultWindows(),
    },
  });

  const createJob = useMutation({
    mutationFn: ({
      values,
      publish,
    }: {
      values: JobFormOutput;
      publish: boolean;
    }) => jobsApi.create(values, publish),
    onSuccess: (job, variables) => {
      toast.success(
        variables.publish ? t("toast.posted") : t("toast.draftSaved")
      );
      router.push(variables.publish ? `/listing/${job.id}` : "/listings/me");
    },
    onError: (error) => {
      // The one server rejection a person can actually act on, so it gets its
      // own sentence rather than the raw code.
      if (error instanceof ApiError && error.code === "PICKUP_TOO_SOON") {
        toast.error(t("toast.pickupTooSoon"));
        return;
      }
      // The card was detached between the step and the post, or Stripe lost
      // it. Either way the person can act on it, so it gets its own sentence.
      if (
        error instanceof ApiError &&
        error.code === "PAYMENT_METHOD_REQUIRED"
      ) {
        toast.error(t("toast.cardRequired"));
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

  /** Only validates the fields on the current step, not the whole form. */
  const handleNext = useCallback(async () => {
    const fields = STEP_FIELDS[currentStep];
    const valid = await form.trigger(fields as never);
    if (!valid) return;

    setCurrentStep((step) => Math.min(step + 1, JOB_STEPS.length - 1));
  }, [currentStep, form]);

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
    hasCard,
    setHasCard,
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
