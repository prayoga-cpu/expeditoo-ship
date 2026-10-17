import type { ExpedionCaller } from "@/lib/expedion-auth";
import type { Address } from "@/db/schema/addresses";
import { addressesDal } from "@/server/dal/addresses.dal";
import { userContactService } from "@/server/services/user-contact.service";
import { addressesService } from "@/server/services/addresses.service";
import {
  updateExpedionProfileSchema,
  type UpdateExpedionProfileInput,
  type ExpedionProfileAddress,
  type ExpedionProfileView,
} from "@/server/dto/expedion-profile.dto";

// ========================================
// The Expedion client's own profile — launch_readiness_spec.md §C
// ========================================

export class ExpedionProfileError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "ExpedionProfileError";
  }
}

/**
 * Only a Better Auth session is a person with a `user` row. A Firebase token
 * or a shared key names a quote owner, who may have no account here at all,
 * and an app key must never be able to write somebody's profile.
 */
function requireAccount(caller: ExpedionCaller) {
  if (caller.via !== "session") {
    throw new ExpedionProfileError(
      "PROFILE_NEEDS_ACCOUNT",
      403,
      "Sign in with an Expeditoo account to read or edit a profile"
    );
  }
}

function toAddress(row: Address | undefined): ExpedionProfileAddress | null {
  if (!row) return null;
  return {
    line1: row.street,
    // An empty second line is stored as "", and read back as none.
    line2: row.details?.trim() ? row.details : null,
    zip: row.zip,
    city: row.city,
    country: row.country,
  };
}

async function read(caller: ExpedionCaller): Promise<ExpedionProfileView> {
  const [contact, address] = await Promise.all([
    userContactService.getOwn(caller.userId),
    addressesDal.getDefaultByUserId(caller.userId),
  ]);
  return {
    email: caller.email ?? null,
    firstName: contact.firstName,
    lastName: contact.lastName,
    phone: contact.phone,
    address: toAddress(address),
  };
}

/** The default address is the profile's; it is updated in place or created. */
async function saveAddress(
  userId: string,
  value: NonNullable<UpdateExpedionProfileInput["address"]>
) {
  const fields = {
    street: value.line1,
    details: value.line2 ?? "",
    zip: value.zip,
    city: value.city,
    country: value.country,
  };
  const current = await addressesDal.getDefaultByUserId(userId);
  if (current) {
    await addressesService.update(current.id, userId, fields);
    return;
  }
  // `home` is a preset id, translated wherever an address is shown.
  await addressesService.create(userId, { ...fields, label: "home", isDefault: true });
}

export const expedionProfileService = {
  async get(caller: ExpedionCaller) {
    requireAccount(caller);
    return read(caller);
  },

  /**
   * Validated whole before anything is written, so a bad address cannot leave
   * the names saved and the rest refused.
   */
  async update(caller: ExpedionCaller, input: unknown) {
    requireAccount(caller);
    const data = updateExpedionProfileSchema.parse(input);

    const contact = {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.phone !== undefined && { phone: data.phone }),
    };
    if (Object.keys(contact).length > 0) {
      await userContactService.updateOwn(caller.userId, contact);
    }
    if (data.address) await saveAddress(caller.userId, data.address);

    return read(caller);
  },
};
