"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAddresses, type Address } from "@/features/app/profile/api/addresses.api";

export const addressBookKeys = { all: ["user-addresses"] as const };

/**
 * Shares the `["user-addresses"]` cache key with `/profile/addresses`
 * (`AddressManagement.tsx`), so posting a job right after saving an address
 * there — or the reverse — never shows a stale list.
 */
export function useAddressBook() {
  return useQuery({
    queryKey: addressBookKeys.all,
    queryFn: fetchAddresses,
  });
}

export type { Address };
