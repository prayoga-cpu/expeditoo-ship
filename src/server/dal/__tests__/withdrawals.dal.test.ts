import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

/**
 * payout_safety_spec.md §2.1 and §4 — the rules the database is asked to
 * apply, rendered by Drizzle's own Postgres dialect. The service tests mock
 * this module, so without this file the balance could quietly go back to
 * counting any `scheduled` row, or a guarded write lose its guard, with every
 * suite still green.
 *
 * The harness records each chain a method builds — the table updated, the
 * joins, the values set and the condition — and resolves it with whatever the
 * case hands back.
 */

const recorded = vi.hoisted(() => ({
  joins: [] as { kind: "inner" | "left"; table: unknown; on: unknown }[],
  where: undefined as unknown,
  set: undefined as Record<string, unknown> | undefined,
  updated: undefined as unknown,
  result: [] as unknown[],
  updates: 0,
}));

vi.mock("@/db", () => {
  const chain = () => {
    const node: Record<string, unknown> = {};
    const self = () => node;
    Object.assign(node, {
      from: self,
      limit: self,
      orderBy: self,
      returning: self,
      innerJoin: (table: unknown, on: unknown) => {
        recorded.joins.push({ kind: "inner", table, on });
        return node;
      },
      leftJoin: (table: unknown, on: unknown) => {
        recorded.joins.push({ kind: "left", table, on });
        return node;
      },
      set: (patch: Record<string, unknown>) => {
        recorded.set = patch;
        return node;
      },
      where: (condition: unknown) => {
        recorded.where = condition;
        return node;
      },
      then: (
        resolve: (rows: unknown[]) => unknown,
        reject: (error: unknown) => unknown
      ) => Promise.resolve(recorded.result).then(resolve, reject),
    });
    return node;
  };

  return {
    db: {
      select: () => chain(),
      update: (table: unknown) => {
        recorded.updates += 1;
        recorded.updated = table;
        return chain();
      },
    },
  };
});

import { payments, payouts } from "@/db/schema/payments";
import { shipments } from "@/db/schema/shipments";
import { withdrawals } from "@/db/schema/withdrawals";
import { withdrawalsDal } from "../withdrawals.dal";

const render = (condition: unknown) =>
  new PgDialect().sqlToQuery(condition as SQL);

beforeEach(() => {
  recorded.joins = [];
  recorded.where = undefined;
  recorded.set = undefined;
  recorded.updated = undefined;
  recorded.result = [];
  recorded.updates = 0;
});

// ========================================
// The balance
// ========================================

describe("the available balance", () => {
  it.each([
    ["availableFor", () => withdrawalsDal.availableFor("carrier-1")],
    ["availableRows", () => withdrawalsDal.availableRows("carrier-1")],
  ])("%s counts only delivered, paid-for, unclaimed payouts", async (_name, read) => {
    await read();

    const { sql, params } = render(recorded.where);
    expect(sql).toContain('"payouts"."carrier_id" = $');
    expect(sql).toContain('"payouts"."status" = $');
    expect(sql).toContain('"payouts"."withdrawal_id" is null');
    expect(sql).toContain('"shipments"."status" = $');
    expect(sql).toContain('"payments"."status" = $');
    expect(params).toEqual(
      expect.arrayContaining(["carrier-1", "scheduled", "DELIVERED", "captured"])
    );
  });

  it("joins the shipment and the payment the payout names, both inner", async () => {
    // Inner on purpose: a payout whose payment row is gone cannot be shown to
    // be paid for, so it is not money the driver may ask for.
    await withdrawalsDal.availableFor("carrier-1");

    expect(recorded.joins.map((j) => [j.kind, j.table])).toEqual([
      ["inner", shipments],
      ["inner", payments],
    ]);
    expect(render(recorded.joins[0].on).sql).toBe(
      '"shipments"."id" = "payouts"."shipment_id"'
    );
    expect(render(recorded.joins[1].on).sql).toBe(
      '"payments"."id" = "payouts"."payment_id"'
    );
  });
});

describe("claimedPayouts", () => {
  it("reads a request's payouts with a LEFT join on the payment", async () => {
    // A missing payment is an answer here — not paid for — and dropping the
    // row would make the request look smaller than its frozen amount.
    await withdrawalsDal.claimedPayouts("wd-1");

    expect(recorded.joins.map((j) => [j.kind, j.table])).toEqual([
      ["inner", shipments],
      ["left", payments],
    ]);
    const { sql, params } = render(recorded.where);
    expect(sql).toBe('"payouts"."withdrawal_id" = $1');
    expect(params).toEqual(["wd-1"]);
  });
});

// ========================================
// Every write names the status it moves from
// ========================================

describe("guarded writes", () => {
  it("claims only payouts still scheduled and unclaimed", async () => {
    await withdrawalsDal.claimPayouts(["po-1", "po-2"], "wd-1");

    expect(recorded.updated).toBe(payouts);
    expect(recorded.set).toMatchObject({ status: "processing", withdrawalId: "wd-1" });
    const { sql, params } = render(recorded.where);
    expect(sql).toContain('"payouts"."id" in ($1, $2)');
    expect(sql).toContain('"payouts"."status" = $3');
    expect(sql).toContain('"payouts"."withdrawal_id" is null');
    expect(params).toEqual(["po-1", "po-2", "scheduled"]);
  });

  it("settles only processing payouts", async () => {
    await withdrawalsDal.settlePayouts(["po-1"]);

    expect(recorded.set).toMatchObject({ status: "paid" });
    expect(recorded.set?.paidAt).toBeInstanceOf(Date);
    const { sql, params } = render(recorded.where);
    expect(sql).toBe('("payouts"."id" in ($1) and "payouts"."status" = $2)');
    expect(params).toEqual(["po-1", "processing"]);
  });

  it("releases only processing payouts, back to the balance", async () => {
    await withdrawalsDal.releasePayouts(["po-1"]);

    expect(recorded.set).toMatchObject({
      status: "scheduled",
      withdrawalId: null,
      paidAt: null,
    });
    const { params } = render(recorded.where);
    expect(params).toEqual(["po-1", "processing"]);
  });

  it("voids what a refused request still holds, never a paid payout", async () => {
    await withdrawalsDal.voidClaimedPayouts("wd-1");

    expect(recorded.set).toMatchObject({ status: "cancelled", withdrawalId: null });
    const { sql, params } = render(recorded.where);
    expect(sql).toBe(
      '("payouts"."withdrawal_id" = $1 and "payouts"."status" <> $2)'
    );
    expect(params).toEqual(["wd-1", "paid"]);
  });

  it("writes a decision only onto a request still open", async () => {
    recorded.result = [{ id: "wd-1", status: "approved" }];

    const row = await withdrawalsDal.updateOpen("wd-1", { status: "approved" });

    expect(row).toEqual({ id: "wd-1", status: "approved" });
    expect(recorded.updated).toBe(withdrawals);
    const { sql, params } = render(recorded.where);
    expect(sql).toBe(
      '("withdrawals"."id" = $1 and "withdrawals"."status" in ($2, $3))'
    );
    expect(params).toEqual(["wd-1", "requested", "approved"]);
  });

  it("writes it only from the status the operator saw, when given one", async () => {
    recorded.result = [{ id: "wd-1", status: "rejected" }];

    await withdrawalsDal.updateOpen("wd-1", { status: "rejected" }, undefined, "requested");

    const { sql, params } = render(recorded.where);
    expect(sql).toBe('("withdrawals"."id" = $1 and "withdrawals"."status" = $2)');
    expect(params).toEqual(["wd-1", "requested"]);
  });

  it("answers nothing when the request was settled meanwhile", async () => {
    recorded.result = [];

    expect(
      await withdrawalsDal.updateOpen("wd-1", { status: "rejected" })
    ).toBeUndefined();
  });

  it("issues no update for an empty set of payouts", async () => {
    expect(await withdrawalsDal.claimPayouts([], "wd-1")).toEqual([]);
    expect(await withdrawalsDal.settlePayouts([])).toEqual([]);
    await withdrawalsDal.releasePayouts([]);

    expect(recorded.updates).toBe(0);
  });
});
