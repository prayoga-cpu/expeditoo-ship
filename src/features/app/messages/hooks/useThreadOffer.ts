import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  messagesApi,
  ThreadOfferApiError,
  type SubmitThreadOfferInput,
} from "../api";

/**
 * Failures whose wording already exists under `listing.bid.errors` because the
 * job page hits them too. One wording for one failure, rather than a second
 * copy that drifts.
 */
const BID_ERRORS = [
  "LISTING_NOT_OPEN",
  "LISTING_EXPIRED",
  "CARRIER_NOT_APPROVED",
  "VEHICLE_CAPACITY_WEIGHT",
  "VEHICLE_CAPACITY_DIMENSIONS",
  "OFFER_ALREADY_EXISTS",
];

/** Failures this surface is the first to name. */
const OFFER_ERRORS = [
  "CONVERSATION_HAS_NO_LISTING",
  "THREAD_OFFER_LIVE",
  "NOT_YOUR_OFFER",
  "OFFER_NOT_PENDING",
  "SLOT_IN_PAST",
  "PRICE_OUT_OF_RANGE",
  "PICKUP_OUTSIDE_WINDOW",
  "VEHICLE_NOT_OWNED",
  "CANNOT_BID_OWN_LISTING",
];

/**
 * Everything the offer card and dialog can do, with the server's error codes
 * translated rather than its English passed through.
 *
 * A Zod failure arrives as `VALIDATION_ERROR` with the real code buried in
 * `issues[].message`, so that is read first - this is the first surface in the
 * repo to decode those instead of showing "Invalid input".
 */
export function useThreadOffer(conversationId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations("messages.offer");
  const tBid = useTranslations("listing.bid");

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: ["messages", "thread", conversationId],
    });
    queryClient.invalidateQueries({ queryKey: ["messages", "conversations"] });
    queryClient.invalidateQueries({ queryKey: ["carrier-offers"] });
  };

  const report = (error: unknown) => {
    const api = error instanceof ThreadOfferApiError ? error : null;
    const code =
      api?.code === "VALIDATION_ERROR"
        ? (api.issues?.[0]?.message ?? "")
        : (api?.code ?? "");

    if (BID_ERRORS.includes(code)) return toast.error(tBid(`errors.${code}`));
    if (OFFER_ERRORS.includes(code)) return toast.error(t(`errors.${code}`));
    return toast.error(t("errors.generic"));
  };

  const submit = useMutation({
    mutationFn: (input: SubmitThreadOfferInput) =>
      messagesApi.submitOffer(conversationId, input),
    onSuccess: () => {
      toast.success(t("success"));
      refresh();
    },
    onError: report,
  });

  const accept = useMutation({
    mutationFn: (threadOfferId: string) =>
      messagesApi.acceptOffer(threadOfferId),
    onSuccess: () => {
      toast.success(t("accepted"));
      refresh();
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
    },
    onError: report,
  });

  const decline = useMutation({
    mutationFn: (threadOfferId: string) =>
      messagesApi.declineOffer(threadOfferId),
    onSuccess: () => {
      toast.success(t("declined"));
      refresh();
    },
    onError: report,
  });

  const withdraw = useMutation({
    mutationFn: (threadOfferId: string) =>
      messagesApi.withdrawOffer(threadOfferId),
    onSuccess: () => {
      toast.success(t("withdrawn"));
      refresh();
    },
    onError: report,
  });

  return { submit, accept, decline, withdraw };
}
