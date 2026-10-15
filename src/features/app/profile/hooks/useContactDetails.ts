"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js/min";
import { useSession } from "@/lib/auth-client";
import { ALIAS_MAX, NAME_PART_MAX, splitName } from "@/lib/person-name";
import {
  contactApi,
  type ContactDetails,
  type ContactDetailsInput,
} from "../api/contact.api";

export const contactKeys = {
  mine: ["user-contact"] as const,
  staff: (userId: string) => ["user-contact", "staff", userId] as const,
};

export function useMyContactDetails() {
  return useQuery({ queryKey: contactKeys.mine, queryFn: contactApi.mine });
}

/** Staff only; the endpoint refuses everyone else. */
export function useStaffContactDetails(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: contactKeys.staff(userId),
    queryFn: () => contactApi.forStaff(userId),
    enabled,
    retry: false,
  });
}

/**
 * Saves the card. The session carries `user.name`, which a new first or last
 * name rewrites, so it is re-read past its five-minute cookie cache — the
 * header would otherwise greet the old name.
 */
export function useSaveContactDetails() {
  const queryClient = useQueryClient();
  const { refetch } = useSession();

  return useMutation({
    mutationFn: contactApi.save,
    onSuccess: async (saved) => {
      queryClient.setQueryData(contactKeys.mine, saved);
      await refetch({ query: { disableCookieCache: true } });
    },
  });
}

/** The form's starting values: an account from before 2.63.0 has only `name`. */
export function toFormValues(details: ContactDetails | null | undefined): ContactDetailsInput {
  const guess = splitName(details?.name);
  return {
    firstName: details?.firstName ?? guess.firstName,
    lastName: details?.lastName ?? guess.lastName,
    alias: details?.alias ?? "",
    phone: details?.phone ?? "",
    relativeName: details?.relativeName ?? "",
    relativePhone: details?.relativePhone ?? "",
  };
}

const phone = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidPhoneNumber(v, "FR"), "errors.invalidPhone");

/** The server's rules (`user-contact.dto.ts`), as message keys for the card. */
export const contactFormSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "errors.firstNameRequired")
    .max(NAME_PART_MAX, "errors.nameTooLong"),
  lastName: z
    .string()
    .trim()
    .min(1, "errors.lastNameRequired")
    .max(NAME_PART_MAX, "errors.nameTooLong"),
  alias: z.string().trim().max(ALIAS_MAX, "errors.aliasTooLong"),
  phone,
  relativeName: z.string().trim().max(80, "errors.nameTooLong"),
  relativePhone: phone,
});
