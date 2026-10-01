import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

/**
 * listing_reference_spec.md §4 — the board finds a job by its reference.
 *
 * The harness stands in for the two reads `browse` makes and keeps the
 * condition it was handed, which is then rendered by Drizzle's own Postgres
 * dialect: what is asserted is the SQL the database would receive.
 */

const captured = vi.hoisted(() => ({ where: undefined as unknown }));

vi.mock("@/db", () => ({
  db: {
    query: {
      listings: {
        findMany: async (args: { where: unknown }) => {
          captured.where = args.where;
          return [];
        },
      },
    },
    select: () => ({ from: () => ({ where: async () => [{ total: 0 }] }) }),
  },
}));

import { listingsDal } from "../listings.dal";

const renderedWhere = () =>
  new PgDialect().sqlToQuery(captured.where as SQL);

beforeEach(() => {
  captured.where = undefined;
});

describe("listingsDal.browse — search by reference", () => {
  it("matches the reference or the text when the search names one", async () => {
    await listingsDal.browse({ q: "Réf. 100042", page: 1, limit: 20 });

    const { sql, params } = renderedWhere();
    expect(sql).toMatch(
      /\("listings"\."reference" = \$\d+ or to_tsvector\('french'/
    );
    expect(params).toContain(100042);
    // The words are still searched as words, prefix and all.
    expect(params).toContain("Réf. 100042");
  });

  it("searches the text alone when the search names no reference", async () => {
    await listingsDal.browse({ q: "canapé", page: 1, limit: 20 });

    const { sql } = renderedWhere();
    expect(sql).not.toContain('"reference"');
    expect(sql).toContain("plainto_tsquery('french'");
  });

  it("keeps the board's own rules around a referenced job", async () => {
    // A cancelled or expired job is not on the board, reference or not.
    await listingsDal.browse({ q: "100042", page: 1, limit: 20 });

    const { sql, params } = renderedWhere();
    expect(sql).toMatch(/^\("listings"\."status" = \$\d+ and "listings"\."expires_at" >= \$\d+ and /);
    expect(params).toContain("open");
  });
});
