import { nanoid } from "nanoid";
import { createPrivateR2Store } from "./storage/private-r2";
import type { ShipmentPhotoStage } from "@/db/schema/shipments";

/**
 * Where pickup and delivery photos live.
 *
 * A private bucket, never the public one. These are photographs of a client's
 * goods standing at a client's address, and the whole feature would be
 * self-defeating if the evidence were readable by anyone who came across the
 * URL. Reads go through `/api/shipments/:id/photos/:photoId`, which checks the
 * caller is a party to the shipment and only then mints a five-minute link.
 *
 * See shipment_photos_spec.md §4 for why `R2_BUCKET_NAME` is absent from the
 * fallback list: the image-cleanup cron sweeps that bucket and would delete
 * every one of these on its first non-dry run.
 */
const store = createPrivateR2Store({
  label: "shipment photos",
  bucketEnvVars: [
    "R2_SHIPMENT_BUCKET_NAME",
    "R2_KYC_BUCKET_NAME",
    "R2_EXPEDION_BUCKET_NAME",
  ],
});

const PRIVATE_PREFIX = "shipments";

export const shipmentPhotoStorageService = {
  /**
   * Returns the object key, never a URL.
   *
   * Keyed by shipment rather than by uploader: everything about one run should
   * be listable with one prefix when support has to reconstruct it. The
   * `nanoid()` means two photos taken seconds apart cannot overwrite each
   * other, and the original filename is never used — it is client-controlled
   * and tells us nothing the row does not.
   */
  async upload(
    shipmentId: string,
    stage: ShipmentPhotoStage,
    body: Buffer,
    mimeType: string
  ): Promise<string> {
    return await store.upload(
      `${PRIVATE_PREFIX}/${shipmentId}/${stage}-${nanoid()}`,
      body,
      mimeType
    );
  },

  async presignRead(objectKey: string): Promise<string> {
    return await store.presignRead(objectKey);
  },
};
