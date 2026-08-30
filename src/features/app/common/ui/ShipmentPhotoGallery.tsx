"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Camera, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslations } from "next-intl";
import type { ShipmentPhoto } from "../api/shipment-photos.api";

/**
 * The photos of one stage, as anyone with a right to see them reads them.
 *
 * Every thumbnail carries its location and time as **text** underneath, not
 * only burned into the pixels. The burn-in travels with a forwarded image; the
 * text is what stays legible if the host has no fonts for the overlay
 * (shipment_photos_spec.md §5.4), and it is selectable, which a picture of
 * words is not.
 */

interface ShipmentPhotoGalleryProps {
  photos: ShipmentPhoto[];
  /** Rendered when the stage has nothing yet - never hidden. A client looking
   *  for pickup photos should learn there are none, not have to guess. */
  emptyLabel: string;
  title: string;
}

export function ShipmentPhotoGallery({
  photos,
  emptyLabel,
  title,
}: ShipmentPhotoGalleryProps) {
  const [opened, setOpened] = useState<ShipmentPhoto | null>(null);

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <Camera className="h-4 w-4 text-muted-foreground" />
        {title}
        {photos.length > 0 && (
          <span className="font-mono text-xs text-muted-foreground">
            {photos.length}
          </span>
        )}
      </h3>

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <li key={photo.id} className="space-y-1.5">
              <button
                type="button"
                onClick={() => setOpened(photo)}
                className="block w-full overflow-hidden rounded-lg border bg-muted transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <img
                  src={photo.url}
                  alt={photo.capturedAddress ?? title}
                  loading="lazy"
                  className="aspect-4/3 w-full object-cover"
                />
              </button>
              <PhotoMeta photo={photo} />
            </li>
          ))}
        </ul>
      )}

      <PhotoDialog photo={opened} onClose={() => setOpened(null)} />
    </section>
  );
}

/** The same three facts the burn-in carries, as selectable text. */
function PhotoMeta({ photo }: { photo: ShipmentPhoto }) {
  return (
    <div className="space-y-0.5 text-xs text-muted-foreground">
      <p className="font-mono">
        {format(new Date(photo.recordedAt), "dd/MM/yyyy HH:mm")}
      </p>
      {photo.capturedAddress && (
        <p className="flex items-start gap-1">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="min-w-0 break-words">{photo.capturedAddress}</span>
        </p>
      )}
      <p className="font-mono">
        {photo.capturedLat.toFixed(5)}, {photo.capturedLng.toFixed(5)}
        {photo.capturedAccuracyM !== null &&
          ` · ±${Math.round(photo.capturedAccuracyM)} m`}
      </p>
    </div>
  );
}

function PhotoDialog({
  photo,
  onClose,
}: {
  photo: ShipmentPhoto | null;
  onClose: () => void;
}) {
  const t = useTranslations("shipmentPhotos");

  return (
    <Dialog open={!!photo} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        {photo && (
          <>
            <DialogHeader>
              <DialogTitle>
                {t(photo.stage === "pickup" ? "pickupTitle" : "deliveryTitle")}
              </DialogTitle>
              <DialogDescription className="font-mono">
                {format(new Date(photo.recordedAt), "dd/MM/yyyy HH:mm")}
                {photo.capturedAddress ? ` · ${photo.capturedAddress}` : ""}
              </DialogDescription>
            </DialogHeader>
            <img
              src={photo.url}
              alt={photo.capturedAddress ?? ""}
              className="max-h-[70vh] w-full rounded-lg object-contain"
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
