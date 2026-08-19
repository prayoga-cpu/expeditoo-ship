import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

/*
 * drizzle-kit only reads `.env` on its own, and this repo keeps everything in
 * `.env.local`, so without this the CLI saw no connection string at all.
 */
config({ path: [".env.local", ".env"], quiet: true });

/*
 * Prefer the direct connection. Migrations and introspection run DDL, and
 * Supabase's transaction pooler (port 6543) does not support the prepared
 * statements and session state drizzle-kit relies on. Locally the two are the
 * same URL, so this is a no-op there.
 */
const postgresUrl =
  process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;

if (!postgresUrl) {
  throw new Error(
    "Set POSTGRES_URL (or POSTGRES_URL_NON_POOLING) in .env.local — see .env.example."
  );
}

export default defineConfig({
  schema: "./src/db/schema",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: postgresUrl,
  },
  verbose: true,
  strict: true,
});
