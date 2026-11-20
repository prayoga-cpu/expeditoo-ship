import { describe, expect, it } from "vitest";
import { isConnectionFailure, shouldMigrateOnBuild } from "../build-migrate";

describe("shouldMigrateOnBuild", () => {
  it("migrates the dev branch's preview build", () => {
    expect(
      shouldMigrateOnBuild({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "dev" })
    ).toBe(true);
  });

  it("never migrates a production build, whatever the branch", () => {
    expect(
      shouldMigrateOnBuild({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" })
    ).toBe(false);
    expect(
      shouldMigrateOnBuild({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "dev" })
    ).toBe(false);
  });

  it("leaves other preview branches alone", () => {
    expect(
      shouldMigrateOnBuild({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "release/2.91.0" })
    ).toBe(false);
    expect(
      shouldMigrateOnBuild({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "dev-something" })
    ).toBe(false);
  });

  it("does nothing off Vercel", () => {
    expect(shouldMigrateOnBuild({})).toBe(false);
    expect(shouldMigrateOnBuild({ VERCEL_GIT_COMMIT_REF: "dev" })).toBe(false);
  });
});

describe("isConnectionFailure", () => {
  it("recognises a database that could not be reached", () => {
    expect(isConnectionFailure("Error: connect ECONNREFUSED 10.0.0.1:5432")).toBe(true);
    expect(isConnectionFailure("code: 'CONNECT_TIMEOUT'")).toBe(true);
  });

  it("does not retry a migration the database refused", () => {
    expect(isConnectionFailure('PostgresError: column "x" does not exist')).toBe(false);
    expect(
      isConnectionFailure("Refusing to run migrations: that connection string points at PRODUCTION.")
    ).toBe(false);
  });
});
