"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  expedionClientsApi,
  type ExpedionClientListParams,
} from "../api/clients.api";

/**
 * The client book.
 *
 * `keepPreviousData` because every control on the screen — search, sort, the
 * pager — changes the query key: without it the table empties and re-mounts on
 * each keystroke, which reads as the data disappearing.
 */
export function useExpedionClients(params: ExpedionClientListParams) {
  return useQuery({
    queryKey: ["admin", "expedion-clients", params],
    queryFn: () => expedionClientsApi.list(params),
    placeholderData: keepPreviousData,
  });
}

/** One client and their quotes. Idle until a row is actually opened. */
export function useExpedionClient(ownerId: string | null) {
  return useQuery({
    queryKey: ["admin", "expedion-clients", "detail", ownerId],
    queryFn: () => expedionClientsApi.get(ownerId as string),
    enabled: Boolean(ownerId),
  });
}
