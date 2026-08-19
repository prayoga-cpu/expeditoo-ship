import { config } from "dotenv";

/**
 * Load the env files a standalone script needs.
 *
 * Next loads `.env.local` itself, but `tsx src/db/migrate.ts` and everything
 * under `src/scripts/` only got `dotenv`'s default, which reads `.env` — a
 * file this repo does not have. Those commands therefore saw no `POSTGRES_URL`
 * at all unless someone exported it by hand.
 *
 * Order mirrors Next: `.env.local` first, `.env` as the shared fallback.
 * dotenv does not overwrite a key that is already set, so a value exported in
 * the shell still wins over both.
 */
export function loadEnv(): void {
  config({ path: [".env.local", ".env"], quiet: true });
}

loadEnv();
