import { describe, expect, it } from "vitest";

import {
  PRODUCTION_DB_REFS,
  assertDevelopmentDatabase,
  assertNotProductionDatabase,
  describeDatabase,
} from "../db-target";

/**
 * The guard had no tests at all until the database moved from Supabase to Neon
 * on 2026-09-10 and its parsing was rewritten. It is the thing standing between
 * a stale connection string and a wiped production database, so the cases below
 * are the ones that would actually cost data.
 */

const PROD = PRODUCTION_DB_REFS[0];
const REGION = "c-12.us-east-1.aws.neon.tech";

const prodPooled = `postgresql://u:p@${PROD}-pooler.${REGION}/neondb?sslmode=require`;
const prodDirect = `postgresql://u:p@${PROD}.${REGION}/neondb?sslmode=require`;
const localUrl = "postgresql://postgres@localhost:5432/expeditoo_dev";
const otherNeon = `postgresql://u:p@ep-other-endpoint-1234-pooler.${REGION}/neondb`;

/** `NodeJS.ProcessEnv` requires NODE_ENV, so fixtures go through here. */
const env = (extra: Record<string, string> = {}): NodeJS.ProcessEnv =>
  ({ NODE_ENV: "test", ...extra }) as NodeJS.ProcessEnv;

describe("describeDatabase", () => {
  it("recognises production on the pooled host", () => {
    const t = describeDatabase(prodPooled, env());
    expect(t.projectRef).toBe(PROD);
    expect(t.isProduction).toBe(true);
    expect(t.isKnownDev).toBe(false);
  });

  it("recognises production on the DIRECT host too", () => {
    // The pooled and unpooled URLs are the same database. Migrations are run
    // against the direct one, so a guard that only knew the pooled host would
    // wave through exactly the connection that runs DDL.
    const t = describeDatabase(prodDirect, env());
    expect(t.projectRef).toBe(PROD);
    expect(t.isProduction).toBe(true);
  });

  it("treats localhost as a known development target", () => {
    const t = describeDatabase(localUrl, env());
    expect(t.isLocal).toBe(true);
    expect(t.isKnownDev).toBe(true);
    expect(t.isProduction).toBe(false);
  });

  it("fails closed on an unrecognised remote Neon endpoint", () => {
    const t = describeDatabase(otherNeon, env());
    expect(t.isProduction).toBe(false);
    expect(t.isKnownDev).toBe(false);
  });

  it("accepts a remote endpoint only once DEV_DB_REFS names it", () => {
    const t = describeDatabase(otherNeon, env({ DEV_DB_REFS: "ep-other-endpoint-1234" }));
    expect(t.isKnownDev).toBe(true);
  });

  it("never lets DEV_DB_REFS promote production to a dev target", () => {
    const t = describeDatabase(prodPooled, env({ DEV_DB_REFS: PROD }));
    expect(t.isProduction).toBe(true);
    expect(t.isKnownDev).toBe(false);
  });

  it("catches the production id arriving in a shape the parser does not know", () => {
    // The raw substring sweep — a proxied host, an IP, a future Neon shape.
    const t = describeDatabase(`postgresql://u:p@10.0.0.5:5432/${PROD}`, env());
    expect(t.isProduction).toBe(true);
  });

  it("reports no endpoint id for a non-Neon host", () => {
    expect(describeDatabase(localUrl, env()).projectRef).toBeNull();
  });

  it("keeps the password out of the printable label", () => {
    expect(describeDatabase(prodPooled, env()).label).not.toContain("p@");
  });

  it("rejects something that is not a URL", () => {
    expect(() => describeDatabase("not-a-url", env())).toThrow(/connection string/i);
  });
});

describe("assertNotProductionDatabase", () => {
  it("throws on production, naming the target", () => {
    expect(() => assertNotProductionDatabase(prodPooled, "seed", env())).toThrow(
      /PRODUCTION/
    );
  });

  it("allows localhost", () => {
    expect(assertNotProductionDatabase(localUrl, "seed", env()).isLocal).toBe(true);
  });
});

describe("assertDevelopmentDatabase", () => {
  it("throws on production", () => {
    expect(() => assertDevelopmentDatabase(prodDirect, "wipe", env())).toThrow(
      /PRODUCTION/
    );
  });

  it("throws on a remote nobody allow-listed", () => {
    expect(() => assertDevelopmentDatabase(otherNeon, "wipe", env())).toThrow(
      /not a recognised development database/
    );
  });

  it("allows localhost", () => {
    expect(assertDevelopmentDatabase(localUrl, "wipe", env()).isKnownDev).toBe(true);
  });
});
