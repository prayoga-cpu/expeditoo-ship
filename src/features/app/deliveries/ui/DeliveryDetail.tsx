"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  MapPin,
  MessageCircle,
  AlertTriangle,
  Star,
  Camera,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { LottieLoader } from "@/components/ui/lottie-loader";
import { formatCurrency } from "@/lib/currency";
import { CreateReviewModal } from "@/features/app/common/ui/CreateReviewModal";
import { useCanReview } from "@/features/app/common/hooks/useCanReview";
import { useTranslations } from "next-intl";
import { ShipmentStatusBadge } from "./ShipmentStatusBadge";
import { Timeline } from "./Timeline";
import type { DeliveryDetailView } from "../types";

interface DeliveryDetailProps {
  delivery: DeliveryDetailView;
  onContact?: () => void;
  onCancel?: (reason: string) => void;
  isCancelling?: boolean;
  isContacting?: boolean;
}

/** Full tracking view of one shipment, for any party to it. */
export function DeliveryDetail({
  delivery,
  onContact,
  onCancel,
  isCancelling = false,
  isContacting = false,
}: DeliveryDetailProps) {
  const t = useTranslations("deliveries");
  const router = useRouter();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 pb-24 sm:p-6">
      <header className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 rounded-full"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ShipmentStatusBadge status={delivery.status} />
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">
            {delivery.title}
          </h1>
          {delivery.priceCents !== undefined && (
            <p className="mt-1 font-mono text-lg text-muted-foreground">
              {t("details.agreedPrice")} {formatCurrency(delivery.priceCents)}
            </p>
          )}
        </div>

        {delivery.canCancel && onCancel && (
          <CancelDialog onCancel={onCancel} isCancelling={isCancelling} />
        )}
      </header>

      <RouteCard delivery={delivery} />

      <CounterpartCard
        delivery={delivery}
        onContact={onContact}
        isContacting={isContacting}
      />

      <Card className="space-y-4 p-4 sm:p-5">
        <h2 className="font-semibold">{t("details.tracking")}</h2>
        <Separator />
        <Timeline steps={delivery.timeline} />

        {delivery.status === "CANCELLED" && delivery.cancellationReason && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {t("details.cancellationReason")}: {delivery.cancellationReason}
          </p>
        )}

        {delivery.proofOfDeliveryUrl && (
          <Button variant="outline" className="gap-2" asChild>
            <a
              href={delivery.proofOfDeliveryUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Camera className="h-4 w-4" />
              {t("details.proofOfDelivery")}
            </a>
          </Button>
        )}
      </Card>

      {delivery.status === "DELIVERED" && <ReviewSection delivery={delivery} />}
    </div>
  );
}

function RouteCard({ delivery }: { delivery: DeliveryDetailView }) {
  const t = useTranslations("deliveries.details");

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        {t("route")}
      </h2>
      <Separator />
      <div className="grid gap-4 sm:grid-cols-2">
        <Endpoint
          label={t("pickup")}
          address={delivery.pickupAddress}
          date={delivery.scheduledPickup}
        />
        <Endpoint
          label={t("dropoff")}
          address={delivery.dropoffAddress}
          date={delivery.scheduledDelivery}
        />
      </div>
    </Card>
  );
}

function Endpoint({
  label,
  address,
  date,
}: {
  label: string;
  address: string;
  date: string | null;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-medium">{address}</p>
      {date && (
        <p className="flex items-center gap-1.5 pt-1 text-sm text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          {format(new Date(date), "d MMM HH:mm")}
        </p>
      )}
    </div>
  );
}

/** The other party to the run, plus the assigned driver when there is one. */
function CounterpartCard({
  delivery,
  onContact,
  isContacting,
}: {
  delivery: DeliveryDetailView;
  onContact?: () => void;
  isContacting: boolean;
}) {
  const t = useTranslations("deliveries");
  const isShipperView = delivery.role === "shipper";

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <h2 className="font-semibold">
        {isShipperView ? t("details.carrier") : t("details.shipper")}
      </h2>
      <Separator />

      <div className="flex items-center gap-3">
        <Avatar className="h-11 w-11">
          <AvatarImage src={delivery.counterpart.image ?? undefined} />
          <AvatarFallback>
            {delivery.counterpart.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{delivery.counterpart.name}</p>
          {isShipperView && delivery.driver && (
            <p className="truncate text-sm text-muted-foreground">
              {t("details.driver")}: {delivery.driver.name}
            </p>
          )}
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={onContact}
        disabled={isContacting}
      >
        {isContacting ? (
          <LottieLoader width={20} height={20} />
        ) : (
          <MessageCircle className="h-4 w-4" />
        )}
        {isShipperView
          ? t("buttons.contactCarrier")
          : t("buttons.contactShipper")}
      </Button>
    </Card>
  );
}

function CancelDialog({
  onCancel,
  isCancelling,
}: {
  onCancel: (reason: string) => void;
  isCancelling: boolean;
}) {
  const t = useTranslations("deliveries");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onCancel(reason.trim());
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="gap-2">
          <AlertTriangle className="h-4 w-4" />
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
        <div className="space-y-2 py-2">
          <Label htmlFor="cancel-reason">
            {t("dialogs.cancel.reasonLabel")}
          </Label>
          <Textarea
            id="cancel-reason"
            placeholder={t("dialogs.cancel.reasonPlaceholder")}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isCancelling}
          >
            {t("buttons.keepShipment")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={reason.trim().length < 3 || isCancelling}
          >
            {isCancelling
              ? t("buttons.cancelling")
              : t("buttons.confirmCancellation")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Two-way review, offered once the goods arrived. Eligibility (and the target)
 * come from the reviews service - the UI never re-derives the counterparty.
 */
function ReviewSection({ delivery }: { delivery: DeliveryDetailView }) {
  const t = useTranslations("deliveries");
  const [showModal, setShowModal] = useState(false);
  const { data: eligibility } = useCanReview(delivery.id);

  if (!eligibility) return null;

  if (!eligibility.canReview) {
    if (eligibility.reason !== "ALREADY_REVIEWED") return null;
    return (
      <div className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-success/30 bg-success/10 font-semibold text-success">
        <Star className="h-5 w-5 fill-current" />
        {t("buttons.reviewed")}
      </div>
    );
  }

  return (
    <>
      <Button
        onClick={() => setShowModal(true)}
        className="h-12 w-full gap-2 rounded-full text-base font-bold"
      >
        <Star className="h-5 w-5" />
        {eligibility.role === "shipper"
          ? t("buttons.rateCarrier")
          : t("buttons.rateShipper")}
      </Button>
      <CreateReviewModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        targetUserId={eligibility.targetUserId}
        targetUserName={delivery.counterpart.name}
        listingId={delivery.listingId}
        shipmentId={delivery.id}
      />
    </>
  );
}
