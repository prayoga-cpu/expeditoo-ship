import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

/**
 * cancellations_spec.md §7.1 — one move, one writer. The harness keeps the
 * condition `updateStatus` hands its UPDATE, rendered by Drizzle's own Postgres
 * dialect: what is asserted is the SQL the database would receive.
 */

const captured = vi.hoisted(() => ({
  where: undefined as unknown,
  set: undefined as unknown,
  matched: [] as unknown[],
}));

vi.mock("@/db", () => ({
  db: {
    update: () => ({
      set: (values: unknown) => {
        captured.set = values;
        return {
          where: (condition: unknown) => {
            captured.where = condition;
            return { returning: async () => captured.matched };
          },
        };
      },
    }),
  },
}));

import { shipmentsDal } from "../shipments.dal";

const renderedWhere = () => new PgDialect().sqlToQuery(captured.where as SQL);

beforeEach(() => {
  captured.where = undefined;
  captured.set = undefined;
  captured.matched = [];
});

describe("shipmentsDal.updateStatus", () => {
  it("moves the row only from the status it was read at, when told one", async () => {
    await shipmentsDal.updateStatus("ship-1", "DELIVERED", { expected: "IN_TRANSIT" });

    const { sql, params } = renderedWhere();
    expect(sql).toBe('("shipments"."id" = $1 and "shipments"."status" = $2)');
    expect(params).toEqual(["ship-1", "IN_TRANSIT"]);
    expect(captured.set).toMatchObject({ status: "DELIVERED" });
  });

  it("answers nothing when the row had already moved", async () => {
    // Postgres matched no row, so RETURNING is empty: the caller lost.
    const result = await shipmentsDal.updateStatus("ship-1", "DELIVERED", {
      expected: "IN_TRANSIT",
    });

    expect(result).toBeUndefined();
  });

  it("matches on the id alone without a guard", async () => {
    captured.matched = [{ id: "ship-1", status: "ASSIGNED" }];

    const result = await shipmentsDal.updateStatus("ship-1", "ASSIGNED");

    expect(renderedWhere().sql).toBe('"shipments"."id" = $1');
    expect(result).toEqual({ id: "ship-1", status: "ASSIGNED" });
  });
});
