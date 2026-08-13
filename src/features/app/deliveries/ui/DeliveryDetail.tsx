"use client";
import { useAuth } from "@/lib/auth-context";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Timeline } from "./Timeline";
import {
  MessageCircle,
  MapPin,
  Phone,
  Mail,
  Star,
  AlertTriangle,
  ArrowLeft,
  Pencil,
} from "lucide-react";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { CreateReviewModal } from "@/features/app/common/ui/CreateReviewModal";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { DeliveryDetailData } from "../types";
import { useTranslations } from "next-intl";

/**
 * Pure UI component for displaying delivery detail
 * Follows Single Responsibility Principle - only handles presentation
 * Business logic handled by useDeliveryDetail hook in page
 *
 * @param delivery - Delivery detail data
 * @param onContactDriver - Callback when contact button is clicked
 * @param onCancelShipment - Callback when cancel is confirmed
 * @param isCancelling - Loading state for cancellation
 * @param isContacting - Loading state for contacting driver
 */
interface DeliveryDetailProps {
  delivery: DeliveryDetailData;
  onContactDriver?: () => void;
  onCancelShipment?: (reason: string) => void;
  isCancelling?: boolean;
  isContacting?: boolean;
}

export function DeliveryDetail({
  delivery,
  onContactDriver,
  onCancelShipment,
  isCancelling = false,
  isContacting = false,
}: DeliveryDetailProps) {
  const t = useTranslations("deliveries");
  const tCommon = useTranslations("common");
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const handleCancel = () => {
    if (onCancelShipment && cancelReason.trim()) {
      onCancelShipment(cancelReason);
      setIsCancelDialogOpen(false);
    }
  };

  const canCancel = ["pending", "accepted"].includes(delivery.status);

  const router = useRouter();

  return (
    <div className="  mx-auto p-4 md:p-6 pb-32 md:pb-12">
      {/* Back Button & Header Actions */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full -ml-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {delivery.title}
            </h1>
            <Badge className="bg-primary/10 text-primary mt-2">
              {delivery.price}€
            </Badge>
          </div>
        </div>

        {canCancel && (
          <div className="flex gap-2">
            {/* Modify Shipment Button - Only for early status */}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                // TODO: Implement modify shipment flow
                console.log("Modify shipment:", delivery.id);
              }}
            >
              <Pencil className="w-4 h-4" />
              {t("buttons.modifyShipment")}
            </Button>

            <Dialog
              open={isCancelDialogOpen}
              onOpenChange={setIsCancelDialogOpen}
            >
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {t("buttons.cancelShipment")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("dialogs.cancel.title")}</DialogTitle>
                  <DialogDescription>
                    {t("dialogs.cancel.description")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="reason">
                      {t("dialogs.cancel.reasonLabel")}
                    </Label>
                    <Textarea
                      id="reason"
                      placeholder={t("dialogs.cancel.reasonPlaceholder")}
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsCancelDialogOpen(false)}
                    disabled={isCancelling}
                  >
                    {t("buttons.keepShipment")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleCancel}
                    disabled={!cancelReason.trim() || isCancelling}
                  >
                    {isCancelling
                      ? t("buttons.cancelling")
                      : t("buttons.confirmCancellation")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Route info */}
      <div className="bg-card rounded-lg p-4 border border-border mb-6">
        <div className="space-y-3">
          <div className="flex gap-3">
            <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">
                {t("details.from")}
              </p>
              <p className="font-medium text-foreground">{delivery.origin}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">{t("details.to")}</p>
              <p className="font-medium text-foreground">
                {delivery.destination}
              </p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground pt-2 border-t border-border">
            {delivery.dates}
          </div>
        </div>
      </div>

      {/* Driver Info */}
      <div className="bg-card rounded-lg p-4 border border-border mb-6">
        <h2 className="font-bold text-foreground mb-4">
          {t("details.driver")}
        </h2>
        <div className="flex items-start gap-4 mb-4">
          <div
            className="w-12 h-12 rounded-full bg-linear-to-br from-primary to-accent-pink shrink-0"
            style={{
              backgroundImage: `url('${delivery.driver.avatar}')`,
              backgroundSize: "cover",
            }}
          />
          <div className="flex-1">
            <h3 className="font-bold text-foreground">
              {delivery.driver.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              ⭐ {delivery.driver.rating}/5 -{" "}
              {t("details.reviews", { count: delivery.driver.reviews })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {delivery.driver.vehicle}
            </p>
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t border-border">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={onContactDriver}
            disabled={isContacting || delivery.status === "delivered"}
          >
            {isContacting ? (
              <LottieLoader width={20} height={20} />
            ) : (
              <MessageCircle className="w-4 h-4" />
            )}
            {t("buttons.contactDriver")}
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-card rounded-lg p-4 border border-border mb-12">
        <h2 className="font-bold text-foreground mb-6">
          {tCommon("navigation.shipmentTracking")}
        </h2>
        <Timeline events={delivery.timeline} />
      </div>

      <ReviewActionButtons
        delivery={delivery}
        isContacting={isContacting}
        onContactDriver={onContactDriver}
      />
    </div>
  );
}

function ReviewActionButtons({
  delivery,
  isContacting,
  onContactDriver,
}: {
  delivery: DeliveryDetailData;
  isContacting: boolean;
  onContactDriver?: () => void;
}) {
  const { user } = useAuth();
  const [showReviewModal, setShowReviewModal] = useState(false);
  const t = useTranslations("deliveries");
  const isDelivered = delivery.status === "delivered";

  // Determine role and target
  const isDriver = user?.id === delivery.driver.id;

  if (isDelivered && delivery.driver.id) {
    // Already reviewed - show "Reviewed" badge
    if (delivery.hasReviewed) {
      return (
        <div className="fixed bottom-20 md:bottom-6 left-0 right-0 md:relative px-4 md:px-0">
          <div className="w-full h-12 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center gap-2 text-green-600 font-semibold">
            <Star className="w-5 h-5 fill-current" />
            {t("buttons.reviewed")}
          </div>
        </div>
      );
    }

    // If I am the driver - rate client
    if (isDriver) {
      return (
        <>
          <div className="fixed bottom-20 md:bottom-6 left-0 right-0 md:relative px-4 md:px-0 space-y-2">
            <Button
              onClick={() => setShowReviewModal(true)}
              className="w-full h-12 rounded-full text-base font-bold gap-2 bg-yellow-500 hover:bg-yellow-600 text-black"
            >
              <Star className="w-5 h-5 fill-current" />
              {t("buttons.rateClient")}
            </Button>
          </div>
          <CreateReviewModal
            isOpen={showReviewModal}
            onClose={() => setShowReviewModal(false)}
            targetUserId={delivery.userId}
            targetUserName="Client"
            shipmentId={delivery.id}
          />
        </>
      );
    }

    // Default: Client reviewing driver
    return (
      <>
        <div className="fixed bottom-20 md:bottom-6 left-0 right-0 md:relative px-4 md:px-0 space-y-2">
          <Button
            onClick={() => setShowReviewModal(true)}
            className="w-full h-12 rounded-full text-base font-bold gap-2 bg-yellow-500 hover:bg-yellow-600 text-black"
          >
            <Star className="w-5 h-5 fill-current" />
            {t("buttons.rateDriver")}
          </Button>
        </div>
        <CreateReviewModal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          targetUserId={delivery.driver.id!}
          targetUserName={delivery.driver.name}
          shipmentId={delivery.id}
        />
      </>
    );
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 left-0 right-0 md:relative px-4 md:px-0">
      <Button
        onClick={onContactDriver}
        disabled={isContacting || !delivery.driver.id}
        className="w-full h-12 rounded-full text-base font-bold gap-2"
      >
        {isContacting ? (
          <LottieLoader width={25} height={25} />
        ) : (
          <MessageCircle className="w-5 h-5" />
        )}
        {t("buttons.contactDriver")}
      </Button>
    </div>
  );
}
