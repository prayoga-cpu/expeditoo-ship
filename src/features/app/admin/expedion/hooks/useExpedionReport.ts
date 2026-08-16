import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { ExpedionReport } from "@/server/services/expedion-report.service";

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

export function useExpedionReport() {
  return useQuery<ExpedionReport>({
    queryKey: REPORT_KEY,
    queryFn: async () =>
      unwrap<ExpedionReport>(await fetch("/api/admin/expedion/report")),
    // Operator queues are worked through in a sitting; a stale-for-a-minute
    // count is fine, a refetch on every window focus is not.
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Fields an operator may change on a quote. Mirrors `adminUpdateExpedionQuoteSchema`. */
export interface QuoteAdminPatch {
  quoteStandardCents?: number | null;
  quoteInsuredCents?: number | null;
  quoteAvailable?: boolean;
  assignedCarrierId?: string | null;
  status?: string;
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
    queryFn: async () => {
      const body = (await (await fetch("/api/admin/carriers")).json()) as
        | Envelope<{ items?: CarrierOption[] } | CarrierOption[]>
        | undefined;
      const data = body?.data;
      if (Array.isArray(data)) return data;
      return data?.items ?? [];
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
