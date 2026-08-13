import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { WonOrderData } from "./useWonCheckout";

export function useCheckout(listingId?: string) {
  const router = useRouter();
  const [selectedPayment, setSelectedPayment] = useState("card");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "processing" | "confirming"
  >("idle");

  // Fetch real order data
  const { data: order, isLoading } = useQuery<WonOrderData>({
    queryKey: ["order", "listing", listingId],
    queryFn: async () => {
      if (!listingId) return null;
      const res = await fetch(`/api/orders/listing/${listingId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch order");
      }
      const data = await res.json();
      return data.data;
    },
    enabled: !!listingId,
  });

  const item = order
    ? {
      id: order.listing?.id || "",
      title: order.listing?.title || "Unknown Item",
      image: order.listing?.images?.[0]?.url || "",
      price: (order.itemPrice || 0) / 100,
      shippingFee: (order.shippingPrice || 0) / 100,
    }
    : null;

  const orderTotal = order ? (order.totalPrice || 0) / 100 : 0;

  const handleCheckout = useCallback(async () => {
    // This is now handled by StripePaymentSection
    // But we keep it as a fallback or for other payment methods
    setStatus("processing");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    router.push(`/checkout/${listingId}/success`);
  }, [listingId, router]);

  const handleDownloadInvoice = useCallback(() => {
    alert("Downloading invoice PDF...");
  }, []);

  return {
    selectedPayment,
    setSelectedPayment,
    email,
    setEmail,
    status,
    orderTotal,
    item,
    order,
    isLoading,
    handleCheckout,
    handleDownloadInvoice,
  };
}
