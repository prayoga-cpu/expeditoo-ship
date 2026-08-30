import { nanoid } from "nanoid";
import { z } from "zod";

import { db } from "@/db";
import { carriersDal } from "@/server/dal/carriers.dal";
import { withdrawalsDal } from "@/server/dal/withdrawals.dal";
import { userHasRole } from "@/server/dal/users.dal";
import { notificationsService } from "@/server/services/notifications.service";

// ========================================
// Errors
// ========================================

export class WithdrawalError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "WithdrawalError";
  }
}

const err = (code: string, status: number, message?: string) =>
  new WithdrawalError(code, status, message);

/**
 * Below this a transfer costs more in handling than it moves. The driver keeps
 * the balance — nothing is lost, it simply waits for the next delivery.
 */
export const MIN_WITHDRAWAL_CENTS = 2_000;

export const decideWithdrawalSchema = z.object({
  action: z.enum(["approve", "reject", "mark_paid"]),
  reference: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
});

export type DecideWithdrawalInput = z.infer<typeof decideWithdrawalSchema>;

async function requireOperator(actorUserId: string) {
  const [isOperator, isAdmin, isFinance] = await Promise.all([
    userHasRole(actorUserId, "operator"),
    userHasRole(actorUserId, "admin"),
    userHasRole(actorUserId, "finance"),
  ]);
  if (!isOperator && !isAdmin && !isFinance) {
    throw err("FORBIDDEN_NOT_OPERATOR", 403);
  }
}

export const withdrawalsService = {
  /**
   * What this driver has earned and not yet asked for.
   *
   * `hasEverEarned` and `carrierStatus` are here for the screen's empty state
   * rather than for the money: a balance of €0 means one thing to a driver
   * between withdrawals and another to someone who has not been approved yet,
   * and the difference decides what the screen tells them to do next
   * (carrier_earnings_empty_state_spec.md §1). Neither gates anything — this
   * route answers for any session, including one with no carrier record.
   */
  async getBalance(carrierUserId: string) {
    const [available, open, history, hasEverEarned, carrier] =
      await Promise.all([
        withdrawalsDal.availableFor(carrierUserId),
        withdrawalsDal.findOpenFor(carrierUserId),
        withdrawalsDal.listForCarrier(carrierUserId),
        withdrawalsDal.hasAnyPayout(carrierUserId),
        carriersDal.getByUserId(carrierUserId),
      ]);

    return {
      availableCents: available.amountCents,
      deliveries: available.deliveries,
      minimumCents: MIN_WITHDRAWAL_CENTS,
      canRequest: !open && available.amountCents >= MIN_WITHDRAWAL_CENTS,
      openRequest: open ?? null,
      history,
      hasEverEarned,
      carrierStatus: carrier?.status ?? null,
    };
  },

  /**
   * Ask for everything currently available.
   *
   * The amount is not a parameter. A partial withdrawal would mean choosing
   * which deliveries it covers, which is a reconciliation question nobody has
   * asked for — and an operator approving "€240" wants to know exactly which
   * jobs that is. So a request claims every available payout and freezes the
   * total, and a delivery that lands afterwards belongs to the next one.
   *
   * One open request at a time, for the same reason: two overlapping requests
   * against one balance is how the same money gets approved twice.
   */
  async request(carrierUserId: string) {
    const open = await withdrawalsDal.findOpenFor(carrierUserId);
    if (open) throw err("WITHDRAWAL_ALREADY_OPEN", 409);

    return await db.transaction(async (tx) => {
      const rows = await withdrawalsDal.availableRows(carrierUserId, tx);
      const amountCents = rows.reduce((sum, r) => sum + r.amountCents, 0);

      if (amountCents <= 0) throw err("NOTHING_TO_WITHDRAW", 409);
      if (amountCents < MIN_WITHDRAWAL_CENTS) {
        throw err(
          "BELOW_MINIMUM",
          409,
          `A withdrawal starts at ${MIN_WITHDRAWAL_CENTS / 100} €`
        );
      }

      const withdrawal = await withdrawalsDal.create(
        { id: nanoid(), carrierId: carrierUserId, amountCents },
        tx
      );

      // Stamped inside the same transaction as the row that claims them, so a
      // failure here cannot leave payouts claimed by a request that does not
      // exist — or a request pointing at money another one already took.
      await withdrawalsDal.setPayoutWithdrawal(
        rows.map((r) => r.id),
        withdrawal.id,
        "processing",
        tx
      );

      return withdrawal;
    });
  },

  async listForCarrier(carrierUserId: string) {
    return await withdrawalsDal.listForCarrier(carrierUserId);
  },

  /** The operator queue. */
  async listForReview(actorUserId: string, status?: string) {
    await requireOperator(actorUserId);
    const allowed = ["requested", "approved", "paid", "rejected"] as const;
    const filter = allowed.find((s) => s === status);
    return await withdrawalsDal.listForReview(filter);
  },

  /**
   * An operator answers a request.
   *
   * `approve` says yes without moving money — the transfer is made by hand
   * outside this system, and pretending otherwise would put a lie in the
   * ledger. `mark_paid` is the record that it happened, and requires a
   * reference so the row can be reconciled against a bank statement later.
   * `reject` releases the payouts so the balance is available again.
   */
  async decide(
    actorUserId: string,
    withdrawalId: string,
    input: DecideWithdrawalInput
  ) {
    await requireOperator(actorUserId);

    const withdrawal = await withdrawalsDal.getById(withdrawalId);
    if (!withdrawal) throw err("WITHDRAWAL_NOT_FOUND", 404);
    if (withdrawal.status === "paid" || withdrawal.status === "rejected") {
      throw err("WITHDRAWAL_ALREADY_SETTLED", 409);
    }

    if (input.action === "approve") {
      if (withdrawal.status !== "requested") {
        throw err("WITHDRAWAL_NOT_REQUESTED", 409);
      }
      return await finish(withdrawal.id, carrierNotice("approved"), {
        status: "approved",
        decidedBy: actorUserId,
        decidedAt: new Date(),
        decisionNote: input.note ?? null,
      });
    }

    if (input.action === "mark_paid") {
      if (!input.reference) {
        throw err(
          "REFERENCE_REQUIRED",
          400,
          "Record the transfer reference so this can be reconciled later"
        );
      }
      const payoutIds = await withdrawalsDal.payoutIdsFor(withdrawal.id);
      await withdrawalsDal.setPayoutWithdrawal(
        payoutIds,
        withdrawal.id,
        "paid"
      );
      return await finish(withdrawal.id, carrierNotice("paid"), {
        status: "paid",
        reference: input.reference,
        decidedBy: actorUserId,
        decidedAt: withdrawal.decidedAt ?? new Date(),
        paidAt: new Date(),
      });
    }

    // Reject: the money goes back to available rather than disappearing.
    const payoutIds = await withdrawalsDal.payoutIdsFor(withdrawal.id);
    await withdrawalsDal.setPayoutWithdrawal(payoutIds, null, "scheduled");
    return await finish(withdrawal.id, carrierNotice("rejected"), {
      status: "rejected",
      decidedBy: actorUserId,
      decidedAt: new Date(),
      decisionNote: input.note ?? null,
    });
  },

};

/** Applies the decision and tells the driver. Notification never blocks it. */
async function finish(
  id: string,
  notice: { title: string; message: string },
  patch: Parameters<typeof withdrawalsDal.update>[1]
) {
  const updated = await withdrawalsDal.update(id, patch);

  await notificationsService
    .createNotification({
      userId: updated.carrierId,
      type: "payout_scheduled",
      title: notice.title,
      message: notice.message,
      linkUrl: "/carrier/withdrawals",
      data: { withdrawalId: id, status: updated.status },
    })
    .catch((e) => console.error("withdrawal notification failed", e));

  return updated;
}

function carrierNotice(status: "approved" | "paid" | "rejected") {
  return {
    approved: {
      title: "Withdrawal approved",
      message: "Your withdrawal was approved. The transfer is being made.",
    },
    paid: {
      title: "Withdrawal paid",
      message: "Your withdrawal has been transferred.",
    },
    rejected: {
      title: "Withdrawal refused",
      message:
        "Your withdrawal was not approved. Your balance is available again.",
    },
  }[status];
}
