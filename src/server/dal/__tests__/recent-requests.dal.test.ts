import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

/**
 * landing_2026_11_spec.md §4.2 — the landing's read of the newest open
 * requests. The harness keeps what the query was built from and renders it
 * with Drizzle's own Postgres dialect: what is asserted is what the database
 * would receive.
 */

const captured = vi.hoisted(() => ({
  fields: undefined as Record<string, unknown> | undefined,
  where: undefined as unknown,
  orderBy: [] as unknown[],
  limit: undefined as number | undefined,
}));

vi.mock("@/db", () => ({
  db: {
    select: (fields: Record<string, unknown>) => {
      captured.fields = fields;
      const chain = {
        from: () => chain,
        where: (where: unknown) => {
          captured.where = where;
          return chain;
        },
        orderBy: (...parts: unknown[]) => {
          captured.orderBy = parts;
          return chain;
        },
        limit: async (n: number) => {
          captured.limit = n;
          return [];
        },
      };
      return chain;
    },
  },
}));

import { recentRequestsDal } from "../recent-requests.dal";

const dialect = new PgDialect();
const NOW = new Date("2026-11-24T10:00:00Z");

beforeEach(() => {
  captured.fields = undefined;
  captured.where = undefined;
  captured.orderBy = [];
  captured.limit = undefined;
});

describe("recentRequestsDal.latestOpen", () => {
  it("reads open requests that are still taking offers, and nothing else", async () => {
    await recentRequestsDal.latestOpen(6, NOW);

    const { sql, params } = dialect.sqlToQuery(captured.where as SQL);
    expect(sql).toContain('"listings"."status" = $1');
    expect(sql).toContain('"listings"."expires_at" >= $2');
    expect(params[0]).toBe("open");
    // Bound as a value, not interpolated (CLAUDE.md gotcha 23).
    expect(params[1]).toBe(NOW.toISOString());
  });

  it("puts the most recently published first, the reference settling ties", async () => {
    await recentRequestsDal.latestOpen(6, NOW);

    const order = captured.orderBy.map((part) => dialect.sqlToQuery(part as SQL).sql);
    expect(order[0]).toBe(
      'coalesce("listings"."published_at", "listings"."created_at") desc'
    );
    expect(order[1]).toBe('"listings"."reference" desc');
  });

  it("asks for no more rows than it is told", async () => {
    await recentRequestsDal.latestOpen(6, NOW);
    expect(captured.limit).toBe(6);
  });

  it("selects no street, pin, contact, note, budget or requester", async () => {
    await recentRequestsDal.latestOpen(6, NOW);

    const selected = Object.keys(captured.fields ?? {});
    for (const column of [
      "pickupAddress",
      "dropoffAddress",
      "pickupLat",
      "pickupLng",
      "dropoffLat",
      "dropoffLng",
      "pickupPostalCode",
      "dropoffPostalCode",
      "pickupContactName",
      "pickupContactPhone",
      "dropoffContactName",
      "dropoffContactPhone",
      "pickupNote",
      "dropoffNote",
      "description",
      "budgetCents",
      "shipperId",
      "externalRef",
    ]) {
      expect(selected).not.toContain(column);
    }
  });
});
