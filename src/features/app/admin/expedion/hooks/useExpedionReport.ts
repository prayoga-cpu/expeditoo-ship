import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { QuoteRow } from "@/server/dal/expedion-report.dal";
import type { ExpedionReport } from "@/server/services/expedion-report.service";
import type { ExpedionQuote } from "@/db/schema/expedion";

/**
 * Data and actions for the operator report.
 *
 * The report is one query rather than one per section: every figure on the page
 * is derived from the same snapshot, so a card can never disagree with the
 * queue beneath it.
 *
 * The mutations **invalidate rather than update optimistically**. Repricing,
 * assigning and escalating all trigger server-side work the client cannot
 * predict — an event row, a marketplace listing, an SMS — so guessing the new
 * state would show something that has not happened yet, and escalation in
 * particular is irreversible.
 */

const REPORT_KEY = ["admin", "expedion", "report"] as const;

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function unwrap<T>(response: Response): Promise<T> {
  const body = (await response.json()) as Envelope<T>;
  if (!response.ok || !body.success || body.data === undefined) {
    throw new Error(body.error?.message ?? "Request failed");
  }
  return body.data;
}

/**
 * Turns the report's date columns back into `Date`s.
 *
 * `QuoteRow` declares `storageFreeUntil`, `escalateAfter` and `requestedAt` as
 * `Date`, and on the server they are. JSON has no date type, so what actually
 * arrives is an ISO string — and `unwrap` is a cast, not a parse, so nothing
 * noticed: the compiler believed the declaration while the Storage queue called
 * `.getTime()` on a string and threw on every row it had.
 *
 * Reviving here keeps the one declared type honest on both sides. It is a hand-
 * written field list, so it has to be extended when a date column is added —
 * `expedion-report.dal.test.ts` round-trips a row through `JSON.parse(JSON
 * .stringify(...))` to make that failure loud rather than silent.
 */
function reviveQuoteDates(report: ExpedionReport): ExpedionReport {
  const row = (r: QuoteRow): QuoteRow => ({
    ...r,
    storageFreeUntil: asDate(r.storageFreeUntil),
    escalateAfter: asDate(r.escalateAfter),
    requestedAt: asDate(r.requestedAt),
  });
  return {
    ...report,
    queues: Object.fromEntries(
      Object.entries(report.queues).map(([key, rows]) => [key, rows.map(row)])
    ) as ExpedionReport["queues"],
    recent: report.recent.map(row),
  };
}

/** Accepts what the wire sends (string) or what the type promises (Date). */
function asDate(value: Date | string | null): Date | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function useExpedionReport() {
  return useQuery<ExpedionReport>({
    queryKey: REPORT_KEY,
    queryFn: async () =>
      reviveQuoteDates(
        await unwrap<ExpedionReport>(
          await fetch("/api/admin/expedion/report")
        )
      ),
    // Operator queues are worked through in a sitting; a stale-for-a-minute
    // count is fine, a refetch on every window focus is not.
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Fields an operator may change on a quote — every field the quote detail
 * dialog's edit form and the queue's price/assign dialogs write. Mirrors
 * `adminUpdateExpedionQuoteSchema`.
 */
export interface QuoteAdminPatch {
  status?: string;
  paymentStatus?: string;
  quoteStandardCents?: number | null;
  quoteInsuredCents?: number | null;
  quoteAvailable?: boolean;
  assignedCarrierId?: string | null;
  escalateAfter?: string | null;
  storageFreeUntil?: string | null;
  storageDailyFeeCents?: number | null;

  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  clientAddress?: string | null;
  clientPostalCode?: string | null;
  clientCity?: string | null;
  clientCountry?: string | null;

  auctionHouseName?: string | null;
  pickupAddress?: string | null;
  pickupCity?: string | null;
  pickupPostalCode?: string | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupPhone?: string | null;
  saleDate?: string | null;

  recipientName?: string | null;
  deliveryAddress?: string | null;
  deliveryAddressLine2?: string | null;
  deliveryCity?: string | null;
  deliveryPostalCode?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  deliveryCountry?: string | null;
  deliveryPhone?: string | null;

  description?: string | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  isProtected?: boolean;
  declaredValueCents?: number | null;
  valueBracket?: string | null;
  acceptedPriceCents?: number | null;

  note?: string;
}

export function useExpedionQuoteAdmin() {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.expedion.actions");

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: QuoteAdminPatch }) =>
      unwrap<unknown>(
        await fetch(`/api/expedion/quotes/${id}/admin`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        })
      ),
    onSuccess: (_data, { patch }) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "expedion"] });
      toast.success(
        patch.assignedCarrierId !== undefined ? t("assigned") : t("repriced")
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** A value that left the server as a `Date` and arrived as an ISO string. */
type Wire<T> = {
  [K in keyof T]: T[K] extends Date | null
    ? string | Date | null
    : T[K] extends Date
      ? string | Date
      : T[K];
};

export type QuoteDetail = Wire<ExpedionQuote>;

interface QuoteDetailEnvelope {
  success: boolean;
  data?: QuoteDetail;
  error?: { code: string; message: string };
}

/**
 * The full quote — including the bordereau, coordinates and every field the
 * report's tables leave out. Shared by the detail dialog and the fix-and-
 * publish flow inside it, both of which need the same row hydrated the same
 * way.
 *
 * Reads `GET /api/expedion/quotes/:id`, the same endpoint the client app
 * uses for its own quote; that route hands an admin any row and a non-owner
 * a 404, so nothing here widens who can see what.
 */
export function useExpedionQuoteDetail(quoteId: string | null) {
  return useQuery<QuoteDetail>({
    queryKey: ["admin", "expedion", "quote", quoteId],
    enabled: quoteId !== null,
    queryFn: async () => {
      const response = await fetch(`/api/expedion/quotes/${quoteId}`);

      /*
       * Read the body as text and parse it here, rather than `response.json()`.
       * A route that throws before it can answer — a refused database
       * connection, a crashed render — replies with Next's HTML error page, and
       * `response.json()` then fails with `Unexpected token '<'`, which is what
       * the operator ends up reading inside the dialog. The status is the fact
       * worth showing; the parser's complaint about the first character is not.
       */
      const raw = await response.text();
      let body: QuoteDetailEnvelope | null = null;
      try {
        body = JSON.parse(raw) as QuoteDetailEnvelope;
      } catch {
        body = null;
      }

      if (!body) {
        throw new Error(
          response.ok
            ? "The server sent something that is not a quote."
            : `The server refused this quote (HTTP ${response.status}).`
        );
      }

      if (!response.ok || !body.success || !body.data) {
        throw new Error(body.error?.message ?? "Quote unavailable");
      }
      return body.data;
    },
  });
}

export interface ReextractResult {
  quote: unknown;
  missingFields: string[];
  model: string;
}

/**
 * Re-runs bordereau extraction against the document already stored on the
 * quote and writes back whatever the model finds. `quote` in the result is
 * the freshly updated row, still wire-shaped (dates as strings) — the caller
 * casts it the same way the detail query's own response is cast.
 */
export function useExpedionReextract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<ReextractResult>(
        await fetch(`/api/expedion/quotes/${id}/reextract`, { method: "POST" })
      ),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "expedion", "quote", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "expedion"] });
    },
  });
}

/** Mirrors `PriceSuggestion` in `expedion-price-suggestion.service.ts`. */
export interface PriceSuggestion {
  standardCents: number;
  insuredCents: number;
  reasoning: string;
  estimations: string[];
  confidence: number;
  source: "ai" | "engine";
}

/**
 * Fetches a suggested price for a quote; writes nothing. The reprice dialog
 * uses the result to seed its editable fields, the same way it seeds them
 * from whatever price is already on the quote.
 */
export function useExpedionPriceSuggestion() {
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<PriceSuggestion>(
        await fetch(`/api/expedion/quotes/${id}/suggest-price`, {
          method: "POST",
        })
      ),
  });
}

export function useExpedionEscalate() {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.expedion.actions");

  return useMutation({
    mutationFn: async (id: string) =>
      unwrap<{ listingId: string }>(
        await fetch(`/api/expedion/quotes/${id}/escalate`, { method: "POST" })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "expedion"] });
      toast.success(t("escalated"));
    },
    // The common failure is a missing pickup coordinate, which
    // `escalationBlockers` names — surface the server's message rather than a
    // generic one, because it tells the operator what to fix.
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Approved carriers, for the assign-driver picker. */
export interface CarrierOption {
  id: string;
  companyName: string | null;
}

export function useCarrierOptions() {
  return useQuery<CarrierOption[]>({
    queryKey: ["admin", "carriers", "options"],
    // Shares `unwrap` with the queries above, so a failed request surfaces as
    // a query error. Guessing at the envelope instead turned a missing
    // endpoint into an empty list, which reads as "no carrier is approved yet"
    // and hid a picker that could never be filled.
    queryFn: async () =>
      unwrap<CarrierOption[]>(await fetch("/api/admin/carriers")),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Exposed for the JSON round-trip test; not part of the hook's public API. */
export const __testing = { reviveQuoteDates };
