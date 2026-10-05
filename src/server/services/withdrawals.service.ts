import { nanoid } from "nanoid";
import { z } from "zod";

import { db } from "@/db";
import type { PaymentStatus, PayoutStatus } from "@/db/schema/payments";
import type { ShipmentStatusType } from "@/db/schema/shipments";
import type { Withdrawal } from "@/db/schema/withdrawals";
import { carriersDal } from "@/server/dal/carriers.dal";
import { withdrawalsDal, type Executor } from "@/server/dal/withdrawals.dal";
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

const INVALID_PAYOUT = "WITHDRAWAL_HAS_INVALID_PAYOUT";

const invalidPayout = () =>
  err(
    INVALID_PAYOUT,
    409,
    "This withdrawal covers a job that was refunded, cancelled or not yet delivered"
  );

/**
 * Below this a transfer costs more in handling than it moves. The driver keeps
 * the balance — nothing is lost, it simply waits for the next delivery.
 */
export const MIN_WITHDRAWAL_CENTS = 2_000;

export const decideWithdrawalSchema = z.object({
  action: z.enum(["approve", "reject", "mark_paid"]),
  reference: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
  /**
   * The status the operator saw when they decided. A refusal sent from a
   * row still showing « Demandé » must not land on a request a colleague
   * has approved since — and perhaps already paid by hand: refusing *that* asks
   * for a confirmation first (payout_safety_spec.md §4).
   */
  seenStatus: z.enum(["requested", "approved"]).optional(),
});

export type DecideWithdrawalInput = z.infer<typeof decideWithdrawalSchema>;

// ========================================
// Whether a claimed payout may still be paid
// ========================================

export type PayoutStanding = "payable" | "undelivered" | "void";

export interface ClaimedPayoutFacts {
  status: PayoutStatus;
  shipmentStatus: ShipmentStatusType;
  paymentStatus: PaymentStatus | null;
}

/**
 * Where a payout a request holds stands (payout_safety_spec.md §2.2).
 *
 * `void` is final: a refund voided the row, the client's money is no longer
 * captured, or the run was cancelled. `undelivered` is not, and is kept apart
 * for that reason — it is a row the capture webhook wrote at award before
 * 2.60.0, for a job still on the road. Voiding it would strand the driver:
 * when the job is delivered `schedulePayout` returns the existing row rather
 * than writing another. Back in the balance, `availableTo` keeps it uncounted
 * until the delivery happens.
 */
export function payoutStanding(row: ClaimedPayoutFacts): PayoutStanding {
  if (row.status !== "processing") return "void";
  if (row.paymentStatus !== "captured") return "void";
  if (row.shipmentStatus === "CANCELLED") return "void";
  return row.shipmentStatus === "DELIVERED" ? "payable" : "undelivered";
}

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
      const claimed = await withdrawalsDal.claimPayouts(
        rows.map((r) => r.id),
        withdrawal.id,
        tx
      );

      // Fewer than were just read: a parallel request claimed them first, or a
      // refund voided one. The frozen total would no longer be what this
      // request holds, so it is not kept (payout_safety_spec.md §4).
      if (claimed.length !== rows.length) {
        throw err("WITHDRAWAL_BALANCE_CHANGED", 409);
      }

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
   * `reject` releases what is still owed so it is available again.
   *
   * Both yeses re-check every payout the request holds: a refund, or a job
   * claimed before it was delivered, must never be approved or recorded as
   * paid (payout_safety_spec.md §4).
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
    if (input.seenStatus && withdrawal.status !== input.seenStatus) {
      throw err("WITHDRAWAL_STATUS_CHANGED", 409);
    }

    if (input.action === "approve") {
      return await notifyCarrier(
        await approve(withdrawal, actorUserId, input),
        "approved"
      );
    }

    if (input.action === "mark_paid") {
      return await notifyCarrier(
        await markPaid(withdrawal, actorUserId, input),
        "paid"
      );
    }

    // A driver told their transfer was being made is not told it was "not
    // approved". Read as approved, a request stays approved until it closes,
    // so that notice is always true; the other is worded to stay true if an
    // approval lands between this read and the refusal.
    return await notifyCarrier(
      await reject(withdrawal, actorUserId, input),
      withdrawal.status === "approved" ? "approvalCancelled" : "rejected"
    );
  },
};

// ========================================
// Decisions
// ========================================

/**
 * Refuses a request that can no longer be paid as it stands, and returns the
 * payouts it covers.
 *
 * Refused whole rather than recomputed. The amount was frozen when the driver
 * asked and is the figure the operator approves; a total that quietly shrank
 * afterwards would differ from the one approved — and from the one
 * transferred. So the operator refuses it, what is still owed goes back to the
 * balance, and the driver asks again for the right amount.
 */
async function requireAllPayable(
  withdrawal: Withdrawal,
  tx: Executor = db
): Promise<string[]> {
  const rows = await withdrawalsDal.claimedPayouts(withdrawal.id, tx);
  const total = rows.reduce((sum, r) => sum + r.amountCents, 0);
  const allPayable =
    rows.length > 0 && rows.every((r) => payoutStanding(r) === "payable");

  if (!allPayable || total !== withdrawal.amountCents) throw invalidPayout();

  return rows.map((r) => r.id);
}

/**
 * The decision itself, onto a request nobody else has settled meanwhile —
 * and, given `from`, still in the status it was decided from. A request that
 * only moved on (approved by a colleague) answers `WITHDRAWAL_STATUS_CHANGED`,
 * so the queue shows it as it is now; one that closed answers
 * `WITHDRAWAL_ALREADY_SETTLED`.
 */
async function writeDecision(
  id: string,
  patch: Parameters<typeof withdrawalsDal.updateOpen>[1],
  tx: Executor = db,
  from?: "requested" | "approved"
) {
  const row = from
    ? await withdrawalsDal.updateOpen(id, patch, tx, from)
    : await withdrawalsDal.updateOpen(id, patch, tx);
  if (row) return row;
  const now = from ? await withdrawalsDal.getById(id, tx) : undefined;
  const stillOpen = now?.status === "requested" || now?.status === "approved";
  throw err(stillOpen ? "WITHDRAWAL_STATUS_CHANGED" : "WITHDRAWAL_ALREADY_SETTLED", 409);
}

/**
 * Runs a yes, and answers a lost race as one.
 *
 * Both yeses check the payouts before they reach `writeDecision`, so a
 * colleague who refused the request first (which unlinks its payouts) or
 * recorded it paid (which marks them paid) fails that check — and the operator
 * would be told to refuse a request somebody else has already settled. So an
 * invalid payout re-reads the request, once the transaction has rolled back:
 * no longer open, it is the race the request-row guard answers everywhere
 * else. Still open, the payout really is unpayable.
 *
 * Not solved by writing the request row first: `reject` locks the payouts and
 * then the row, and a `mark_paid` taking them the other way round deadlocks
 * against it (payout_safety_spec.md §4).
 */
async function unlessSettledMeanwhile(
  withdrawalId: string,
  decision: () => Promise<Withdrawal>
) {
  try {
    return await decision();
  } catch (error) {
    if (!(error instanceof WithdrawalError) || error.code !== INVALID_PAYOUT) {
      throw error;
    }
    const now = await withdrawalsDal.getById(withdrawalId);
    if (!now || now.status === "paid" || now.status === "rejected") {
      throw err("WITHDRAWAL_ALREADY_SETTLED", 409);
    }
    throw error;
  }
}

async function approve(
  withdrawal: Withdrawal,
  actorUserId: string,
  input: DecideWithdrawalInput
) {
  if (withdrawal.status !== "requested") {
    throw err("WITHDRAWAL_NOT_REQUESTED", 409);
  }

  return await unlessSettledMeanwhile(withdrawal.id, async () => {
    await requireAllPayable(withdrawal);

    // From « requested » only: two approvals racing would otherwise both
    // write, and the driver hear twice that the transfer is coming.
    return await writeDecision(
      withdrawal.id,
      {
        status: "approved",
        decidedBy: actorUserId,
        decidedAt: new Date(),
        decisionNote: input.note ?? null,
      },
      db,
      "requested"
    );
  });
}

async function markPaid(
  withdrawal: Withdrawal,
  actorUserId: string,
  input: DecideWithdrawalInput
) {
  if (!input.reference) {
    throw err(
      "REFERENCE_REQUIRED",
      400,
      "Record the transfer reference so this can be reconciled later"
    );
  }
  const reference = input.reference;

  const record = () =>
    db.transaction(async (tx) => {
      const payoutIds = await requireAllPayable(withdrawal, tx);
      const settled = await withdrawalsDal.settlePayouts(payoutIds, tx);

      // A refund voided one between the check and this write — or another
      // decision settled the request, which `unlessSettledMeanwhile` tells
      // apart. Recording the rest as paid would leave the request's total
      // claiming money it no longer covers.
      if (settled.length !== payoutIds.length) throw invalidPayout();

      return await writeDecision(
        withdrawal.id,
        {
          status: "paid",
          reference,
          decidedBy: actorUserId,
          decidedAt: withdrawal.decidedAt ?? new Date(),
          paidAt: new Date(),
        },
        tx
      );
    });

  return await unlessSettledMeanwhile(withdrawal.id, record);
}

/**
 * Hands back what is still owed and voids the rest.
 *
 * Releasing everything, as this did, put a payout whose job had been refunded
 * straight back in the balance — where the next request claimed it again.
 */
async function reject(
  withdrawal: Withdrawal,
  actorUserId: string,
  input: DecideWithdrawalInput
) {
  return await db.transaction(async (tx) => {
    const rows = await withdrawalsDal.claimedPayouts(withdrawal.id, tx);
    const stillOwed = rows
      .filter((r) => payoutStanding(r) !== "void")
      .map((r) => r.id);

    await withdrawalsDal.releasePayouts(stillOwed, tx);
    // Whatever the request still holds after that can never be paid.
    await withdrawalsDal.voidClaimedPayouts(withdrawal.id, tx);

    return await writeDecision(
      withdrawal.id,
      {
        status: "rejected",
        decidedBy: actorUserId,
        decidedAt: new Date(),
        decisionNote: input.note ?? null,
      },
      tx,
      input.seenStatus
    );
  });
}

type CarrierNotice = "approved" | "paid" | "rejected" | "approvalCancelled";

/** Tells the driver. A notification never blocks the decision. */
async function notifyCarrier(updated: Withdrawal, outcome: CarrierNotice) {
  const notice = carrierNotice(outcome);

  await notificationsService
    .createNotification({
      userId: updated.carrierId,
      type: "payout_scheduled",
      title: notice.title,
      message: notice.message,
      linkUrl: "/carrier/withdrawals",
      data: { withdrawalId: updated.id, status: updated.status },
    })
    .catch((e) => console.error("withdrawal notification failed", e));

  return updated;
}

function carrierNotice(outcome: CarrierNotice) {
  return {
    approved: {
      title: "Withdrawal approved",
      message: "Your withdrawal was approved. The transfer is being made.",
    },
    paid: {
      title: "Withdrawal paid",
      message: "Your withdrawal has been transferred.",
    },
    // Refused from `requested` — as far as `decide` read it. True from either
    // state, because an approval can land between that read and the refusal.
    rejected: {
      title: "Withdrawal refused",
      message:
        "Your withdrawal request was refused. What you are still owed is available again.",
    },
    // Refused after the driver was told the transfer was being made.
    approvalCancelled: {
      title: "Withdrawal cancelled",
      message:
        "Your approved withdrawal was cancelled. What you are still owed is available again.",
    },
  }[outcome];
}
