"use client";

import { useRef } from "react";
import { Camera, Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  useCaptureShipmentPhoto,
  useShipmentPhotos,
} from "../hooks/useShipmentPhotos";
import type { ShipmentPhotoStage } from "../api/shipment-photos.api";

/**
 * The driver's half: take a photo, see what has been taken, and learn why the
 * advance button is still disabled.
 *
 * `capture="environment"` on its own input, not shared with a gallery picker -
 * sharing one input is what made "Prendre une photo" open the gallery on
 * `/create` (cargo_input_spec.md). Evidence has to come off the camera.
 */

interface ShipmentPhotoCaptureProps {
  shipmentId: string;
  stage: ShipmentPhotoStage;
}

export function ShipmentPhotoCapture({
  shipmentId,
  stage,
}: ShipmentPhotoCaptureProps) {
  const t = useTranslations("shipmentPhotos");
  const inputRef = useRef<HTMLInputElement>(null);
  const { pickup, delivery } = useShipmentPhotos(shipmentId);
  const capture = useCaptureShipmentPhoto(shipmentId, stage);

  const photos = stage === "pickup" ? pickup : delivery;
  const isBusy = capture.isPending || capture.isLocating;

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("errors.invalidType"));
      return;
    }
    capture.mutate(file);
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => inputRef.current?.click()}
        disabled={isBusy || !capture.isSupported}
      >
        {isBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        {capture.isLocating
          ? t("locating")
          : capture.isPending
            ? t("sending")
            : t(photos.length === 0 ? "takeFirst" : "takeAnother")}
      </Button>

      {!capture.isSupported && (
        <p className="text-xs text-destructive">
          {t("errors.locationUnsupported")}
        </p>
      )}

      {photos.length > 0 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo) => (
            <li key={photo.id} className="shrink-0">
              <img
                src={photo.url}
                alt=""
                loading="lazy"
                className="h-16 w-16 rounded-md border object-cover"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
          {t("locationHint")}
        </p>
      )}
    </div>
  );
}

/**
 * The reason an advance button is disabled, spelled out. A grey control with
 * no explanation is how a driver ends up calling support.
 */
export function PhotoRequirementNotice({ show }: { show: boolean }) {
  const t = useTranslations("shipmentPhotos");
  if (!show) return null;

  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <X className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
      {t("required")}
    </p>
  );
}
