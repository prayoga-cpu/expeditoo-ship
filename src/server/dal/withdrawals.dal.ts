import { and, desc, eq, inArray, isNull, ne, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { payments, payouts } from "@/db/schema/payments";
import { shipments } from "@/db/schema/shipments";
import { user } from "@/db/schema/users";
import {
  withdrawals,
  type InsertWithdrawal,
  type Withdrawal,
} from "@/db/schema/withdrawals";

export type Executor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * What a driver may ask for: earned, not yet asked for, and still backed by a
 * delivery and by money the platform holds (payout_safety_spec.md §2.1).
 *
 * `scheduled` alone used to be the whole test. It is what `schedulePayout`
 * writes — but the capture webhook wrote it at award, before anyone had driven
 * anywhere, and a refund through `POST /api/admin/refunds` left it standing for
 * a job whose client had their money back. The row's own status can answer
 * neither question, so the shipment and the payment are asked directly. The
 * joins are inner on purpose: a payout whose payment row is gone cannot be
 * shown to be paid for.
 */
function availableTo(carrierUserId: string): SQL {
  return and(
    eq(payouts.carrierId, carrierUserId),
    eq(payouts.status, "scheduled"),
    isNull(payouts.withdrawalId),
    eq(shipments.status, "DELIVERED"),
    eq(payments.status, "captured")
  )!;
}

export const withdrawalsDal = {
  /** The available balance, and how many deliveries it is made of. */
  async availableFor(carrierUserId: string, tx: Executor = db) {
    const [row] = await tx
      .select({
        amountCents: sql<number>`coalesce(sum(${payouts.amountCents}), 0)::int`,
        deliveries: sql<number>`count(*)::int`,
      })
      .from(payouts)
      .innerJoin(shipments, eq(shipments.id, payouts.shipmentId))
      .innerJoin(payments, eq(payments.id, payouts.paymentId))
      .where(availableTo(carrierUserId));

    return row ?? { amountCents: 0, deliveries: 0 };
  },

  /**
   * Has this driver ever been paid for anything, in any status.
   *
   * `availableFor` cannot answer this: it counts only unclaimed `scheduled`
   * rows, so a driver waiting on a withdrawal — or one whose single payout
   * failed — reports zero and would be shown the "you have never earned"
   * onboarding pitch. This asks the honest question instead.
   */
  async hasAnyPayout(carrierUserId: string, tx: Executor = db) {
    const [row] = await tx
      .select({ id: payouts.id })
      .from(payouts)
      .where(eq(payouts.carrierId, carrierUserId))
      .limit(1);

    return Boolean(row);
  },

  /** The available payout rows themselves, for stamping into a request. */
  async availableRows(carrierUserId: string, tx: Executor = db) {
    return await tx
      .select({ id: payouts.id, amountCents: payouts.amountCents })
      .from(payouts)
      .innerJoin(shipments, eq(shipments.id, payouts.shipmentId))
      .innerJoin(payments, eq(payments.id, payouts.paymentId))
      .where(availableTo(carrierUserId));
  },

  /**
   * The payouts a request holds, with the facts that decide whether each may
   * still be paid (`payoutStanding`, payout_safety_spec.md §2.2).
   *
   * The payment is a LEFT join where the balance's is inner: here a missing
   * payment is an answer — not paid for — and dropping the row would make the
   * request look smaller than the amount frozen on it.
   */
  async claimedPayouts(withdrawalId: string, tx: Executor = db) {
    return await tx
      .select({
        id: payouts.id,
        amountCents: payouts.amountCents,
        status: payouts.status,
        shipmentStatus: shipments.status,
        paymentStatus: payments.status,
      })
      .from(payouts)
      .innerJoin(shipments, eq(shipments.id, payouts.shipmentId))
      .leftJoin(payments, eq(payments.id, payouts.paymentId))
      .where(eq(payouts.withdrawalId, withdrawalId));
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

  /**
   * Writes an operator's decision onto a request that is still open, and
   * returns nothing when it is not. Two operators answering the same request at
   * once would otherwise both win, and the second could turn a paid request
   * into a refused one.
   */
  async updateOpen(
    id: string,
    data: Partial<InsertWithdrawal>,
    tx: Executor = db,
    /** Only from this status — the one the deciding operator saw. */
    from?: "requested" | "approved"
  ) {
    const [row] = await tx
      .update(withdrawals)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(withdrawals.id, id),
          from
            ? eq(withdrawals.status, from)
            : inArray(withdrawals.status, ["requested", "approved"])
        )
      )
      .returning();
    return row;
  },

  // Every payout write below names the status it moves *from*, so a refund or
  // a second operator acting at the same moment is never overwritten — the
  // caller compares what moved with what it meant to move
  // (payout_safety_spec.md §4).

  /** Claims payouts for a new request: only rows still free to claim. */
  async claimPayouts(
    payoutIds: string[],
    withdrawalId: string,
    tx: Executor = db
  ) {
    if (payoutIds.length === 0) return [];
    return await tx
      .update(payouts)
      .set({ withdrawalId, status: "processing", updatedAt: new Date() })
      .where(
        and(
          inArray(payouts.id, payoutIds),
          eq(payouts.status, "scheduled"),
          isNull(payouts.withdrawalId)
        )
      )
      .returning({ id: payouts.id });
  },

  /** Records a request's payouts as transferred. */
  async settlePayouts(payoutIds: string[], tx: Executor = db) {
    if (payoutIds.length === 0) return [];
    const now = new Date();
    return await tx
      .update(payouts)
      .set({ status: "paid", paidAt: now, updatedAt: now })
      .where(
        and(inArray(payouts.id, payoutIds), eq(payouts.status, "processing"))
      )
      .returning({ id: payouts.id });
  },

  /** Hands a refused request's payouts back to the balance. */
  async releasePayouts(payoutIds: string[], tx: Executor = db) {
    if (payoutIds.length === 0) return;
    await tx
      .update(payouts)
      .set({
        status: "scheduled",
        withdrawalId: null,
        paidAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(inArray(payouts.id, payoutIds), eq(payouts.status, "processing"))
      );
  },

  /**
   * Voids whatever a refused request still holds once its payable rows have
   * been released — and never a `paid` one, whose money has left.
   */
  async voidClaimedPayouts(withdrawalId: string, tx: Executor = db) {
    await tx
      .update(payouts)
      .set({ status: "cancelled", withdrawalId: null, updatedAt: new Date() })
      .where(
        and(
          eq(payouts.withdrawalId, withdrawalId),
          ne(payouts.status, "paid")
        )
      );
  },
};
