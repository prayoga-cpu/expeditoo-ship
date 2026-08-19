import "@/lib/load-env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { assertNotProductionDatabase } from "@/lib/db-target";
import { APP_ENV, isProductionEnv } from "@/lib/env";
import * as schema from "./schema";

// Create PostgreSQL connection
const connectionString = process.env.POSTGRES_URL!;

if (!connectionString) {
  throw new Error(
    "POSTGRES_URL environment variable is not defined. Please check your .env file."
  );
}

/**
 * Nothing but the production deployment may open the production database.
 *
 * `.env.local` used to be a `vercel env pull` dump, so `pnpm dev` on a laptop
 * connected straight to production — every local page load, migration and seed
 * script wrote to real data. This is the backstop for that: it fires at import
 * time, before a single query is issued, and it cannot be switched off with a
 * flag. Preview deploys are covered too, since `APP_ENV` only reads
 * "production" when `VERCEL_ENV` does.
 */
if (!isProductionEnv) {
  assertNotProductionDatabase(
    connectionString,
    `open a database connection from a "${APP_ENV}" process`
  );
}

/**
 * How many connections one process may hold.
 *
 * This has to exceed the widest fan-out any single request makes. Once the
 * pool is exhausted postgres.js pipelines further queries onto a connection
 * that is already busy, and Supabase's transaction pooler (port 6543) does not
 * support pipelining — it stops answering rather than erroring, so the request
 * hangs instead of failing. Measured against this database: 18 concurrent
 * queries on the library default of 10 never returned (>25s), while the same
 * 18 on a pool of 20 came back in ~2.4s.
 *
 * The operator report was the request that hit it, firing 18 at once; it is
 * two round trips now, so this is headroom for the per-section fallback rather
 * than the everyday path.
 */
const POOL_MAX = Number(process.env.POSTGRES_POOL_MAX ?? 20);

/**
 * Seconds a connection may sit unused before it is closed.
 *
 * Opening one costs ~2s against eu-central-1, so this is deliberately longer
 * than the gap between two page loads in a working session — the pool stays
 * warm while someone is using the app and gives its slots back when nobody is.
 */
const IDLE_TIMEOUT = Number(process.env.POSTGRES_IDLE_TIMEOUT ?? 60);

/**
 * One pool per process, kept on `globalThis`.
 *
 * Next re-evaluates this module on every hot reload, and without a global
 * handle each edit minted a fresh pool: the new one started cold — paying the
 * ~2s handshake again on the next query — while the old one's sockets lingered
 * against the 60-connection budget the whole project shares. Caching here
 * keeps a single warm pool across reloads. It is not guarded by NODE_ENV
 * because a second evaluation is never wanted, whichever environment causes it.
 */
const globalForDb = globalThis as unknown as {
  __expeditooPgClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__expeditooPgClient ??
  postgres(connectionString, {
    prepare: false, // Required for Supabase connection pooler
    max: POOL_MAX,
    idle_timeout: IDLE_TIMEOUT,
  });

globalForDb.__expeditooPgClient = client;

// Create Drizzle instance with schema
export const db = drizzle(client, { schema });

// Export schema for type inference
export * from "./schema";
