import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * listing_reference_spec.md §2 — the statements that make the reference
 * trustworthy, pinned so a later "simplification" cannot drop one quietly.
 *
 * The behaviour itself (numbering by age, the sequence hand-off, a re-run
 * renumbering nothing) was run against Postgres 17 when the migration was
 * written — STATUS.md, the job-reference entry, has the numbers. What this
 * guards is the shape of the file.
 */

const sql = readFileSync(
  join(process.cwd(), "src/db/migrations/0033_listing_reference.sql"),
  "utf8"
)
  // Comments explain; only statements are asserted.
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("0033_listing_reference", () => {
  it("issues references from 100001", () => {
    expect(sql).toMatch(
      /CREATE SEQUENCE IF NOT EXISTS "listing_reference_seq" AS integer START WITH 100001/
    );
  });

  it("adds the column without a default, so existing rows are numbered by us", () => {
    // A volatile default on ADD COLUMN would number existing rows in physical
    // order; the backfill below numbers them by age instead.
    expect(sql).toMatch(
      /ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "reference" integer;/
    );
  });

  it("numbers existing jobs oldest first, and only those without one", () => {
    expect(sql).toMatch(/row_number\(\) OVER \(ORDER BY "created_at", "id"\)/);
    expect(sql).toMatch(/WHERE "reference" IS NULL/);
  });

  it("hands the sequence on from the highest reference issued", () => {
    expect(sql).toMatch(
      /setval\('listing_reference_seq', \(SELECT COALESCE\(max\("reference"\), 100000\) FROM "listings"\)\)/
    );
  });

  it("then makes the sequence the only writer, required and unique", () => {
    const order = [
      `SET DEFAULT nextval('listing_reference_seq')`,
      `SET NOT NULL`,
      `OWNED BY "listings"."reference"`,
      `ADD CONSTRAINT "listings_reference_unique" UNIQUE ("reference")`,
    ].map((statement) => sql.indexOf(statement));

    expect(order.every((index) => index > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(sql.indexOf("setval(")).toBeLessThan(order[0]);
  });
});
