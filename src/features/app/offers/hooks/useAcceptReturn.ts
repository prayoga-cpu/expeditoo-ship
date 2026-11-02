"use client";

import { useSearchParams } from "next/navigation";

/**
 * Coming back from a payment method that leaves the page — PayPal — to finish
 * the award it approved (docs/specs/payment_alternatives_spec.md §3).
 *
 * The accept dialog sends the requester away with a return address naming the
 * offer and slot; Stripe appends the intent and how it went. Whoever renders
 * that offer's dialog reads this, reopens it on `resume`, and calls `clear`
 * once it closes, so a reload does not try the award twice. The server still
 * decides: the intent must be this award's and held for capture.
 */
export interface AcceptReturn {
  offerId: string;
  slotId?: string;
  paymentIntentId: string;
  /** Cancelled at PayPal, or refused there: nothing was approved. */
  failed: boolean;
}

const OFFER = "acceptOffer";
const SLOT = "acceptSlot";
const STRIPE = ["payment_intent", "payment_intent_client_secret", "redirect_status"];
const FAILED = ["failed", "requires_payment_method", "canceled"];

/** This page, naming the award — where Stripe sends the requester back. */
export function acceptReturnUrl(offerId: string, slotId?: string) {
  const url = new URL(window.location.href);
  for (const key of [OFFER, SLOT, ...STRIPE]) url.searchParams.delete(key);
  url.searchParams.set(OFFER, offerId);
  if (slotId) url.searchParams.set(SLOT, slotId);
  return url.toString();
}

export function useAcceptReturn() {
  // Null outside the app router (a component test); read as no return.
  const params = useSearchParams() ?? new URLSearchParams();

  const offerId = params.get(OFFER);
  const paymentIntentId = params.get("payment_intent");
  const resume: AcceptReturn | null =
    offerId && paymentIntentId
      ? {
          offerId,
          slotId: params.get(SLOT) ?? undefined,
          paymentIntentId,
          failed: FAILED.includes(params.get("redirect_status") ?? ""),
        }
      : null;

  /**
   * Drops the return's parameters and keeps the rest (the tab, say). Through
   * `history.replaceState`, which the app router follows, so no navigation —
   * and no router — is needed to stop a reload from trying the award again.
   */
  const clear = () => {
    const url = new URL(window.location.href);
    for (const key of [OFFER, SLOT, ...STRIPE]) url.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", url);
  };

  return { resume, clear };
}
