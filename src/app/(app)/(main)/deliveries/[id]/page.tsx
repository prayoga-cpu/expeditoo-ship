"use client";

import { use, useState } from "react";
import { DeliveryDetail } from "@/features/app/deliveries/ui";
import { useDeliveryDetail, useCancelShipment } from "@/features/app/deliveries/hooks";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Delivery Detail page - Orchestration layer
 * Follows SOLID principle - uses hooks for business logic, passes data to UI components
 */
export default function DeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { delivery, isLoading } = useDeliveryDetail(id);
  const { mutate: cancelShipment, isPending: isCancelling } = useCancelShipment();
  const [isContacting, setIsContacting] = useState(false);

  const handleContactDriver = async () => {
    if (!delivery?.driver.id) {
      toast.error("No driver assigned yet");
      return;
    }

    if (!user) {
      toast.error("Please login to contact driver");
      router.push("/auth/login");
      return;
    }

    try {
      setIsContacting(true);
      const res = await fetch("/api/messages/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: delivery.driver.id,
          // Only include listingId if shipment has an associated listing
          ...(delivery.listingId && { listingId: delivery.listingId })
        }),
      });

      const data = await res.json();

      if (data.success) {
        router.push(`/messages/${data.data.conversationId}`);
      } else {
        toast.error(data.error?.message || "Failed to start conversation");
      }
    } catch (error) {
      console.error("Chat init error:", error);
      toast.error("Something went wrong");
    } finally {
      setIsContacting(false);
    }
  };

  const handleCancelShipment = (reason: string) => {
    cancelShipment(
      { id, reason },
      {
        onSuccess: () => {
          // Toast will be handled globally or we can add it here
          // For now just refresh or let the query invalidation handle it
        },
      }
    );
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!delivery) {
    return <div className="p-8 text-center">Shipment not found</div>;
  }

  return (
    <DeliveryDetail
      delivery={delivery}
      onContactDriver={handleContactDriver}
      onCancelShipment={handleCancelShipment}
      isCancelling={isCancelling}
      isContacting={isContacting}
    />
  );
}
