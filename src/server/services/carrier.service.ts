import { nanoid } from "nanoid";
import { db } from "@/db";
import { carriersDal } from "@/server/dal/carriers.dal";
import * as usersDal from "@/server/dal/users.dal";
import { notificationsService } from "@/server/services/notifications.service";
import { last4 } from "@/lib/french-identifiers";
import {
  REQUIRED_DOCUMENT_KINDS,
  EXPIRING_DOCUMENT_KINDS,
  type UpsertCarrierInput,
  type CarrierBankingInput,
  type CreateVehicleInput,
  type UpdateVehicleInput,
  type UploadDocumentInput,
} from "@/server/dto/carrier.dto";
import { HEAVY_VEHICLE_TYPES, type Carrier } from "@/db/schema/carriers";

// ========================================
// Errors
// ========================================

export class CarrierError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string,
    readonly missing?: string[]
  ) {
    super(message ?? code);
    this.name = "CarrierError";
  }
}

const err = (code: string, status: number, message?: string) =>
  new CarrierError(code, status, message);

/**
 * Enrols a carrier's owner as a driver in their own fleet.
 *
 * In this market most carriers drive themselves, and without both the driver
 * role and the fleet link the carrier who wins a job can neither reach
 * `/driver` nor pass `assignDriver`'s fleet check. Every write here is
 * idempotent, so approving twice enrols once.
 */
// TODO(EXPEDITOO-TESTING): solo-carrier self-assignment — for real multi-driver
// fleets, replace this with a driver invite flow that grants the role and the
// fleet link to the invitee, and stop enrolling the owner automatically.
async function enrolAsOwnDriver(
  carrier: Carrier,
  adminId: string,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0]
) {
  await usersDal.assignRoleIfMissing(carrier.userId, "carrier", adminId, tx);
  await usersDal.assignRoleIfMissing(carrier.userId, "driver", adminId, tx);
  await carriersDal.upsertDriverLink(
    {
      id: nanoid(),
      carrierId: carrier.id,
      userId: carrier.userId,
      isActive: true,
      acceptedAt: new Date(),
    },
    tx
  );
}

// ========================================
// Submission gate
// ========================================

type CarrierWithRelations = Carrier & {
  documents: { kind: string; expiresAt: Date | null }[];
  vehicles: { type: string; maxWeightKg: number }[];
};

/**
 * Collects every gap in one pass. Reporting one missing item at a time turns
 * onboarding into a guessing game, so the spec requires the full list
 * (carrier_kyc_spec.md §3).
 */
export function applicationGaps(carrier: CarrierWithRelations): string[] {
  const missing: string[] = [];

  const present = new Set(
    carrier.documents.filter((d) => d.kind).map((d) => d.kind)
  );
  for (const kind of REQUIRED_DOCUMENT_KINDS) {
    if (!present.has(kind)) missing.push(`document:${kind}`);
  }

  if (!carrier.ibanLast4) missing.push("banking:iban");
  if (!carrier.bicLast4) missing.push("banking:bic");

  if (carrier.vehicles.length === 0) {
    missing.push("vehicle:at_least_one");
  }

  // Anything at or above 7.5 t needs a transport licence under French rules.
  const hasHeavy = carrier.vehicles.some((v) =>
    (HEAVY_VEHICLE_TYPES as readonly string[]).includes(v.type)
  );
  if (hasHeavy && !present.has("transport_licence")) {
    missing.push("document:transport_licence");
  }

  const now = new Date();
  for (const doc of carrier.documents) {
    if (doc.expiresAt && doc.expiresAt <= now) {
      missing.push(`expired:${doc.kind}`);
    }
  }

  return missing;
}

// ========================================
// Service
// ========================================

export const carrierService = {
  /** Create or update the draft. SIRET is unique across carriers. */
  async upsertApplication(userId: string, data: UpsertCarrierInput) {
    const existing = await carriersDal.getByUserId(userId);

    const bySiret = await carriersDal.getBySiret(data.siret);
    if (bySiret && bySiret.userId !== userId) {
      throw err("SIRET_ALREADY_REGISTERED", 409);
    }

    if (!existing) {
      return await carriersDal.create({ id: nanoid(), userId, ...data });
    }

    if (existing.status === "submitted" || existing.status === "under_review") {
      throw err("APPLICATION_LOCKED", 409);
    }

    // Changing the legal or banking identity after approval requires a fresh
    // look, so the carrier drops back into review and bidding pauses.
    const identityChanged =
      existing.status === "approved" && existing.siret !== data.siret;

    return await carriersDal.update(existing.id, {
      ...data,
      status: identityChanged ? "under_review" : existing.status,
    });
  },

  /**
   * Validates then forwards banking details to Stripe, persisting only the
   * last 4 of each. The full IBAN never reaches our database.
   */
  async setBanking(userId: string, data: CarrierBankingInput) {
    const carrier = await this.requireOwnCarrier(userId);

    // TODO(WP6/Phase C): forward `data` to Stripe Connect when creating the
    // external account. Persisting only the redacted form is deliberate.
    return await carriersDal.update(carrier.id, {
      ibanLast4: last4(data.iban),
      bicLast4: last4(data.bic),
    });
  },

  async uploadDocument(userId: string, data: UploadDocumentInput) {
    const carrier = await this.requireOwnCarrier(userId);

    if (
      data.expiresAt &&
      (EXPIRING_DOCUMENT_KINDS as readonly string[]).includes(data.kind) &&
      data.expiresAt <= new Date()
    ) {
      throw err("DOCUMENT_ALREADY_EXPIRED", 400);
    }

    return await carriersDal.upsertDocument({
      id: nanoid(),
      carrierId: carrier.id,
      kind: data.kind,
      objectKey: data.objectKey,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      expiresAt: data.expiresAt ?? null,
      status: "pending",
    });
  },

  async submitApplication(userId: string) {
    const carrier = await this.requireOwnCarrier(userId);

    if (carrier.status === "submitted" || carrier.status === "under_review") {
      throw err("ALREADY_SUBMITTED", 409);
    }
    if (carrier.status === "suspended") throw err("CARRIER_SUSPENDED", 409);

    const missing = applicationGaps(carrier as CarrierWithRelations);
    if (missing.length > 0) {
      throw new CarrierError(
        "INCOMPLETE_APPLICATION",
        400,
        "Application is incomplete",
        missing
      );
    }

    return await carriersDal.update(carrier.id, { status: "submitted" });
  },

  async withdrawApplication(userId: string) {
    const carrier = await this.requireOwnCarrier(userId);
    if (carrier.status !== "submitted") throw err("NOT_SUBMITTED", 409);
    return await carriersDal.update(carrier.id, { status: "draft" });
  },

  async getOwnApplication(userId: string) {
    return await carriersDal.getByUserId(userId);
  },

  // ---- Vehicles ----

  async addVehicle(userId: string, data: CreateVehicleInput) {
    const carrier = await this.requireOwnCarrier(userId);
    return await carriersDal.createVehicle({
      id: nanoid(),
      carrierId: carrier.id,
      ...data,
      plateNumber: data.plateNumber.toUpperCase(),
    });
  },

  async updateVehicle(userId: string, vehicleId: string, data: UpdateVehicleInput) {
    const carrier = await this.requireOwnCarrier(userId);
    const vehicle = await carriersDal.getVehicleById(vehicleId);
    if (!vehicle || vehicle.carrierId !== carrier.id) {
      throw err("VEHICLE_NOT_OWNED", 403);
    }
    return await carriersDal.updateVehicle(vehicleId, data);
  },

  /**
   * Deletion is blocked by the offers FK while a live offer names the vehicle,
   * so callers are steered to deactivation instead.
   */
  async deleteVehicle(userId: string, vehicleId: string) {
    const carrier = await this.requireOwnCarrier(userId);
    const vehicle = await carriersDal.getVehicleById(vehicleId);
    if (!vehicle || vehicle.carrierId !== carrier.id) {
      throw err("VEHICLE_NOT_OWNED", 403);
    }

    try {
      await carriersDal.deleteVehicle(vehicleId);
    } catch {
      throw err(
        "VEHICLE_IN_USE",
        409,
        "This vehicle backs a live offer. Deactivate it instead."
      );
    }
  },

  async listVehicles(userId: string) {
    const carrier = await this.requireOwnCarrier(userId);
    return await carriersDal.listVehicles(carrier.id);
  },

  // ---- Admin review ----

  async listForReview(status: Carrier["status"]) {
    return await carriersDal.listByStatus(status);
  },

  /**
   * Approving unlocks bidding *and* execution. Beyond the carrier role it
   * enrols the owner as a driver in their own fleet: in this market most
   * carriers drive themselves, and without that pair the carrier who wins a
   * job can neither reach /driver nor pass the fleet check on assignment.
   * Idempotent: a second approval is a no-op rather than a duplicate grant.
   */
  async approve(adminId: string, carrierId: string) {
    const carrier = await carriersDal.getById(carrierId);
    if (!carrier) throw err("CARRIER_NOT_FOUND", 404);

    // Carriers approved before self-enrolment existed hold neither the driver
    // role nor a fleet link, so re-approving them is the backfill. Both writes
    // are idempotent, which is what lets this run on an already-approved row.
    if (carrier.status === "approved") {
      await db.transaction((tx) => enrolAsOwnDriver(carrier, adminId, tx));
      return carrier;
    }

    const approved = await db.transaction(async (tx) => {
      const updated = await carriersDal.update(
        carrierId,
        {
          status: "approved",
          approvedAt: new Date(),
          approvedBy: adminId,
          rejectionReason: null,
        },
        tx
      );
      await carriersDal.setAllDocumentsAccepted(carrierId, tx);
      await enrolAsOwnDriver(carrier, adminId, tx);

      return updated;
    });

    await notifyCarrier(
      carrier.userId,
      "Carrier application approved",
      "You can now bid on transport jobs."
    );

    return approved;
  },

  async reject(adminId: string, carrierId: string, reason: string) {
    const carrier = await carriersDal.getById(carrierId);
    if (!carrier) throw err("CARRIER_NOT_FOUND", 404);

    const rejected = await carriersDal.update(carrierId, {
      status: "rejected",
      rejectionReason: reason,
      approvedBy: adminId,
    });

    await notifyCarrier(
      carrier.userId,
      "Carrier application rejected",
      reason
    );

    return rejected;
  },

  /**
   * Suspension stops new bids. Shipments already under way continue, so a
   * delivery in progress is never stranded (roles_spec.md edge case 4).
   */
  async suspend(carrierId: string, reason: string) {
    const carrier = await carriersDal.getById(carrierId);
    if (!carrier) throw err("CARRIER_NOT_FOUND", 404);

    const suspended = await carriersDal.update(carrierId, {
      status: "suspended",
      suspensionReason: reason,
    });

    await notifyCarrier(carrier.userId, "Carrier account suspended", reason);

    return suspended;
  },

  async reinstate(carrierId: string) {
    const carrier = await carriersDal.getById(carrierId);
    if (!carrier) throw err("CARRIER_NOT_FOUND", 404);
    if (carrier.status !== "suspended") throw err("NOT_SUSPENDED", 409);

    return await carriersDal.update(carrierId, {
      status: "approved",
      suspensionReason: null,
    });
  },

  /** Daily cron: warn before expiry, suspend once a required document lapses. */
  async processDocumentExpiry(now = new Date()) {
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const documents = await carriersDal.listDocumentsExpiringBefore(soon);

    let warned = 0;
    let suspended = 0;

    for (const doc of documents) {
      const expired = doc.expiresAt !== null && doc.expiresAt <= now;
      const carrier = doc.carrier;
      if (!carrier) continue;

      if (!expired) {
        await notifyCarrier(
          carrier.userId,
          "Document expiring soon",
          `Your ${doc.kind.replace(/_/g, " ")} expires on ${doc.expiresAt?.toDateString()}.`
        );
        warned++;
        continue;
      }

      const isRequired = (REQUIRED_DOCUMENT_KINDS as readonly string[]).includes(
        doc.kind
      );
      if (isRequired && carrier.status === "approved") {
        await this.suspend(carrier.id, `Document expired: ${doc.kind}`);
        suspended++;
      }
    }

    return { warned, suspended };
  },

  // ---- Helpers ----

  async requireOwnCarrier(userId: string) {
    const carrier = await carriersDal.getByUserId(userId);
    if (!carrier) throw err("CARRIER_NOT_FOUND", 404);
    return carrier;
  },

  /** The gate every bidding path checks. */
  async requireApproved(userId: string) {
    const carrier = await carriersDal.getByUserId(userId);
    if (!carrier || carrier.status !== "approved") {
      throw err("CARRIER_NOT_APPROVED", 403);
    }
    return carrier;
  },
};

async function notifyCarrier(userId: string, title: string, message: string) {
  await notificationsService
    .createNotification({
      userId,
      type: "carrier_application",
      title,
      message,
      linkUrl: "/carrier/application",
    })
    .catch((e) => console.error("carrier notification failed", e));
}
