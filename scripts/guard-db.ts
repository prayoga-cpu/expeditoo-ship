import "../src/lib/load-env";
import { assertDevelopmentDatabase } from "../src/lib/db-target";

/**
 * Preflight for the destructive drizzle-kit commands.
 *
 * `drizzle-kit push` rewrites the schema in place and `studio` hands out a
 * full editor, so both are chained behind this in package.json. Keeping the
 * check in a separate process means a refusal exits non-zero and the `&&`
 * never runs drizzle-kit at all.
 */
const action = process.argv[2] ?? "run this command";
const connectionString =
  process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;

if (!connectionString) {
  console.error("❌ POSTGRES_URL is not set — see .env.example.");
  process.exit(1);
}

try {
  const target = assertDevelopmentDatabase(connectionString, action);
  console.log(`✅ ${action} → ${target.label}`);
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
