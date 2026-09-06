"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  MapPin,
  MessageCircle,
  Star,
  Camera,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { formatCurrency } from "@/lib/currency";
import { CreateReviewModal } from "@/features/app/common/ui/CreateReviewModal";
import { useCanReview } from "@/features/app/common/hooks/useCanReview";
import { useTranslations } from "next-intl";
import { useShipmentPhotos } from "@/features/app/common/hooks/useShipmentPhotos";
import { ShipmentPhotoGallery } from "@/features/app/common/ui/ShipmentPhotoGallery";
import { ShipmentIncidentsSection } from "@/features/app/incidents/ui";
import { StopTransportDialog } from "@/features/app/common/ui/StopTransportDialog";
import type { CancellationCategory } from "@/lib/cancellation-policy";
import { ShipmentStatusBadge } from "./ShipmentStatusBadge";
import { Timeline } from "./Timeline";
import type { DeliveryDetailView } from "../types";

interface DeliveryDetailProps {
  delivery: DeliveryDetailView;
  onContact?: () => void;
  onCancel?: (input: {
    category: CancellationCategory;
    reason?: string;
  }) => Promise<unknown>;
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
          <div className="w-full sm:w-auto sm:min-w-56">
            <StopTransportDialog
              side="requester"
              onConfirm={onCancel}
              isPending={isCancelling}
            />
          </div>
        )}
      </header>

      <RouteCard delivery={delivery} />

      <ShipmentIncidentsSection
        shipmentId={delivery.id}
        canReport={
          delivery.status !== "DELIVERED" && delivery.status !== "CANCELLED"
        }
      />

      <CounterpartCard
        delivery={delivery}
        onContact={onContact}
        isContacting={isContacting}
      />

      <Card className="space-y-4 p-4 sm:p-5">
        <h2 className="font-semibold">{t("details.tracking")}</h2>
        <Separator />
        <Timeline steps={delivery.timeline} />

        {delivery.status === "CANCELLED" && <CancellationNote delivery={delivery} />}

      </Card>

      <ShipmentPhotosCard shipmentId={delivery.id} />

      {delivery.status === "DELIVERED" && <ReviewSection delivery={delivery} />}
    </div>
  );
}

/**
 * What the transporter photographed at each end, for the person whose goods
 * they are.
 *
 * Both groups render even when empty: a client looking for pickup photos on a
 * run that has not been collected should read that from the screen rather than
 * wonder whether the section is missing.
 *
 * Nothing is hidden behind the run being finished, either - a pickup photo is
 * most useful while the goods are still in transit.
 */
function ShipmentPhotosCard({ shipmentId }: { shipmentId: string }) {
  const t = useTranslations("shipmentPhotos");
  const { pickup, delivery, isError } = useShipmentPhotos(shipmentId);

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Camera className="h-4 w-4 text-muted-foreground" />
        {t("sectionTitle")}
      </h2>
      <Separator />
      {isError ? (
        <p className="text-sm text-destructive">{t("errors.loadFailed")}</p>
      ) : (
        <>
          <ShipmentPhotoGallery
            title={t("pickupTitle")}
            photos={pickup}
            emptyLabel={t("noneAtPickup")}
          />
          <ShipmentPhotoGallery
            title={t("deliveryTitle")}
            photos={delivery}
            emptyLabel={t("noneAtDelivery")}
          />
        </>
      )}
    </Card>
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

/**
 * Who stopped it, and why.
 *
 * The free-text reason was all this ever showed, so a client whose transporter
 * dropped out read the same box as one whose own request had been called off.
 * The side and the category are the part that answers the question actually
 * being asked.
 */
function CancellationNote({ delivery }: { delivery: DeliveryDetailView }) {
  const t = useTranslations("shipments.stop");
  const d = useTranslations("deliveries");

  if (!delivery.cancelledBySide && !delivery.cancellationReason) return null;

  return (
    <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      {delivery.cancelledBySide && (
        <p className="font-medium">
          {t(`by.${delivery.cancelledBySide}`)}
          {delivery.cancellationCategory
            ? ` — ${t(`categories.${delivery.cancellationCategory}`)}`
            : ""}
        </p>
      )}
      {delivery.cancellationReason && (
        <p>
          {d("details.cancellationReason")}: {delivery.cancellationReason}
        </p>
      )}
    </div>
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
