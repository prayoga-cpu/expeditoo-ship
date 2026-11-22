import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

/**
 * board_route_search_spec.md §12 and listing_reference_spec.md §4 — the board
 * finds a job by its title, or by its reference.
 *
 * The harness stands in for the two reads `browse` makes and keeps the
 * condition it was handed, which is then rendered by Drizzle's own Postgres
 * dialect: what is asserted is the SQL the database would receive.
 */

const captured = vi.hoisted(() => ({
  where: undefined as unknown,
  orderBy: undefined as unknown,
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      listings: {
        findMany: async (args: { where: unknown; orderBy: unknown }) => {
          captured.where = args.where;
          captured.orderBy = args.orderBy;
          return [];
        },
      },
    },
    select: () => ({ from: () => ({ where: async () => [{ total: 0 }] }) }),
  },
}));

import { listingsDal } from "../listings.dal";
import { COORDINATE_SCALE } from "@/lib/listing-coordinates";
import { FOLD_FROM, FOLD_TO } from "@/lib/title-search";

const renderedWhere = () =>
  new PgDialect().sqlToQuery(captured.where as SQL);

const renderedOrder = () =>
  (captured.orderBy as SQL[]).map((part) => new PgDialect().sqlToQuery(part).sql);

beforeEach(() => {
  captured.where = undefined;
  captured.orderBy = undefined;
});

describe("listingsDal.browse — « Titre de l'annonce »", () => {
  const FOLDED =
    'translate(lower(normalize("listings"."title", NFC)), $';

  it("matches the title, folded on both sides, and nothing else", async () => {
    await listingsDal.browse({ q: "CANAPÉ", page: 1, limit: 20 });

    const { sql, params } = renderedWhere();
    expect(sql).toContain(FOLDED);
    expect(sql).toMatch(/ like \$\d+ escape '\\'/);
    // What was typed is folded before it is bound: case and accents aside.
    expect(params).toContain("%canape%");
    expect(params).toContain(FOLD_FROM);
    expect(params).toContain(FOLD_TO);
    // The title only: it is the one text every audience reads
    // (listing_privacy_spec.md). No description, no address, no notes.
    expect(sql).not.toContain("to_tsvector");
    for (const column of ["description", "pickup_address", "dropoff_address", "pickup_notes"]) {
      expect(sql).not.toContain(`"listings"."${column}"`);
    }
    expect(sql).not.toContain('"reference"');
  });

  it("asks for every word, in any order", async () => {
    await listingsDal.browse({ q: "cuir canapé", page: 1, limit: 20 });

    const { sql, params } = renderedWhere();
    expect(sql.split(FOLDED).length - 1).toBe(2);
    expect(params).toEqual(expect.arrayContaining(["%cuir%", "%canape%"]));
  });

  it("binds what was typed and escapes its wildcards", async () => {
    await listingsDal.browse({ q: "100%_'; drop table", page: 1, limit: 20 });

    const { sql, params } = renderedWhere();
    // Bound, never spliced into the statement.
    expect(sql).not.toContain("drop table");
    expect(params).toContain("%100\\%\\_';%");
  });

  it("matches the reference or the title when digits name one", async () => {
    await listingsDal.browse({ q: "100042", page: 1, limit: 20 });

    const { sql, params } = renderedWhere();
    expect(sql).toMatch(/\("listings"\."reference" = \$\d+ or translate\(lower\(/);
    expect(params).toContain(100042);
    // A title can hold the number too.
    expect(params).toContain("%100042%");
  });

  it("reads « Réf. 100042 » as the reference it names", async () => {
    await listingsDal.browse({ q: "Réf. 100042", page: 1, limit: 20 });

    expect(renderedWhere().params).toContain(100042);
  });

  it("filters nothing on blank text", async () => {
    await listingsDal.browse({ q: "   ", page: 1, limit: 20 });

    expect(renderedWhere().sql).not.toContain("translate(");
  });

  it("keeps the board's own rules around a referenced job", async () => {
    // A cancelled or expired job is not on the board, reference or not.
    await listingsDal.browse({ q: "100042", page: 1, limit: 20 });

    const { sql, params } = renderedWhere();
    expect(sql).toMatch(/^\("listings"\."status" = \$\d+ and "listings"\."expires_at" >= \$\d+ and /);
    expect(params).toContain("open");
  });
});

/**
 * listing_privacy_spec.md §3 — a location filter never answers more precisely
 * than the card. Every place a pin column is read must sit inside the rounding
 * for a viewer shown rounded pins, and nowhere for one shown exact pins.
 */
describe("listingsDal.browse — location, at the viewer's precision", () => {
  const PINS = [
    '"listings"."pickup_lat"',
    '"listings"."pickup_lng"',
    '"listings"."dropoff_lat"',
    '"listings"."dropoff_lng"',
  ];
  const count = (text: string, part: string) => text.split(part).length - 1;
  const roundedCount = (text: string, column: string) =>
    count(text, `(floor(${column} * `);

  const around = { fromLat: 48.85, fromLng: 2.35, radiusKm: 1, page: 1, limit: 20 };
  const corridor = { ...around, toLat: 45.76, toLng: 4.84, via: [{ lat: 47, lng: 4 }] };

  it("rounds the pins a radius search reads, unless told otherwise", async () => {
    // Absent means rounded: a caller that forgets the option fails closed.
    await listingsDal.browse(around);

    const { sql } = renderedWhere();
    expect(count(sql, '"listings"."pickup_lat"')).toBeGreaterThan(0);
    for (const pin of PINS) {
      expect(roundedCount(sql, pin)).toBe(count(sql, pin));
    }
  });

  it("rounds both ends of a corridor search, and the direction test", async () => {
    // The dropoff is an Expedion buyer's home: the corridor is the filter
    // that could find it.
    await listingsDal.browse(corridor, { exactLocation: false });

    const { sql } = renderedWhere();
    expect(count(sql, '"listings"."dropoff_lat"')).toBeGreaterThan(0);
    for (const pin of PINS) {
      expect(roundedCount(sql, pin)).toBe(count(sql, pin));
    }
  });

  it("sorts by distance on the rounded pins too", async () => {
    await listingsDal.browse({ ...around, sort: "distance_asc" });

    const [byDistance] = renderedOrder();
    expect(byDistance).toContain('(floor("listings"."pickup_lat" * ');
    expect(count(byDistance, '"listings"."pickup_lat"')).toBe(
      roundedCount(byDistance, '"listings"."pickup_lat"')
    );
  });

  it("rounds exactly as the card does: floor(value × 100 + 0.5) / 100", async () => {
    await listingsDal.browse(around);

    const { sql, params } = renderedWhere();
    const match = sql.match(
      /\(floor\("listings"\."pickup_lat" \* \$(\d+)::double precision \+ \$(\d+)::double precision\) \/ \$(\d+)::double precision\)/
    );
    expect(match).not.toBeNull();
    const [scale, half, divisor] = match!.slice(1).map((n) => params[Number(n) - 1]);
    expect([scale, half, divisor]).toEqual([COORDINATE_SCALE, 0.5, COORDINATE_SCALE]);
  });

  it("reads the exact pins for a viewer shown them", async () => {
    await listingsDal.browse(around, { exactLocation: true });
    const radius = renderedWhere().sql;
    expect(radius).not.toContain("floor(");
    expect(radius).toContain('radians("listings"."pickup_lat")');

    await listingsDal.browse(corridor, { exactLocation: true });
    const path = renderedWhere().sql;
    expect(path).not.toContain("floor(");
    expect(path).toContain('("listings"."dropoff_lng" * ');
  });
});

describe("listingsDal.browse — the order", () => {
  it("puts the newest first by the day they went live", async () => {
    await listingsDal.browse({ page: 1, limit: 20 });

    expect(renderedOrder()[0]).toBe(
      'coalesce("listings"."published_at", "listings"."created_at") desc'
    );
  });

  it.each(["created_desc", "budget_desc", "budget_asc", "pickup_asc", "distance_asc"] as const)(
    "settles %s ties on the unique reference, so no job shows on two pages",
    async (sort) => {
      // One scheduler run publishes its batch at one instant, and budgets
      // repeat: rows that sort equal have no stable order between two pages.
      await listingsDal.browse({ page: 1, limit: 20, sort });

      const order = renderedOrder();
      expect(order.length).toBeGreaterThan(1);
      expect(order.at(-1)).toBe('"listings"."reference" desc');
    }
  );
});
