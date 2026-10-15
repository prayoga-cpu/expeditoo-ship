import { db } from "@/db";
import { userContactDal } from "@/server/dal/user-contact.dal";
import type { Viewer } from "@/server/services/shipment.service";
import { composeName } from "@/lib/person-name";
import {
  updateUserContactSchema,
  type UpdateUserContactInput,
  type UserContactView,
} from "@/server/dto/user-contact.dto";

// ========================================
// Personal contact details — client_feedback_2026_10_spec.md §7b
// ========================================

export class UserContactError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "UserContactError";
  }
}

const err = (code: string, status: number) => new UserContactError(code, status);

/** `""` clears a text field; an absent key leaves it alone. */
const cleared = (value: string | undefined) =>
  value === undefined ? undefined : value === "" ? null : value;

function toView(row: NonNullable<Awaited<ReturnType<typeof userContactDal.get>>>): UserContactView {
  return {
    name: row.name,
    firstName: row.firstName,
    lastName: row.lastName,
    alias: row.alias,
    phone: row.phone,
    relativeName: row.relativeName,
    relativePhone: row.relativePhone,
  };
}

async function read(userId: string): Promise<UserContactView> {
  const row = await userContactDal.get(userId);
  if (!row) throw err("USER_NOT_FOUND", 404);
  return toView(row);
}

/** The name columns this input writes, `name` re-composed when both parts are known. */
function nameColumns(input: UpdateUserContactInput, current: UserContactView) {
  const firstName = input.firstName ?? current.firstName;
  const lastName = input.lastName ?? current.lastName;
  const touched = input.firstName !== undefined || input.lastName !== undefined;
  return {
    ...(input.firstName !== undefined && { firstName: input.firstName }),
    ...(input.lastName !== undefined && { lastName: input.lastName }),
    ...(input.alias !== undefined && { alias: cleared(input.alias) }),
    ...(touched && firstName && lastName && { name: composeName(firstName, lastName) }),
  };
}

function detailColumns(input: UpdateUserContactInput) {
  return {
    ...(input.phone !== undefined && { phone: cleared(input.phone) }),
    ...(input.relativeName !== undefined && { relativeName: cleared(input.relativeName) }),
    ...(input.relativePhone !== undefined && { relativePhone: cleared(input.relativePhone) }),
  };
}

export const userContactService = {
  /** The caller's own details. */
  async getOwn(userId: string) {
    return read(userId);
  },

  /**
   * The caller's own details, saved. Names and phones live in two tables and
   * are written together or not at all.
   */
  async updateOwn(userId: string, input: unknown): Promise<UserContactView> {
    const data = updateUserContactSchema.parse(input);
    const current = await read(userId);
    const names = nameColumns(data, current);
    const details = detailColumns(data);

    await db.transaction(async (tx) => {
      if (Object.keys(names).length > 0) await userContactDal.updateNames(userId, names, tx);
      if (Object.keys(details).length > 0) await userContactDal.upsertDetails(userId, details, tx);
    });

    return read(userId);
  },

  /**
   * Staff reading someone's details — admin or operator, the same "staff" the
   * rest of the platform means. Nobody else reads another account's phones:
   * no listing, offer, shipment or message projection carries them.
   */
  async getForStaff(viewer: Viewer, userId: string) {
    if (!viewer.isAdmin && !viewer.isOperator) throw err("FORBIDDEN", 403);
    return read(userId);
  },
};
