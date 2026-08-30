import { api } from "@/lib/fetcher";

/**
 * Pickup and delivery photos, shared by the driver surface that takes them and
 * the client surface that reads them.
 *
 * `url` is always a path back into this app - never an R2 address. The object
 * itself has no public URL; that route authorises the caller and only then
 * redirects to a five-minute presigned link, so an `<img src>` pointed at it
 * works and a copied link does not outlive the page.
 */

export type ShipmentPhotoStage = "pickup" | "delivery";

export interface ShipmentPhoto {
  id: string;
  stage: ShipmentPhotoStage;
  url: string;
  capturedLat: number;
  capturedLng: number;
  capturedAccuracyM: number | null;
  capturedAddress: string | null;
  capturedAt: string;
  recordedAt: string;
}

export interface ShipmentPhotoGroups {
  pickup: ShipmentPhoto[];
  delivery: ShipmentPhoto[];
}

/** What the browser must have before a photo can be sent at all. */
export interface CapturedLocation {
  lat: number;
  lng: number;
  accuracyM: number | null;
  capturedAt: string;
}

export const shipmentPhotosApi = {
  list: (shipmentId: string) =>
    api.get<ShipmentPhotoGroups>(`/api/shipments/${shipmentId}/photos`),

  /**
   * One request carrying both the bytes and the fix. They are deliberately not
   * two calls: the claim the feature makes is that this picture was taken
   * there, and an endpoint that accepts them separately accepts any picture
   * with any location.
   */
  capture: (
    shipmentId: string,
    stage: ShipmentPhotoStage,
    file: File,
    location: CapturedLocation
  ) => {
    const body = new FormData();
    body.append("file", file);
    body.append("stage", stage);
    body.append("lat", String(location.lat));
    body.append("lng", String(location.lng));
    if (location.accuracyM !== null) {
      body.append("accuracyM", String(location.accuracyM));
    }
    body.append("capturedAt", location.capturedAt);

    return api.post<ShipmentPhoto>(
      `/api/shipments/${shipmentId}/photos`,
      body
    );
  },
};
