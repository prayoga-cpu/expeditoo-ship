import { z } from "zod";
import { CANCELLATION_CATEGORIES } from "@/lib/cancellation-policy";

/**
 * The boundary schemas for both cancellation verbs.
 *
 * They live here rather than inline in the route, which is where the old cancel
 * endpoint kept its own `z.object({ reason })` while an orphaned
 * `cancelShipmentSchema` in `shipment.dto.ts` disagreed with it about the
 * minimum length and was imported by nobody. One schema, one floor.
 *
 * The category is **derived** from the policy module's tuple, never restated
 * (CLAUDE.md gotcha 8). The per-side fence is not expressed here on purpose:
 * which categories a caller may use depends on what they are to this shipment,
 * which only the service knows — it answers `CATEGORY_NOT_FOR_SIDE`.
 *
 * See docs/specs/cancellations_spec.md §8.
 */
export const cancellationCategorySchema = z.enum(CANCELLATION_CATEGORIES);

/**
 * `min(3)`, not the 5 the dead DTO asked for: the mounted dialog disables
 * submit below three characters, and a server floor above the button's is a
 * refusal the user cannot see coming.
 */
const reasonSchema = z.string().trim().min(3).max(500).optional();

export const cancelJobSchema = z.object({
  category: cancellationCategorySchema,
  reason: reasonSchema,
});

export const withdrawFromJobSchema = z.object({
  category: cancellationCategorySchema,
  reason: reasonSchema,
});

export type CancelJobInput = z.infer<typeof cancelJobSchema>;
export type WithdrawFromJobInput = z.infer<typeof withdrawFromJobSchema>;
