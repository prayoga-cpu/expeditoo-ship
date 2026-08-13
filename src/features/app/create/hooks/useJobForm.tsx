"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { jobFormSchema, STEP_FIELDS, type JobFormValues, type JobFormOutput } from "../schemas";
import { jobsApi } from "../api/jobs.api";
import { ApiError } from "@/lib/fetcher";

export const JOB_STEPS = ["What", "Where", "When", "Budget"] as const;

/** Sensible defaults: a pickup window tomorrow, delivery the day after. */
function defaultWindows() {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  return {
    pickupFrom: new Date(now + day),
    pickupUntil: new Date(now + day + 8 * 60 * 60 * 1000),
    dropoffFrom: new Date(now + 2 * day),
    dropoffUntil: new Date(now + 2 * day + 8 * 60 * 60 * 1000),
  };
}

export function useJobForm() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    mode: "onBlur",
    defaultValues: {
      title: "",
      description: "",
      categoryId: "",
      quantity: 1,
      isFragile: false,
      needsHelp: false,
      isFlexible: false,
      photos: [],
      ...defaultWindows(),
    },
  });

  const createJob = useMutation({
    mutationFn: ({ values, publish }: { values: JobFormOutput; publish: boolean }) =>
      jobsApi.create(values, publish),
    onSuccess: (job, variables) => {
      toast.success(
        variables.publish ? "Job posted - carriers can now bid" : "Draft saved"
      );
      router.push(variables.publish ? `/listing/${job.id}` : "/listings/me");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "PICKUP_TOO_SOON") {
        toast.error("Pickup is too soon for carriers to bid. Push it later.");
        return;
      }
      toast.error(error instanceof Error ? error.message : "Could not post job");
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
        createJob.mutate({ values: values as JobFormOutput, publish })
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
    handlePhotosChange,
    handleNext,
    handlePrev,
    publish: () => submit(true),
    saveDraft: () => submit(false),
  };
}
