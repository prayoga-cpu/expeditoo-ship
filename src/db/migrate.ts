import "../lib/load-env";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { assertDevelopmentDatabase, describeDatabase } from "../lib/db-target";

/**
 * Migrating production is a deploy step, not something a laptop does by
 * accident, so this refuses any target that is not an allow-listed
 * development database. `MIGRATE_TARGET=production` is the deliberate opt-in
 * and is expected to come from CI, where `POSTGRES_URL` is the production one.
 */
function resolveTarget(connectionString: string) {
  if (process.env.MIGRATE_TARGET === "production") {
    const target = describeDatabase(connectionString);
    console.warn(`⚠️  MIGRATE_TARGET=production — migrating ${target.label}`);
    return target;
  }

  return assertDevelopmentDatabase(connectionString, "run migrations");
}

async function runMigration() {
  const connectionString = process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error("POSTGRES_URL environment variable is required");
  }

  const target = resolveTarget(connectionString);

  console.log(`🔄 Running database migrations against ${target.label}...`);

  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    console.log("✅ Migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigration();
