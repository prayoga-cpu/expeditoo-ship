import { describe, expect, it } from "vitest";
import {
  buildPlan,
  destructiveChanges,
  gateEnv,
  isConnectionFailure,
  pendingMigrations,
} from "../build-migrate";

describe("buildPlan", () => {
  it("gates and migrates production on a production build", () => {
    expect(buildPlan({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" })).toEqual({
      gate: true,
      migrate: "production",
    });
  });

  it("gates and migrates the dev database on the dev branch's preview", () => {
    expect(buildPlan({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "dev" })).toEqual({
      gate: true,
      migrate: "dev",
    });
  });

  it("only builds any other preview branch", () => {
    for (const ref of ["release/2.95.0", "dev-something", "feature/x"]) {
      expect(buildPlan({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: ref })).toEqual({
        gate: false,
        migrate: "none",
      });
    }
  });

  it("does nothing off Vercel", () => {
    expect(buildPlan({})).toEqual({ gate: false, migrate: "none" });
    expect(buildPlan({ VERCEL_GIT_COMMIT_REF: "dev" })).toEqual({ gate: false, migrate: "none" });
  });
});

describe("gateEnv", () => {
  const build = {
    PATH: "/usr/bin",
    HOME: "/root",
    STRIPE_SECRET_KEY: "sk_live_x",
    POSTGRES_URL: "postgresql://owner:pw@ep-sweet-bonus-awtyfuyz.neon.tech/db",
    RESEND_API_KEY: "re_x",
    VERCEL_ENV: "production",
  };

  it("keeps the toolchain", () => {
    expect(gateEnv(build)).toMatchObject({ PATH: "/usr/bin", HOME: "/root", CI: "1" });
  });

  it("hands the tests no secret and no deployment identity", () => {
    const env = gateEnv(build);
    for (const key of ["STRIPE_SECRET_KEY", "POSTGRES_URL", "RESEND_API_KEY", "VERCEL_ENV"]) {
      expect(env).not.toHaveProperty(key);
    }
  });
});

describe("pendingMigrations", () => {
  const journal = [
    { tag: "0046_a", when: 100 },
    { tag: "0047_b", when: 200 },
    { tag: "0048_c", when: 300 },
  ];

  it("is everything on an empty database", () => {
    expect(pendingMigrations(journal, null).map((e) => e.tag)).toEqual(["0046_a", "0047_b", "0048_c"]);
  });

  it("is what comes after the newest applied entry, as drizzle decides it", () => {
    expect(pendingMigrations(journal, 200).map((e) => e.tag)).toEqual(["0048_c"]);
    expect(pendingMigrations(journal, 300)).toEqual([]);
  });
});

describe("destructiveChanges", () => {
  it("passes an additive migration", () => {
    expect(
      destructiveChanges(
        'ALTER TABLE "listings" ADD COLUMN "foo" text;--> statement-breakpoint\n' +
          'ALTER TABLE "listings" ADD COLUMN "bar" integer NOT NULL DEFAULT 0;\n' +
          'CREATE TABLE "x" ("id" text PRIMARY KEY NOT NULL);\n' +
          'ALTER TABLE "carriers" ALTER COLUMN "siret" DROP NOT NULL;'
      )
    ).toEqual([]);
  });

  it.each([
    ['DROP TABLE "old";', "DROP TABLE"],
    ['ALTER TABLE "a" DROP COLUMN "b";', "DROP COLUMN"],
    ['TRUNCATE "a";', "TRUNCATE"],
    ['DELETE FROM "a" WHERE true;', "DELETE FROM"],
    ['ALTER TABLE "a" RENAME COLUMN "b" TO "c";', "RENAME"],
    ['ALTER TABLE "a" ALTER COLUMN "b" SET DATA TYPE integer;', "ALTER COLUMN … TYPE"],
    ['ALTER TABLE "a" ALTER COLUMN "b" SET NOT NULL;', "SET NOT NULL"],
    ['ALTER TABLE "a" ADD COLUMN "b" text NOT NULL;', "ADD COLUMN … NOT NULL without DEFAULT"],
    ['DROP TYPE "status";', "DROP TYPE"],
  ])("flags %s", (sql, label) => {
    expect(destructiveChanges(sql)).toContain(label);
  });

  it("is quiet when the migration says the loss is meant, with a reason", () => {
    expect(
      destructiveChanges('-- release:allow-destructive the code stopped reading b in 2.97.0\nALTER TABLE "a" DROP COLUMN "b";')
    ).toEqual([]);
  });

  it("does not accept the marker without a reason", () => {
    expect(destructiveChanges('-- release:allow-destructive\nALTER TABLE "a" DROP COLUMN "b";')).toContain(
      "DROP COLUMN"
    );
  });

  it("ignores words inside comments", () => {
    expect(destructiveChanges("-- we no longer DROP TABLE anything here\nCREATE INDEX i ON a (b);")).toEqual([]);
  });
});

describe("isConnectionFailure", () => {
  it("recognises a database that could not be reached", () => {
    expect(isConnectionFailure("Error: connect ECONNREFUSED 10.0.0.1:5432")).toBe(true);
    expect(isConnectionFailure("code: 'CONNECT_TIMEOUT'")).toBe(true);
  });

  it("does not retry a migration the database refused", () => {
    expect(isConnectionFailure('PostgresError: column "x" does not exist')).toBe(false);
  });
});
