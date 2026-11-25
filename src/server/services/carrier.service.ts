import { appUrl } from "@/lib/app-url";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { carriersDal } from "@/server/dal/carriers.dal";
import * as usersDal from "@/server/dal/users.dal";
import { offersDal } from "@/server/dal/offers.dal";
import { shipmentsDal } from "@/server/dal/shipments.dal";
import { DOCUMENT_LABELS, missingRequiredDocuments } from "@/lib/carrier-missing-documents";
import { notificationsService } from "@/server/services/notifications.service";
import { emailService } from "@/server/services/email.service";
import { last4 } from "@/lib/french-identifiers";
import { mayTakeWork } from "@/lib/carrier-availability";
import { carrierKindLabel, type CarrierKind } from "@/lib/carrier-kind";
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
 * Grants the role a file's kind earns, and enrols its owner in their own fleet.
 *
 * An in-house driver (`private`) is a `driver`; an outside carrier
 * (`professional`) is a `carrier` — never both (driver_types_spec.md §2). The
 * fleet link is what lets the owner pass `assignDriver`'s fleet check and be
 * assigned a run. Every write here is idempotent, so approving twice enrols
 * once.
 */
// TODO(EXPEDITOO-TESTING): solo-carrier self-assignment — for real multi-driver
// fleets, replace this with a driver invite flow that grants the role and the
// fleet link to the invitee, and stop enrolling the owner automatically.
const ROLE_FOR_KIND = { private: "driver", professional: "carrier" } as const;
const KIND_FOR_ROLE = { driver: "private", carrier: "professional" } as const;

/** What an in-house driver's company reads as: the one they drive for. */
const IN_HOUSE_COMPANY = "Expeditop";

async function enrolAsOwnDriver(
  carrier: Carrier,
  adminId: string,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  role: "driver" | "carrier" = ROLE_FOR_KIND[carrier.kind]
) {
  await usersDal.assignRoleIfMissing(carrier.userId, role, adminId, tx);
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

/**
 * An in-house onboarding by email: the account that holds it, or null. Whether
 * that is allowed depends on the mode (`createInHouseDriver`).
 */
async function assertConvertible(
  existing: NonNullable<Awaited<ReturnType<typeof usersDal.getUserByEmail>>>
) {
  if (existing.roles.some((r) => r.role === "driver" || r.role === "carrier")) {
    throw err("ALREADY_DRIVER", 409, "This account is already a driver.");
  }
  if (await carriersDal.getByUserId(existing.id)) {
    throw err(
      "CARRIER_PROFILE_EXISTS",
      409,
      "This account already has a driver application on file. Review it under Applications instead."
    );
  }
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

/** The in-house file: a person, so no company, SIRET or legal form. */
function inHouseFields(data: Pick<CreateDriverInput, "contactPhone" | "addressLine" | "city" | "postalCode" | "bio">) {
  return {
    kind: "private" as const,
    companyName: IN_HOUSE_COMPANY,
    siret: null,
    contactPhone: data.contactPhone,
    addressLine: data.addressLine,
    city: data.city,
    postalCode: data.postalCode,
    bio: data.bio,
  };
}

/** Carrier row, vehicle and the `driver` grant: all three land, or none do. */
async function writeInHouseDriver(
  userId: string,
  actorId: string,
  fields: ReturnType<typeof inHouseFields>,
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

    return carrier.id;
  });
}

/**
 * The invitation: a set-password link, in a mail that says who is inviting
 * whom (`invite=driver` in the link is what makes the reset callback pick that
 * template — `lib/auth.ts`). Never fails the onboarding: Admin → Users can
 * resend a reset link.
 */
async function sendInvitationEmail(email: string) {
  const { auth } = await import("@/lib/auth");

  await auth.api
    .requestPasswordReset({
      body: { email, redirectTo: "/reset-password?invite=driver" },
    })
    .catch((e) => console.error("driver invitation email failed", e));
}

function assertStaff(viewer: Viewer) {
  if (!viewer.isAdmin && !viewer.isOperator) {
    throw err("FORBIDDEN_ROLE", 403, "Admin or operator access required");
  }
}

/**
 * An application as the columns hold it. An in-house file stores the company
 * it drives for and no SIRET, so nothing downstream reads a missing company.
 */
function carrierFields(data: UpsertCarrierInput) {
  const { kind, contactPhone, addressLine, city, postalCode, bio } = data;
  const contact = { kind, contactPhone, addressLine, city, postalCode, bio };

  if (data.kind === "private") {
    return {
      ...contact,
      companyName: IN_HOUSE_COMPANY,
      siret: null,
      vatNumber: null,
      legalForm: null,
    };
  }
  return {
    ...contact,
    companyName: data.companyName,
    siret: data.siret,
    vatNumber: data.vatNumber ?? null,
    legalForm: data.legalForm ?? null,
  };
}

// ========================================
// Service
// ========================================

export const carrierService = {
  /**
   * Create or update the draft. SIRET is unique across carriers; an in-house
   * file has none. The kind can change while the file is a draft, rejected or
   * deregistered, never once it is approved or suspended (`KIND_LOCKED`).
   */
  async upsertApplication(userId: string, data: UpsertCarrierInput) {
    const existing = await carriersDal.getByUserId(userId);
    const fields = carrierFields(data);

    const bySiret = fields.siret ? await carriersDal.getBySiret(fields.siret) : null;
    if (bySiret && bySiret.userId !== userId) {
      throw err("SIRET_ALREADY_REGISTERED", 409);
    }

    if (!existing) {
      return await carriersDal.create({ id: nanoid(), userId, ...fields });
    }

    if (existing.status === "submitted" || existing.status === "under_review") {
      throw err("APPLICATION_LOCKED", 409);
    }
    if (
      existing.kind !== fields.kind &&
      (existing.status === "approved" || existing.status === "suspended")
    ) {
      throw err("KIND_LOCKED", 409);
    }

    // Changing the legal or banking identity after approval requires a fresh
    // look, so the carrier drops back into review and bidding pauses.
    const identityChanged =
      existing.status === "approved" && existing.siret !== fields.siret;

    return await carriersDal.update(existing.id, {
      ...fields,
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
    // The applicant hears what their file still lacks (client feedback
    // 2026-11-06, B05); nothing is sent when it is complete.
    await tellApplicantWhatIsMissing(carrier).catch((e) =>
      console.error("missing documents notice failed", e)
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
   * An admin or operator onboarding a driver who works for Expeditop itself
   * (driver_types_spec.md §4). `existing`: the email already has an account and
   * is converted — nothing is mailed, and the account is never deleted on
   * failure. `invite`: no account yet, so one is created here and the person is
   * mailed an invitation with a set-password link once the transaction commits.
   *
   * The account is the only write outside the transaction, because Better
   * Auth owns it: if the rest fails, an account created by this call is
   * deleted again so a retry does not collide on the email.
   */
  async createInHouseDriver(viewer: Viewer, data: CreateDriverInput) {
    if (!viewer.isAdmin && !viewer.isOperator) {
      throw err("FORBIDDEN_ROLE", 403, "Admin or operator access required");
    }

    const existing = await usersDal.getUserByEmail(data.email);
    if (data.mode === "existing") {
      if (!existing) throw err("ACCOUNT_NOT_FOUND", 404, "No account has this email.");
      await assertConvertible(existing);
    } else if (existing) {
      throw err(
        "ACCOUNT_EXISTS",
        409,
        "This email already has an account — add it as a registered account."
      );
    }

    const userId = existing?.id ?? (await createDriverAccount(data.name ?? "", data.email));

    let carrierId: string;
    try {
      // The admin entering the address in person is the identity check.
      if (!existing) await usersDal.verifyUserEmail(userId);
      carrierId = await writeInHouseDriver(
        userId,
        viewer.userId,
        inHouseFields(data),
        data.vehicle
      );
    } catch (error) {
      if (!existing) await usersDal.deleteUser(userId).catch(() => {});
      throw error;
    }

    if (!existing) await sendInvitationEmail(data.email);

    return {
      carrierId,
      userId,
      name: existing?.name ?? data.name ?? "",
      email: data.email,
      accountCreated: !existing,
    };
  },

  /**
   * « Gérer le rôle » → In-house driver or Carrier. The role comes with the file
   * that earns it, so the person is usable at once and shows in the Drivers
   * list: no file → an approved one is created (contact details empty, to be
   * completed); an open file → its kind is set to match and it is approved; an
   * approved file → the role is simply added. A suspended file is refused —
   * reinstate it first.
   */
  async grantRole(adminId: string, userId: string, role: "driver" | "carrier") {
    const kind = KIND_FOR_ROLE[role];
    const account = await usersDal.getUserById(userId);
    if (!account) throw err("USER_NOT_FOUND", 404);
    const existing = await carriersDal.getByUserId(userId);
    if (existing?.status === "suspended") throw err("CARRIER_SUSPENDED", 409);

    const approvedNow = { status: "approved" as const, approvedAt: new Date(), approvedBy: adminId };

    await db.transaction(async (tx) => {
      let carrier: Carrier | undefined = existing;
      if (!carrier) {
        carrier = await carriersDal.create(
          {
            id: nanoid(),
            userId,
            kind,
            companyName: kind === "private" ? IN_HOUSE_COMPANY : account.name,
            siret: null,
            contactPhone: "",
            addressLine: "",
            city: "",
            postalCode: "",
            ...approvedNow,
          },
          tx
        );
      } else if (carrier.status !== "approved") {
        carrier = await carriersDal.update(
          carrier.id,
          {
            kind,
            ...approvedNow,
            rejectionReason: null,
            deregisteredAt: null,
            deregistrationReason: null,
          },
          tx
        );
        await carriersDal.setAllDocumentsAccepted(carrier.id, tx);
      }
      await enrolAsOwnDriver(carrier, adminId, tx, role);
    });

    if (!existing || existing.status !== "approved") {
      await congratulateOnApproval(userId, kind);
    }
  },

  // ---- Admin: completing a file on the applicant's behalf ----

  /**
   * An admin or operator fills in or corrects a driver's file for them — the
   * pending application (or the empty file « Gérer le rôle » creates) is finished
   * from the back office instead of waiting on the person. Not locked by
   * `submitted`: the point is to act on a file that is waiting. The kind may
   * change until the file is approved (`KIND_LOCKED`). Documents and banking
   * are not edited here: they are the person's own.
   */
  async adminUpdateApplication(
    viewer: Viewer,
    carrierId: string,
    data: UpsertCarrierInput
  ) {
    assertStaff(viewer);
    const carrier = await carriersDal.getById(carrierId);
    if (!carrier) throw err("CARRIER_NOT_FOUND", 404);

    const fields = carrierFields(data);
    const bySiret = fields.siret ? await carriersDal.getBySiret(fields.siret) : null;
    if (bySiret && bySiret.id !== carrierId) {
      throw err("SIRET_ALREADY_REGISTERED", 409);
    }
    if (
      carrier.kind !== fields.kind &&
      (carrier.status === "approved" || carrier.status === "suspended")
    ) {
      throw err("KIND_LOCKED", 409);
    }

    return await carriersDal.update(carrierId, fields);
  },

  /** A vehicle added to a driver's file by staff — assignment needs one. */
  async adminAddVehicle(viewer: Viewer, carrierId: string, data: CreateVehicleInput) {
    assertStaff(viewer);
    const carrier = await carriersDal.getById(carrierId);
    if (!carrier) throw err("CARRIER_NOT_FOUND", 404);

    return await carriersDal.createVehicle({
      id: nanoid(),
      carrierId,
      ...data,
      plateNumber: data.plateNumber.toUpperCase(),
    });
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

  /**
   * « Contact confirmé »: an operator records that they reached the applicant.
   * A timestamp and who — informational, it gates nothing: approval is still a
   * manual decision (client feedback 2026-11-06, C02).
   */
  async setContactConfirmed(actor: Viewer, carrierId: string, confirmed: boolean) {
    if (!actor.isAdmin && !actor.isOperator) {
      throw err("FORBIDDEN_ROLE", 403, "Admin or operator access required");
    }
    const carrier = await carriersDal.getById(carrierId);
    if (!carrier) throw err("CARRIER_NOT_FOUND", 404);

    return await carriersDal.update(carrierId, {
      contactConfirmedAt: confirmed ? new Date() : null,
      contactConfirmedBy: confirmed ? actor.userId : null,
    });
  },

  // ---- Admin review ----

  /** No status means the whole queue, every state included. */
  async listForReview(status?: Carrier["status"]) {
    const rows = await carriersDal.listByStatus(status);
    // One grouped query for every row's live runs, not one per driver: the
    // number an admin needs before removing someone (`CARRIER_HAS_LIVE_RUNS`).
    const liveRuns = await shipmentsDal.countLiveByCarriers(
      rows.map((row) => row.userId)
    );
    // `hasDriverAccess`: does the owner hold the role this file's kind earns?
    // An approved file without it is the one case « Repair access » is for.
    // The role rows stay here — the screen needs the answer, not the list.
    return rows.map(({ user, ...row }) => {
      const live = liveRuns.get(row.userId) ?? 0;
      if (!user) return { ...row, user, liveRuns: live, hasDriverAccess: false };
      const { roles, ...owner } = user;
      return {
        ...row,
        liveRuns: live,
        user: owner,
        hasDriverAccess: roles.some((r) => r.role === ROLE_FOR_KIND[row.kind]),
      };
    });
  },

  /**
   * Approving grants the role the file's kind earns — `carrier` (bids and runs
   * the work) for an outside carrier, `driver` (runs what Expeditop assigns) for
   * an in-house file — and enrols the owner in their own fleet so they can be
   * assigned a run. Idempotent: a second approval is a no-op rather than a
   * duplicate grant.
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

    await congratulateOnApproval(carrier.userId, carrier.kind);

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

    await notifyCarrier(carrier.userId, "Dossier chauffeur refusé", reason);

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

    await notifyCarrier(carrier.userId, "Compte chauffeur suspendu", reason);

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
        "Compte marqué absent",
        "Un administrateur a marqué votre compte comme absent : aucune nouvelle course ne vous sera proposée jusqu'à votre retour."
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
        "Compte chauffeur désinscrit",
        reason ?? "Un administrateur a fermé votre compte chauffeur."
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

    // Suspension never removed the roles, but an account approved before
    // self-enrolment existed (or one whose roles were edited by hand) holds
    // none — and « approved, but driver access is off » is a dead end an admin
    // could not repair from the screen. Both writes are idempotent.
    return await db.transaction(async (tx) => {
      const updated = await carriersDal.update(
        carrierId,
        { status: "approved", suspensionReason: null },
        tx
      );
      await enrolAsOwnDriver(carrier, actor.userId, tx);
      return updated;
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
 * by email (client_feedback_2026_10_29_spec.md §REQ-07), for both kinds.
 *
 * Both lead with the type — « Particulier (interne) » or « Professionnel » —
 * and open the file itself, not the list it sits in: an in-house applicant can
 * do nothing until somebody approves them, so the shortest path to that click
 * is the point (driver_types_spec.md §3).
 */
async function alertAdminsOfApplication(carrier: Carrier) {
  const admins = (await usersDal.getUsersByRole("admin")).filter(Boolean);
  const applicant = await usersDal.getUserById(carrier.userId);
  const applicantName = applicant?.name || carrier.companyName;
  const filePath = `/admin/drivers?tab=applications&file=${encodeURIComponent(carrier.id)}`;

  await Promise.allSettled(
    admins.flatMap((admin) => [
      notificationsService.createNotification({
        userId: admin.id,
        type: "carrier_application",
        title: `Nouveau dossier chauffeur — ${carrierKindLabel(carrier.kind)}`,
        message: `${applicantName} · ${carrier.companyName} · ${carrier.city}`,
        linkUrl: filePath,
      }),
      emailService.sendDriverApplicationSubmittedEmail(admin.email, {
        applicantName,
        companyName: carrier.companyName,
        city: carrier.city,
        kind: carrier.kind,
        reviewUrl: `${appUrl()}${filePath}`,
      }),
    ])
  );
}

/**
 * The required documents an applicant has not uploaded, by email and in the app
 * — the in-app notice is the one that cannot bounce. Silent when the file is
 * complete.
 */
async function tellApplicantWhatIsMissing(carrier: Carrier) {
  // An in-house file has no documents to ask for (driver_types_spec.md §3).
  if (carrier.kind === "private") return;
  const missing = missingRequiredDocuments(
    ((carrier as { documents?: { kind: string }[] }).documents ?? []).map((d) => d.kind)
  );
  if (missing.length === 0) return;

  const labels = missing.map((kind) => DOCUMENT_LABELS[kind]);
  const base = appUrl();

  await Promise.allSettled([
    notificationsService.createNotification({
      userId: carrier.userId,
      type: "carrier_documents_missing",
      title: "Il manque des documents à votre dossier",
      message: labels.map((l) => l.fr).join(", "),
      linkUrl: "/carrier/application",
    }),
    (async () => {
      const applicant = await usersDal.getUserById(carrier.userId);
      if (!applicant?.email) return;
      await emailService.sendMissingDocumentsEmail(applicant.email, {
        applicantName: applicant.name || carrier.companyName,
        missingFr: labels.map((l) => l.fr),
        missingEn: labels.map((l) => l.en),
        applicationUrl: `${base}/carrier/application`,
      });
    })(),
  ]);
}

/**
 * What an approved driver is told, by kind: an in-house driver waits for
 * Expeditop to assign runs and finds them under « Livraisons »; an outside
 * carrier reads the missions board and makes offers. `path` is where the
 * notification and the mail's button lead.
 */
const APPROVAL_NOTICE: Record<CarrierKind, { title: string; message: string; path: string }> = {
  private: {
    title: "Félicitations, vous êtes chauffeur Expeditop",
    message:
      "Votre dossier est validé. Expeditop vous attribuera vos courses : retrouvez-les dans « Livraisons ».",
    path: "/driver/shipments",
  },
  professional: {
    title: "Félicitations, votre dossier est approuvé",
    message: "Vous pouvez dès maintenant consulter les missions et faire vos offres.",
    path: "/expedion",
  },
};

/**
 * The good news, in the app and by email. The decision is already committed
 * when this runs, so neither channel may undo it: the notification swallows
 * its own failure and the mail has its own try — an approval never fails
 * because Resend did.
 */
async function congratulateOnApproval(userId: string, kind: CarrierKind) {
  // The column is NOT NULL with a default; a row read without it is still a
  // professional's, and nothing here may throw after the commit.
  const notice = APPROVAL_NOTICE[kind] ?? APPROVAL_NOTICE.professional;
  await notifyCarrier(userId, notice.title, notice.message, notice.path);

  try {
    const account = await usersDal.getUserById(userId);
    if (!account?.email) return;
    await emailService.sendDriverApprovedEmail(account.email, {
      name: account.name || undefined,
      kind: kind ?? "professional",
      actionUrl: `${appUrl()}${notice.path}`,
    });
  } catch (e) {
    console.error("driver approval email failed", e);
  }
}

async function notifyCarrier(
  userId: string,
  title: string,
  message: string,
  linkUrl = "/carrier/application"
) {
  await notificationsService
    .createNotification({ userId, type: "carrier_application", title, message, linkUrl })
    .catch((e) => console.error("carrier notification failed", e));
}
