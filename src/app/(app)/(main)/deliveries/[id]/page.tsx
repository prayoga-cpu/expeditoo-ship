"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PackageX } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageLoader } from "@/components/ui/page-loader";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { DeliveryDetail } from "@/features/app/deliveries/ui";
import {
  useDeliveryDetail,
  useCancelShipment,
} from "@/features/app/deliveries/hooks";
import { useAuth } from "@/lib/auth-context";

/**
 * Delivery detail page - orchestration only. Data and mapping live in the
 * hooks, presentation in the feature UI.
 */
export default function DeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("deliveries");
  const router = useRouter();
  const { user } = useAuth();
  const { delivery, isLoading, error } = useDeliveryDetail(id);
  const cancelShipment = useCancelShipment();
  const [isContacting, setIsContacting] = useState(false);

  const handleContact = async () => {
    if (!delivery) return;

    if (!user) {
      router.push("/signin");
      return;
    }

    try {
      setIsContacting(true);
      const res = await fetch("/api/messages/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: delivery.counterpart.id,
          listingId: delivery.listingId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        router.push(`/messages/${data.data.conversationId}`);
      } else {
        toast.error(data.error?.message || t("errors.contactFailed"));
      }
    } catch (err) {
      console.error("Chat init error:", err);
      toast.error(t("errors.contactFailed"));
    } finally {
      setIsContacting(false);
    }
  };

  if (isLoading) return <PageLoader />;

  if (!delivery) {
    return (
      <CenteredEmptyState
        variant="page"
        icon={PackageX}
        title={t("errors.notFound")}
        description={error ?? t("errors.notFoundDesc")}
      />
    );
  }

  return (
    <DeliveryDetail
      delivery={delivery}
      onContact={handleContact}
      onCancel={(reason) => cancelShipment.mutate({ id, reason })}
      isCancelling={cancelShipment.isPending}
      isContacting={isContacting}
    />
  );
}
