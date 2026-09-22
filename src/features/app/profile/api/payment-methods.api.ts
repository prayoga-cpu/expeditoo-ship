export interface SavedCard {
  id: string;
  card?: { brand?: string; last4?: string } | null;
}

/**
 * `GET /api/stripe/payment-methods` answers a bare array, not the
 * `{success,data}` envelope every other route uses — existing consumers
 * (`AddPaymentMethodForm`, `PaymentMethods`) already parse it this way; this
 * wrapper matches rather than pretends otherwise.
 */
export const paymentMethodsApi = {
  list: async (): Promise<SavedCard[]> => {
    const res = await fetch("/api/stripe/payment-methods");
    if (!res.ok) throw new Error("Failed to load payment methods");
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as SavedCard[]) : [];
  },
};
