import "../lib/load-env";
import postgres from "postgres";
import { assertDevelopmentDatabase } from "../lib/db-target";

/**
 * Empty every table in the development database, keeping the schema.
 *
 * `package.json` has always exposed this as `pnpm db:clean`, but the file it
 * pointed at did not exist. It is written as a single TRUNCATE so foreign keys
 * do not dictate an ordering, and `RESTART IDENTITY` resets the sequences the
 * seed scripts then reuse.
 *
 * Drizzle's own `__drizzle_migrations` bookkeeping is left alone — the tables
 * are still migrated, only their rows are gone.
 */
async function clean() {
  const connectionString = process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error("POSTGRES_URL environment variable is required");
  }

  const target = assertDevelopmentDatabase(
    connectionString,
    "delete every row"
  );

  const sql = postgres(connectionString, { max: 1 });

  try {
    const tables = await sql<{ tablename: string }[]>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> '__drizzle_migrations'
    `;

    if (tables.length === 0) {
      console.log("Nothing to clean — no tables in the public schema.");
      return;
    }

    const list = tables
      .map((row) => `"public"."${row.tablename}"`)
      .join(", ");

    await sql.unsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);

    console.log(
      `🧹 Emptied ${tables.length} tables in ${target.label}`
    );
  } finally {
    await sql.end();
  }
}

clean().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
