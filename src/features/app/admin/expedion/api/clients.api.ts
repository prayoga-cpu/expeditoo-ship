import { api, toQuery } from "@/lib/fetcher";
import type {
  ExpedionClientDto,
  ExpedionClientQuoteDto,
} from "@/server/services/expedion-clients.service";

export type ExpedionClient = ExpedionClientDto;
export type ExpedionClientQuote = ExpedionClientQuoteDto;

export interface ExpedionClientListParams {
  search?: string;
  linked?: "all" | "withAccount" | "withoutAccount";
  sortBy?: "lastSeen" | "quotes" | "value" | "name";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface ExpedionClientList {
  clients: ExpedionClient[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ExpedionClientDetail {
  client: ExpedionClient;
  quotes: ExpedionClientQuote[];
}

export const expedionClientsApi = {
  list: (params: ExpedionClientListParams = {}) =>
    api.get<ExpedionClientList>(
      `/api/admin/expedion/clients${toQuery(params)}`
    ),

  // Encoded because an owner key is not always a tidy id — the legacy rows
  // carry Firebase uids and `dev:`-prefixed seeds, and a raw one would break
  // the path segment.
  get: (ownerId: string) =>
    api.get<ExpedionClientDetail>(
      `/api/admin/expedion/clients/${encodeURIComponent(ownerId)}`
    ),
};
