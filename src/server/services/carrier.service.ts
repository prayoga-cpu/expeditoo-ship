import { nanoid } from "nanoid";
import { db } from "@/db";
import { carriersDal } from "@/server/dal/carriers.dal";
import * as usersDal from "@/server/dal/users.dal";
import { offersDal } from "@/server/dal/offers.dal";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { notificationsService } from "@/server/services/notifications.service";
import { emailService } from "@/server/services/email.service";
import { last4 } from "@/lib/french-identifiers";
import { mayTakeWork } from "@/lib/carrier-availability";
import {
  REQUIRED_DOCUMENT_KINDS,
  EXPIRING_DOCUMENT_KINDS,
  type UpsertCarrierInput,
  type CarrierBankingInput,
  type CreateVehicleInput,
  type UpdateVehicleInput,
  type UploadDocumentInput,
  type CreateDriverInput,
  type CarrierAvailabilityInput,
} from "@/server/dto/carrier.dto";
import type { Carrier } from "@/db/schema/carriers";
import type { Viewer } from "@/server/services/shipment.service";

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

/**
 * The carrier an availability action is about: the caller's own when no id is
 * given, anyone's for an admin. A driver naming somebody else's id gets the
 * same 404 as a typo — nothing here confirms another account exists.
 */
async function carrierFor(actor: Viewer, carrierId: string | null) {
  const carrier = carrierId
    ? await carriersDal.getById(carrierId)
    : await carriersDal.getByUserId(actor.userId);
  if (!carrier) throw err("CARRIER_NOT_FOUND", 404);
  if (carrier.userId !== actor.userId && !actor.isAdmin) {
    throw err("CARRIER_NOT_FOUND", 404);
  }
  return carrier;
}

/** The account an in-house onboarding may convert, or null to create one. */
async function findConvertibleAccount(email: string) {
  const existing = await usersDal.getUserByEmail(email);
  if (!existing) return null;

  if (existing.roles.some((r) => r.role === "driver")) {
    throw err("ALREADY_DRIVER", 409, "This account is already a driver.");
  }
  if (await carriersDal.getByUserId(existing.id)) {
    throw err(
      "CARRIER_PROFILE_EXISTS",
      409,
      "This account already has a driver application on file. Review it under Applications instead."
    );
  }

  return existing;
}

/**
 * Better Auth's own signup rather than a raw insert, so the usual hooks fire
 * (origin stamp, default role). The password is random and never shown: the
 * driver sets their own from the email `sendSetPasswordEmail` sends.
 */
async function createDriverAccount(name: string, email: string) {
  const { auth } = await import("@/lib/auth");

  try {
    const { user } = await auth.api.signUpEmail({
      body: {
        name,
        email,
        password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
      },
    });
    return user.id;
  } catch (error) {
    throw err(
      "ACCOUNT_CREATION_FAILED",
      502,
      error instanceof Error ? error.message : "Failed to create the account"
    );
  }
}

/** Carrier row, vehicle and role grants: all four land, or none do. */
async function writeInHouseDriver(
  userId: string,
  actorId: string,
  fields: UpsertCarrierInput,
  vehicle: CreateDriverInput["vehicle"]
) {
  return await db.transaction(async (tx) => {
    const carrier = await carriersDal.create(
      {
        id: nanoid(),
        userId,
        ...fields,
        status: "approved",
        approvedAt: new Date(),
        approvedBy: actorId,
      },
      tx
    );
    await carriersDal.createVehicle(
      {
        id: nanoid(),
        carrierId: carrier.id,
        ...vehicle,
        plateNumber: vehicle.plateNumber.toUpperCase(),
      },
      tx
    );
    await enrolAsOwnDriver(carrier, actorId, tx);
    // A no-op while every signup still defaults to `shipper`; once that
    // default goes (spec §2), this grant is what marks the driver in-house.
    await usersDal.assignRoleIfMissing(userId, "shipper", actorId, tx);

    return carrier.id;
  });
}

/** Never fails the onboarding: Admin → Users can resend a reset link. */
async function sendSetPasswordEmail(email: string) {
  const { auth } = await import("@/lib/auth");

  await auth.api
    .requestPasswordReset({ body: { email, redirectTo: "/reset-password" } })
    .catch((e) => console.error("set-password email failed", e));
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
   * Persists only the last 4 characters of the IBAN and the BIC. The full IBAN
   * never reaches our database — and, despite what this comment used to say,
   * it is not forwarded to Stripe either: nothing is sent anywhere
   * (payout_safety_spec.md §6).
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

  /**
   * The profile fields (`UpsertCarrierInput`) are the only requirement —
   * documents, banking and a vehicle can be completed later, including after
   * approval (carrier_kyc_spec.md §3). An admin decides whether a thin file is
   * good enough to approve; this endpoint does not gate on it.
   */
  async submitApplication(userId: string) {
    const carrier = await this.requireOwnCarrier(userId);

    if (carrier.status === "submitted" || carrier.status === "under_review") {
      throw err("ALREADY_SUBMITTED", 409);
    }
    if (carrier.status === "suspended") throw err("CARRIER_SUSPENDED", 409);

    // A deregistered driver who applies again is reviewed again (§REQ-02).
    const submitted = await carriersDal.update(
      carrier.id,
      carrier.status === "deregistered"
        ? { status: "submitted", deregisteredAt: null, deregistrationReason: null }
        : { status: "submitted" }
    );

    // Best-effort: a failed alert must not fail the submission (§REQ-07).
    await alertAdminsOfApplication(carrier).catch((e) =>
      console.error("driver application alert failed", e)
    );

    return submitted;
  },

  async withdrawApplication(userId: string) {
    const carrier = await this.requireOwnCarrier(userId);
    if (carrier.status !== "submitted") throw err("NOT_SUBMITTED", 409);
    return await carriersDal.update(carrier.id, { status: "draft" });
  },

  async getOwnApplication(userId: string) {
    return await carriersDal.getByUserId(userId);
  },

  // ---- Admin: in-house drivers (in_house_drivers_spec.md §6) ----

  /**
   * An admin or operator onboarding a driver who works for Expeditoo itself.
   * An email with no account gets one created here; an existing account is
   * converted, unless it already drives (`ALREADY_DRIVER`) or already has an
   * application on file (`CARRIER_PROFILE_EXISTS` -- review it instead).
   *
   * The account is the only write outside the transaction, because Better
   * Auth owns it: if the rest fails, an account created by this call is
   * deleted again so a retry does not collide on the email. A pre-existing
   * account is never deleted.
   */
  async createInHouseDriver(viewer: Viewer, data: CreateDriverInput) {
    if (!viewer.isAdmin && !viewer.isOperator) {
      throw err("FORBIDDEN_ROLE", 403, "Admin or operator access required");
    }

    const { name, email, vehicle, ...carrierFields } = data;
    const existing = await findConvertibleAccount(email);

    if (await carriersDal.getBySiret(carrierFields.siret)) {
      throw err(
        "SIRET_ALREADY_REGISTERED",
        409,
        "That SIRET already belongs to another carrier account."
      );
    }

    const userId = existing?.id ?? (await createDriverAccount(name, email));

    let carrierId: string;
    try {
      // The admin entering the address in person is the identity check.
      if (!existing) await usersDal.verifyUserEmail(userId);
      carrierId = await writeInHouseDriver(
        userId,
        viewer.userId,
        carrierFields,
        vehicle
      );
    } catch (error) {
      if (!existing) await usersDal.deleteUser(userId).catch(() => {});
      throw error;
    }

    if (!existing) await sendSetPasswordEmail(email);

    return {
      carrierId,
      userId,
      name: existing?.name ?? name,
      email,
      accountCreated: !existing,
    };
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

  /** No status means the whole queue, every state included. */
  async listForReview(status?: Carrier["status"]) {
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

  // ---- Availability: Actif / Absent / Désinscrit (§REQ-02) ----

  /**
   * « Absent »: the driver, or an admin for them. Only an active account can
   * be away — a suspended or deregistered one has nothing to step back from.
   * An absent driver keeps their live runs, their money and their documents;
   * every new-work path asks `mayTakeWork` and refuses them until the return
   * date passes or someone ends the absence.
   */
  async setAvailability(
    actor: Viewer,
    carrierId: string | null,
    input: CarrierAvailabilityInput
  ) {
    const carrier = await carrierFor(actor, carrierId);
    if (!input.absent) {
      return await carriersDal.update(carrier.id, {
        absentSince: null,
        absentUntil: null,
        absenceReason: null,
      });
    }

    if (carrier.status !== "approved") throw err("CARRIER_NOT_ACTIVE", 409);
    const until = input.until ? new Date(input.until) : null;
    if (until && until.getTime() <= Date.now()) {
      throw err("ABSENCE_END_IN_PAST", 422);
    }
    const updated = await carriersDal.update(carrier.id, {
      absentSince: new Date(),
      absentUntil: until,
      absenceReason: input.reason,
    });
    if (actor.userId !== carrier.userId) {
      await notifyCarrier(
        carrier.userId,
        "Marked as away",
        "An administrator marked your account as away: you will not be offered new jobs until it ends."
      );
    }
    return updated;
  },

  /**
   * « Désinscrit »: the driver leaves, or an admin removes them. Refused while
   * a run is still owed to somebody, so a delivery is never stranded; every
   * bid still standing is withdrawn in the same transaction so no requester
   * goes on comparing an offer nobody will honour. Money already earned stays
   * payable — a payout follows its delivered shipment, not the account's
   * status. Applying again starts the review over (`submitApplication`).
   */
  async deregister(actor: Viewer, carrierId: string | null, reason: string | null) {
    const carrier = await carrierFor(actor, carrierId);
    if (carrier.status === "deregistered") return carrier;

    const live = await shipmentsDal.countLiveForCarrier(carrier.userId);
    if (live > 0) throw err("CARRIER_HAS_LIVE_RUNS", 409);

    const updated = await db.transaction(async (tx) => {
      await offersDal.withdrawAllPendingForCarrier(carrier.userId, tx);
      return await carriersDal.update(
        carrier.id,
        {
          status: "deregistered",
          deregisteredAt: new Date(),
          deregistrationReason: reason,
          absentSince: null,
          absentUntil: null,
          absenceReason: null,
        },
        tx
      );
    });

    if (actor.userId !== carrier.userId) {
      await notifyCarrier(
        carrier.userId,
        "Account deregistered",
        reason ?? "An administrator closed your driver account."
      );
    }
    return updated;
  },

  /** Suspended → active again. Admin only; nothing called it until §REQ-02. */
  async reinstate(actor: Viewer, carrierId: string) {
    if (!actor.isAdmin) throw err("FORBIDDEN", 403);
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
    if (!mayTakeWork(carrier)) throw err("CARRIER_ABSENT", 403);
    return carrier;
  },
};

/**
 * Every admin hears that a driver application waits for them, in the app and
 * by email (client_feedback_2026_10_29_spec.md §REQ-07). Every application,
 * not only « professional » ones: every applicant today is a SIRET holder,
 * and the professional / private split waits on REQ-01.
 *
 * The email reaches nobody but the Resend account's own address until a
 * sending domain is verified (C4); the in-app notification reaches everyone.
 */
async function alertAdminsOfApplication(carrier: Carrier) {
  const admins = (await usersDal.getUsersByRole("admin")).filter(Boolean);
  const applicant = await usersDal.getUserById(carrier.userId);
  const applicantName = applicant?.name || carrier.companyName;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://expeditoo.com";
  const reviewUrl = `${base}/admin/applications`;

  await Promise.allSettled(
    admins.flatMap((admin) => [
      notificationsService.createNotification({
        userId: admin.id,
        type: "carrier_application",
        title: "New driver application",
        message: `${applicantName} · ${carrier.companyName} · ${carrier.city}`,
        linkUrl: "/admin/applications",
      }),
      emailService.sendDriverApplicationSubmittedEmail(admin.email, {
        applicantName,
        companyName: carrier.companyName,
        city: carrier.city,
        reviewUrl,
      }),
    ])
  );
}

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
