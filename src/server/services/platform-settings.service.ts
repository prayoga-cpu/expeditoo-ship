import { z } from "zod";
import { platformSettingsDal } from "@/server/dal/platform-settings.dal";
import { userHasRole } from "@/server/dal/users.dal";

// ========================================
// Errors
// ========================================

export class PlatformSettingsError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "PlatformSettingsError";
  }
}

const err = (code: string, status: number, message?: string) =>
  new PlatformSettingsError(code, status, message);

export const updatePlatformSettingsSchema = z.object({
  feeBasisPoints: z.number().int().min(0).max(10_000),
});

export type UpdatePlatformSettingsInput = z.infer<
  typeof updatePlatformSettingsSchema
>;

/** Platform economics, not a queue an operator should be able to change. */
async function requireFeeAdmin(actorUserId: string) {
  const [isAdmin, isFinance] = await Promise.all([
    userHasRole(actorUserId, "admin"),
    userHasRole(actorUserId, "finance"),
  ]);
  if (!isAdmin && !isFinance) throw err("FORBIDDEN_NOT_ADMIN", 403);
}

/** Same rounding convention as `commissionFor` in payments.service.ts. */
export const platformFeeFor = (amountCents: number, feeBasisPoints: number) =>
  Math.round((amountCents * feeBasisPoints) / 10_000);

export const platformSettingsService = {
  /**
   * Unauthenticated, unpermissioned read. This is called from
   * `chargeForShipment` on the award-time critical path — it must never gate
   * a real charge on an admin-role check.
   */
  async getFeeBasisPoints(): Promise<number> {
    const row = await platformSettingsDal.get();
    return row?.feeBasisPoints ?? 0;
  },

  async getForAdmin(actorUserId: string) {
    await requireFeeAdmin(actorUserId);
    const row = await platformSettingsDal.get();
    return {
      feeBasisPoints: row?.feeBasisPoints ?? 0,
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
    };
  },

  async update(actorUserId: string, input: UpdatePlatformSettingsInput) {
    await requireFeeAdmin(actorUserId);
    const parsed = updatePlatformSettingsSchema.parse(input);
    const row = await platformSettingsDal.upsert({
      feeBasisPoints: parsed.feeBasisPoints,
      updatedBy: actorUserId,
    });
    return {
      feeBasisPoints: row.feeBasisPoints,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    };
  },
};
