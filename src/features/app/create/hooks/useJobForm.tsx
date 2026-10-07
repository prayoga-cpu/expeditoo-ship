"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/fetcher";
import {
  createAddress,
  type Address,
} from "@/features/app/profile/api/addresses.api";
import { addressBookKeys } from "./useAddressBook";
import { applySavedAddress, autoPickAddresses } from "../address-book";
import { draftRefusal } from "@/features/app/listing/hooks/useDraftActions";
import { jobKeys } from "@/features/app/listing/hooks/useJobDetail";
import type { DraftJob } from "@/features/app/listing/types";
import {
  jobFormSchema,
  STEP_FIELDS,
  type JobFormValues,
  type JobFormOutput,
} from "../schemas";
import { jobsApi } from "../api/jobs.api";
import { postCreateDestination } from "../destination";
import { fromListing, type ResumedForm } from "../from-listing";
import { publicationIssues } from "../publication";
import {
  defaultTimingState,
  resolveTimingWindows,
  timingFieldValues,
  type TimingState,
} from "../timing";

/** Step order. Labels are looked up from `create.steps.*`, never shown raw. */
export const JOB_STEPS = ["what", "where", "when", "budget"] as const;

const WHERE_STEP = 1;
const WHEN_STEP = 2;
const BUDGET_STEP = 3;

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

/** A schema error, however it is displayed: `<FieldError>` carries the marker. */
const FIELD_ERROR = "[data-field-error]";
/** The pickup's publication notice: shown on steps 3 and 4, blocking « Publier » only. */
const PUBLICATION_ERROR = "[data-publication-error]";

/**
 * `handleNext` only validates the current step, so RHF's own
 * `shouldFocusError` (which runs inside `handleSubmit`) never fires for it —
 * a failed "Next" left the reader wherever they already were, with no sign of
 * which field stopped them. Several controls on this form (the weight and
 * size cards, the location picker) are `setValue`-driven rather than
 * `register`-ed, so `form.setFocus` cannot reach them either; every field's
 * error, however it is displayed, always goes through `<FieldError>`, so that
 * is what this looks for. The publication notice has a marker of its own: it
 * blocks nothing but « Publier », and must not take the scroll from the error
 * that actually stopped « Suivant ».
 */
function scrollToFirstError(selector: string) {
  const firstError =
    document.querySelector<HTMLElement>(selector) ??
    document.querySelector<HTMLElement>(FIELD_ERROR);
  if (!firstError) return;

  const group = firstError.parentElement ?? firstError;
  group.scrollIntoView({ behavior: "smooth", block: "center" });

  const focusable = group.querySelector<HTMLElement>(
    "input, textarea, select, button, [role='radio'], [tabindex]"
  );
  focusable?.focus({ preventScroll: true });
}

/**
 * The step holding the first error, in the order the steps are shown. An error
 * on a field no step lists (a stray dimension, a photo) belongs to the first
 * step, where those controls live.
 */
export function firstStepWithError(errors: FieldErrors): number | null {
  const keys = Object.keys(errors);
  if (keys.length === 0) return null;
  const step = STEP_FIELDS.findIndex((fields) =>
    (fields as readonly string[]).some((field) => keys.includes(field))
  );
  return step === -1 ? 0 : step;
}

/**
 * A request that has not gone live, to finish (draft_requests_spec.md §2), and
 * where to open it: step 1 to edit, the Budget step to publish — with
 * « Maintenant » chosen when that is what the requester pressed.
 */
export interface JobFormSeed {
  draft?: DraftJob;
  startStep?: number;
  publishNow?: boolean;
}

export function useJobForm(seed: JobFormSeed = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("create");
  const tMyJobs = useTranslations("myJobs");
  const locale = useLocale();
  // Read once: a resumed request is the form's starting point, not a value it
  // tracks. Re-mounting (a different draft) is the caller's `key`.
  const [resumed] = useState<ResumedForm | null>(() =>
    seed.draft ? fromListing(seed.draft, { locale, now: new Date() }) : null
  );
  const draftId = seed.draft?.id;
  // A saved time the list could not show was moved: the requester sees the
  // When step first, whichever step they asked for, so « Publier » never posts
  // a time they did not see (draft_requests_spec.md §2).
  const [currentStep, setCurrentStep] = useState(() =>
    resumed?.snappedTimes.length ? WHEN_STEP : (seed.startStep ?? 0)
  );
  const [photos, setPhotos] = useState<string[]>(resumed?.photos ?? []);
  // The "When" step's own shape — see `../timing.ts`. Lives here rather than
  // inside `WhenStep` because that component unmounts on every step change,
  // which would otherwise throw away a request's exact date/time the moment
  // someone clicked "Next" and came back.
  const [timing, setTiming] = useState<TimingState>(
    () => resumed?.timing ?? defaultTimingState()
  );
  // The furthest step reached with « Suivant ». A failed submit may send the
  // requester back to any of these, never forward past one they have not seen.
  // A saved request passed the whole schema once: every step is reached.
  const [furthestStep, setFurthestStep] = useState(resumed ? JOB_STEPS.length - 1 : 0);
  // Bumped to scroll to the first error once the step holding it has mounted.
  const [scrollRequest, setScrollRequest] = useState({ n: 0, selector: FIELD_ERROR });
  // Set from the moment a submit starts until its request settles: between
  // the click and `isPending` lie an async validation and a re-render, and a
  // second click in that gap would post the request twice.
  const inFlight = useRef(false);
  // Saved addresses fill a fresh request once, when the list first arrives
  // (saved_addresses_spec.md §3.2) — here rather than on « Où », which
  // unmounts on every step change and would fill again an end the requester
  // had cleared. A resumed request is never filled.
  const addressesPrefilled = useRef(resumed !== null);

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
      needsProtection: false,
      needsPackaging: false,
      photos: [],
      publishMode: "now",
      pickup: { ...emptyEndpoint },
      dropoff: { ...emptyEndpoint },
      // Seeded blank, not left unset. An unset budget is a type error that
      // aborts the whole object before its `superRefine` — so the When step's
      // date rules never ran on "Suivant" until the budget was typed on the
      // step after it. Blank reads as 0 and fails `.positive()` as an ordinary
      // issue on its own step (publication_timing_spec.md §3.6). The field
      // holds the box's text, « 40,5 », and the schema reads it
      // (numeric_input_spec.md §7).
      budgetEuros: "",
      ...resumed?.values,
      ...(seed.publishNow ? { publishMode: "now" as const, scheduledPublishAt: "" } : {}),
      // Derived now, from the resumed When step too: a flexible start saved
      // yesterday is re-clamped to today's clock.
      ...timingFieldValues(resolveTimingWindows(timing)),
    },
  });

  useEffect(() => {
    if (scrollRequest.n > 0) {
      requestAnimationFrame(() => scrollToFirstError(scrollRequest.selector));
    }
  }, [scrollRequest]);

  /** Move to a step and bring its first error into view once it renders. */
  const showStep = useCallback((step: number, selector = FIELD_ERROR) => {
    setCurrentStep(step);
    setScrollRequest(({ n }) => ({ n: n + 1, selector }));
  }, []);

  /**
   * The same, after a submit: the requester pressed a button and may land on
   * another step, so they are told which one and why.
   */
  const sendToStep = useCallback(
    (step: number, selector = FIELD_ERROR) => {
      toast.error(t("toast.checkStep", { step: t(`steps.${JOB_STEPS[step]}`) }));
      showStep(step, selector);
    },
    [showStep, t]
  );

  /**
   * Derive the When step's fields from `next`, measured from `now`. Called on
   * every change and again before "Suivant" and every submit, so a range that
   * starts today never posts a slot that has gone by in the meantime.
   *
   * Every field is written first and validated once after: validating each as
   * it lands checked a half-updated set (a cleared « Du » beside the old
   * « Au »), which is how a cleared date once threw inside the schema.
   */
  const syncTiming = useCallback(
    (next: TimingState, now: Date, validate: boolean) => {
      const windows = timingFieldValues(resolveTimingWindows(next, now));
      form.setValue("pickupFrom", windows.pickupFrom);
      form.setValue("pickupUntil", windows.pickupUntil);
      form.setValue("dropoffFrom", windows.dropoffFrom);
      form.setValue("dropoffUntil", windows.dropoffUntil);
      form.setValue("isFlexible", windows.isFlexible);
      form.setValue("pickupPeriods", windows.pickupPeriods);
      form.setValue("dropoffPeriods", windows.dropoffPeriods);
      form.setValue("pickupDays", windows.pickupDays);
      form.setValue("dropoffDays", windows.dropoffDays);
      if (validate) void form.trigger([...STEP_FIELDS[WHEN_STEP]]);
    },
    [form]
  );

  const handleTimingChange = useCallback(
    (next: TimingState) => {
      setTiming(next);
      syncTiming(next, new Date(), true);
    },
    [syncTiming]
  );

  const createJob = useMutation({
    mutationFn: ({
      values,
      publish,
    }: {
      values: JobFormOutput;
      publish: boolean;
    }) =>
      draftId
        ? jobsApi.saveDraft(draftId, values, publish)
        : jobsApi.create(values, publish),
    onSuccess: (job, variables) => {
      // `/listings/me` and `/home` would otherwise show the list as it was for
      // up to a minute (`staleTime`).
      queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
      // The cached draft would send the thank-you page straight past itself
      // (it only thanks for a request that is live or scheduled).
      if (draftId) queryClient.removeQueries({ queryKey: ["job", draftId] });

      if (variables.publish) {
        // `replace`: the form's state dies with this page, so Back would only
        // land on an empty form (request_posted_page_spec.md §1).
        router.replace(postCreateDestination(job, true));
        return;
      }

      // A draft is never refused for when it could be published, but if its
      // pickup would stop it, the requester hears it now rather than later.
      const pickup = publicationIssues(variables.values).pickup;
      const note = pickup
        ? t(pickup.kind === "inPast" ? "toast.draftNotePast" : "toast.draftNote")
        : undefined;
      toast.success(t("toast.draftSaved"), note ? { description: note } : undefined);
      router.push(postCreateDestination(job, false));
    },
    onError: (error, variables) => {
      // The server's publication refusals, for when its clock and the
      // browser's disagree: each is said in words and sends the requester to
      // the step that holds the date.
      if (error instanceof ApiError) {
        if (error.code === "PICKUP_IN_PAST" || error.code === "PICKUP_TOO_SOON") {
          toast.error(
            t(error.code === "PICKUP_IN_PAST" ? "toast.pickupInPast" : "toast.pickupTooSoon")
          );
          showStep(WHEN_STEP, PUBLICATION_ERROR);
          return;
        }
        if (error.code === "SCHEDULED_PUBLISH_IN_PAST") {
          toast.error(t("toast.schedulePast"));
          showStep(BUDGET_STEP);
          return;
        }
        // Deleted in another tab, or published or closed there or by the
        // scheduler, while this one was open: said as it is, never as worth a
        // retry.
        const refusal = draftRefusal(error);
        if (draftId && refusal) {
          toast.error(tMyJobs(`draft.${refusal}`));
          queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
          queryClient.invalidateQueries({ queryKey: jobKeys.detail(draftId) });
          // Still there: its own page is where it lives now. Gone: the form
          // stays, and what was typed with it.
          if (refusal !== "notFound") router.replace(`/listing/${draftId}`);
          return;
        }
      }
      toast.error(t(variables.publish ? "toast.failed" : "toast.draftFailed"));
    },
  });

  /** Fill each empty end from the address book, once per form. */
  const prefillAddresses = useCallback(
    (addresses: Address[]) => {
      if (addressesPrefilled.current) return;
      addressesPrefilled.current = true;
      const picks = autoPickAddresses(addresses, {
        pickup: form.getValues("pickup"),
        dropoff: form.getValues("dropoff"),
      });
      for (const side of ["pickup", "dropoff"] as const) {
        const address = picks[side];
        if (address) applySavedAddress(form.setValue, side, address);
      }
    },
    [form]
  );

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
    for (const side of ["pickup", "dropoff"] as const) {
      const endpoint = form.getValues(side);
      if (!endpoint?.saveAddress) continue;
      // Claimed before the request goes out, so a second call made while this
      // one is pending — a double click, « Suivant » then a submit — finds
      // nothing to save instead of saving the same address twice.
      form.setValue(`${side}.saveAddress`, false);

      try {
        await createAddress({
          // A preset's id or a typed name; unnamed, the town it is in. The end
          // it was saved from is its own field now (saved_addresses_spec.md §3.4).
          label: endpoint.addressLabel?.trim() || endpoint.city || t(`where.${side}`),
          street: endpoint.address,
          city: endpoint.city,
          zip: endpoint.postalCode,
          country: "France",
          lat: endpoint.lat,
          lng: endpoint.lng,
          usedFor: side,
        });
        form.setValue(`${side}.addressLabel`, "");
        queryClient.invalidateQueries({ queryKey: addressBookKeys.all });
      } catch {
        form.setValue(`${side}.saveAddress`, true);
        toast.error(t("toast.addressSaveFailed"));
      }
    }
  }, [form, queryClient, t]);

  /**
   * The one refusal on « Où » that is about both ends at once, said as a
   * toast too: it is written under the delivery, which may be off screen
   * while the requester is looking at the pickup (saved_addresses_spec.md
   * §3.3).
   */
  const toastEndpointsRefusal = useCallback(() => {
    const refusal = form.getFieldState("dropoff.address").error?.message;
    if (refusal === "create.validation.sameAddress") {
      toast.error(t("toast.sameAddress"));
    } else if (refusal === "create.validation.tooClose") {
      toast.error(t("toast.tooClose"));
    }
  }, [form, t]);

  /**
   * Only validates the fields on the current step, not the whole form. Not
   * whether the pickup leaves carriers time to bid: that blocks « Publier »
   * and nothing else, and holding « Suivant » for it would keep the requester
   * from the Budget step — and so from saving the draft at all
   * (publication_timing_spec.md §3.4). The When step shows it regardless.
   */
  const handleNext = useCallback(async () => {
    if (currentStep === WHEN_STEP) syncTiming(timing, new Date(), false);

    const fields = STEP_FIELDS[currentStep];
    const valid = await form.trigger(fields as never);
    if (!valid) {
      if (currentStep === WHERE_STEP) toastEndpointsRefusal();
      showStep(currentStep);
      return;
    }

    if (currentStep === WHERE_STEP) await saveRequestedAddresses();

    const next = Math.min(currentStep + 1, JOB_STEPS.length - 1);
    setCurrentStep(next);
    setFurthestStep((furthest) => Math.max(furthest, next));
  }, [
    currentStep,
    form,
    saveRequestedAddresses,
    showStep,
    syncTiming,
    timing,
    toastEndpointsRefusal,
  ]);

  const handlePrev = useCallback(
    () => setCurrentStep((step) => Math.max(step - 1, 0)),
    []
  );

  /**
   * The whole schema for both buttons; the publication checks for "Publier"
   * only. Whatever stops a submit moves to the step that holds it — nothing
   * fails silently on a step that is not on screen any more.
   */
  const submit = useCallback(
    (publish: boolean) => {
      if (inFlight.current) return;
      inFlight.current = true;
      const release = () => {
        inFlight.current = false;
      };

      syncTiming(timing, new Date(), false);
      return form
        .handleSubmit(
          (values) => {
            if (publish) {
              const issues = publicationIssues(values);
              if (issues.pickup) {
                release();
                return sendToStep(WHEN_STEP, PUBLICATION_ERROR);
              }
              if (issues.schedule) {
                release();
                return sendToStep(BUDGET_STEP);
              }
            }
            // An address ticked « Enregistrer » is saved when the Where step is
            // left with « Suivant » — or here, when the requester came back to
            // it and submitted from there. Not awaited: the request does not
            // depend on it, and a slow save must not hold « Publier » open.
            void saveRequestedAddresses();
            createJob.mutate(
              { values: values as unknown as JobFormOutput, publish },
              { onSettled: release }
            );
          },
          (errors) => {
            release();
            const step = firstStepWithError(errors) ?? currentStep;
            // Never forward past a step the requester has not seen: « Quand »
            // would publish its untouched defaults. Every step up to the
            // furthest reached is free of errors (the first error lies beyond
            // it), so go on to the first step not yet reached
            // (publication_timing_spec.md §3.5).
            if (step > furthestStep) {
              const next = furthestStep + 1;
              toast.error(t("toast.finishSteps"));
              void saveRequestedAddresses();
              setFurthestStep(next);
              showStep(next);
              return;
            }
            sendToStep(step);
          }
        )()
        .catch((error: unknown) => {
          release();
          throw error;
        });
    },
    [
      form,
      createJob,
      currentStep,
      furthestStep,
      saveRequestedAddresses,
      sendToStep,
      showStep,
      syncTiming,
      t,
      timing,
    ]
  );

  // Judged from a derivation made now, not from the fields: a flexible start
  // was clamped to the clock when it was last derived, and read back fifteen
  // minutes later it would claim « trop proche » about a request « Publier »
  // would re-derive and post without complaint. `watch` re-renders this hook
  // when the publication choice changes; the When step's state does the rest.
  const now = new Date();
  const live = resolveTimingWindows(timing, now);
  const [publishMode, scheduledPublishAt] = form.watch([
    "publishMode",
    "scheduledPublishAt",
  ]);
  const publication = publicationIssues(
    {
      pickupFrom: live.pickupFrom,
      pickupUntil: live.pickupUntil,
      publishMode,
      scheduledPublishAt,
    },
    now
  );

  // Said on the When step while each moved time is still the one selected:
  // once the requester picks another, they have seen it.
  const snappedTimes = (resumed?.snappedTimes ?? []).filter(
    (time) => timing.mode === "exact" && timing[time.side].hour === time.hour
  );

  return {
    form,
    photos,
    isResuming: Boolean(draftId),
    snappedTimes,
    currentStep,
    steps: JOB_STEPS,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === JOB_STEPS.length - 1,
    // From the click (`formState.isSubmitting` covers the validation) to the
    // navigation: the request must never be postable twice.
    isSubmitting:
      form.formState.isSubmitting || createJob.isPending || createJob.isSuccess,
    timing,
    pickupClampedFrom: live.pickupClampedFrom,
    publication,
    handleTimingChange,
    handlePhotosChange,
    handleNext,
    handlePrev,
    prefillAddresses,
    goToStep: showStep,
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
