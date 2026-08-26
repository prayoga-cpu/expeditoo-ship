import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { payouts } from "@/db/schema/payments";
import { user } from "@/db/schema/users";
import {
  withdrawals,
  type InsertWithdrawal,
  type Withdrawal,
} from "@/db/schema/withdrawals";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export const withdrawalsDal = {
  /**
   * What a driver could ask for right now: every payout not already claimed by
   * a withdrawal. `scheduled` is the status `schedulePayout` writes; anything
   * failed or cancelled is deliberately not counted as available money.
   */
  async availableFor(carrierUserId: string, tx: Executor = db) {
    const [row] = await tx
      .select({
        amountCents: sql<number>`coalesce(sum(${payouts.amountCents}), 0)::int`,
        deliveries: sql<number>`count(*)::int`,
      })
      .from(payouts)
      .where(
        and(
          eq(payouts.carrierId, carrierUserId),
          eq(payouts.status, "scheduled"),
          isNull(payouts.withdrawalId)
        )
      );

    return row ?? { amountCents: 0, deliveries: 0 };
  },

  /** The unclaimed payout rows themselves, for stamping into a request. */
  async availableRows(carrierUserId: string, tx: Executor = db) {
    return await tx
      .select({ id: payouts.id, amountCents: payouts.amountCents })
      .from(payouts)
      .where(
        and(
          eq(payouts.carrierId, carrierUserId),
          eq(payouts.status, "scheduled"),
          isNull(payouts.withdrawalId)
        )
      );
  },

  async create(data: InsertWithdrawal, tx: Executor = db) {
    const [row] = await tx.insert(withdrawals).values(data).returning();
    return row;
  },

  async getById(id: string, tx: Executor = db) {
    return await tx.query.withdrawals.findFirst({
      where: eq(withdrawals.id, id),
    });
  },

  /** An open request blocks a second one — see `withdrawalsService.request`. */
  async findOpenFor(carrierUserId: string, tx: Executor = db) {
    return await tx.query.withdrawals.findFirst({
      where: and(
        eq(withdrawals.carrierId, carrierUserId),
        sql`${withdrawals.status} in ('requested', 'approved')`
      ),
    });
  },

  async listForCarrier(carrierUserId: string, tx: Executor = db) {
    return await tx.query.withdrawals.findMany({
      where: eq(withdrawals.carrierId, carrierUserId),
      orderBy: [desc(withdrawals.createdAt)],
    });
  },

  /** The operator queue. Oldest request first — it has waited longest. */
  async listForReview(status: Withdrawal["status"] | undefined, tx: Executor = db) {
    return await tx
      .select({
        id: withdrawals.id,
        carrierId: withdrawals.carrierId,
        carrierName: user.name,
        carrierEmail: user.email,
        amountCents: withdrawals.amountCents,
        currency: withdrawals.currency,
        status: withdrawals.status,
        reference: withdrawals.reference,
        decisionNote: withdrawals.decisionNote,
        createdAt: withdrawals.createdAt,
        decidedAt: withdrawals.decidedAt,
        paidAt: withdrawals.paidAt,
      })
      .from(withdrawals)
      .innerJoin(user, eq(user.id, withdrawals.carrierId))
      .where(status ? eq(withdrawals.status, status) : undefined)
      .orderBy(withdrawals.createdAt);
  },

  async update(
    id: string,
    data: Partial<InsertWithdrawal>,
    tx: Executor = db
  ) {
    const [row] = await tx
      .update(withdrawals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(withdrawals.id, id))
      .returning();
    return row;
  },

  /** Claims payouts for a request, or releases them when it is refused. */
  async setPayoutWithdrawal(
    payoutIds: string[],
    withdrawalId: string | null,
    status: "scheduled" | "processing" | "paid",
    tx: Executor = db
  ) {
    if (payoutIds.length === 0) return;
    await tx
      .update(payouts)
      .set({
        withdrawalId,
        status,
        paidAt: status === "paid" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(sql`${payouts.id} = any(${payoutIds})`);
  },

  async payoutIdsFor(withdrawalId: string, tx: Executor = db) {
    const rows = await tx
      .select({ id: payouts.id })
      .from(payouts)
      .where(eq(payouts.withdrawalId, withdrawalId));
    return rows.map((r) => r.id);
  },
};
