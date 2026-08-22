"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ApiError } from "@/lib/fetcher";
import { contactApi } from "../api/contact.api";
import {
  contactSubmitSchema,
  type ContactSubmitInput,
} from "@/server/dto/contact.dto";

export type ContactFieldErrors = Partial<
  Record<keyof ContactSubmitInput, string>
>;

/**
 * Form state for the public contact page.
 *
 * Validation runs against the same Zod schema the route parses, so the visitor
 * is corrected before a round trip without a second, drifting copy of the
 * rules. The server stays authoritative — a failure it reports is merged back
 * into the same field errors.
 */
export function useContactForm() {
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});

  const mutation = useMutation({
    mutationFn: (input: ContactSubmitInput) => contactApi.submit(input),
    onError: (error) => {
      if (error instanceof ApiError && error.issues?.length) {
        setFieldErrors(
          error.issues.reduce<ContactFieldErrors>((acc, issue) => {
            acc[issue.path as keyof ContactSubmitInput] = issue.message;
            return acc;
          }, {})
        );
      }
    },
  });

  function submit(values: Record<string, string>) {
    setFieldErrors({});

    const parsed = contactSubmitSchema.safeParse({
      ...values,
      // An untouched optional field arrives as "" and would fail `max(120)`
      // only by accident; dropping it is what "not supplied" means.
      company: values.company?.trim() ? values.company : undefined,
    });

    if (!parsed.success) {
      setFieldErrors(
        parsed.error.issues.reduce<ContactFieldErrors>((acc, issue) => {
          const key = issue.path[0] as keyof ContactSubmitInput;
          if (key && !acc[key]) acc[key] = issue.message;
          return acc;
        }, {})
      );
      return;
    }

    mutation.mutate(parsed.data);
  }

  // A field-level failure is already shown on the field; only a whole-form
  // failure needs the banner, and a rate limit needs different words from a
  // delivery failure — "try again" is wrong advice when the answer is to wait.
  const failure = mutation.error;
  const isFieldFailure =
    failure instanceof ApiError && Boolean(failure.issues?.length);

  return {
    submit,
    fieldErrors,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    errorKind:
      !failure || isFieldFailure
        ? null
        : failure instanceof ApiError && failure.code === "CONTACT_RATE_LIMITED"
          ? ("rateLimited" as const)
          : ("failed" as const),
  };
}
