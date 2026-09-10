/**
 * Tells apart the databases this project can point at, and refuses the
 * dangerous combinations.
 *
 * The whole file exists because one connection string used to serve every
 * purpose: `.env.local` was a `vercel env pull` dump, so `pnpm dev`,
 * `db:push`, `db:migrate` and the seed scripts all wrote to production. The
 * guards below are deliberately **fail-closed** — an unrecognised remote host
 * is refused rather than assumed safe, because the cost of being wrong is
 * asymmetric.
 *
 * See docs/specs/environments_spec.md.
 */

/**
 * Database identifiers that are production.
 *
 * Hardcoded on purpose. Reading this from the environment would mean a missing
 * variable silently disables the guard, which is the one failure mode that
 * matters. An endpoint id is not a secret — it is the public half of the
 * hostname, and the password is what protects the database.
 *
 * This held a Supabase project ref until 2026-09-10, when that project was
 * deleted out from under the deployment and production moved to Neon. The
 * value is a Neon **endpoint id**, which is the one part of the hostname that
 * is the same on the pooled host (`<endpoint>-pooler.<region>.aws.neon.tech`)
 * and the direct one (`<endpoint>.<region>.aws.neon.tech`) — so the guard
 * recognises production whichever of the two a caller was handed.
 */
export const PRODUCTION_DB_REFS: readonly string[] = ["ep-sweet-bonus-awtyfuyz"];

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

export interface DbTarget {
  host: string;
  port: string;
  database: string;
  /** Neon endpoint id, when the URL points at Neon. */
  projectRef: string | null;
  isLocal: boolean;
  isProduction: boolean;
  /** Explicitly allow-listed as a development target. */
  isKnownDev: boolean;
  /** Safe to print and log — never carries the password. */
  label: string;
}

/**
 * Pull the Neon endpoint id out of either host shape Neon hands out.
 *
 * Pooled and direct differ by one suffix — `ep-foo-bar-pooler.<region>…` and
 * `ep-foo-bar.<region>…` — and the two are the *same database*. Stripping the
 * suffix is what stops the pooled URL and the direct URL of production looking
 * like two unrelated hosts to the guard, which would let the direct one
 * through as "some unrecognised remote".
 */
function extractProjectRef(host: string): string | null {
  if (!/\.neon\.tech$/i.test(host)) return null;

  const endpoint = host.split(".")[0].replace(/-pooler$/i, "");
  return endpoint || null;
}

function devRefsFromEnv(env: NodeJS.ProcessEnv): string[] {
  return (env.DEV_DB_REFS ?? "")
    .split(",")
    .map((ref) => ref.trim())
    .filter(Boolean);
}

export function describeDatabase(
  connectionString: string,
  env: NodeJS.ProcessEnv = process.env
): DbTarget {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error(
      "Could not parse the database connection string. Expected a postgres:// URL."
    );
  }

  const host = parsed.hostname;
  const port = parsed.port || "5432";
  const database = parsed.pathname.replace(/^\//, "") || "postgres";
  const projectRef = extractProjectRef(host);

  /*
   * Two independent checks, because the structured one only understands the
   * URL shapes Neon uses today. The raw substring sweep catches a production
   * identifier arriving in any other form — a direct IP with the endpoint in
   * the database name, a proxied host, a shape Neon adds later.
   */
  const isProduction = PRODUCTION_DB_REFS.some(
    (ref) => ref === projectRef || connectionString.includes(ref)
  );

  const isLocal = LOCAL_HOSTS.has(host);
  const devRefs = devRefsFromEnv(env);
  const isKnownDev =
    !isProduction && (isLocal || (!!projectRef && devRefs.includes(projectRef)));

  return {
    host,
    port,
    database,
    projectRef,
    isLocal,
    isProduction,
    isKnownDev,
    label: `${host}:${port}/${database}${projectRef ? ` (ref ${projectRef})` : ""}`,
  };
}

/**
 * Refuse outright if the target is production.
 *
 * Use on anything that must never reach production regardless of who is
 * running it — `pnpm dev`, the mirror's restore leg, the seed scripts.
 */
export function assertNotProductionDatabase(
  connectionString: string,
  action: string,
  env: NodeJS.ProcessEnv = process.env
): DbTarget {
  const target = describeDatabase(connectionString, env);

  if (target.isProduction) {
    throw new Error(
      [
        `Refusing to ${action}: that connection string points at PRODUCTION.`,
        `  target: ${target.label}`,
        "",
        "Point POSTGRES_URL at your development database instead.",
        "  local:  postgresql://postgres@localhost:5432/expeditoo_dev",
        "  mirror: pnpm db:mirror",
        "",
        "See docs/specs/environments_spec.md.",
      ].join("\n")
    );
  }

  return target;
}

/**
 * Refuse unless the target is a *recognised* development database.
 *
 * Stricter than `assertNotProductionDatabase` and fail-closed: a remote host
 * nobody has allow-listed in `DEV_DB_REFS` is refused, so a stale or
 * copy-pasted URL cannot quietly become the thing a destructive script
 * rewrites.
 */
export function assertDevelopmentDatabase(
  connectionString: string,
  action: string,
  env: NodeJS.ProcessEnv = process.env
): DbTarget {
  const target = assertNotProductionDatabase(connectionString, action, env);

  if (!target.isKnownDev) {
    throw new Error(
      [
        `Refusing to ${action}: "${target.label}" is not a recognised development database.`,
        "",
        "Allowed targets are localhost, or a Neon endpoint id listed in DEV_DB_REFS.",
        "If this really is a development database, add its ref:",
        `  DEV_DB_REFS=${target.projectRef ?? "<endpoint-id>"}`,
        "",
        "See docs/specs/environments_spec.md.",
      ].join("\n")
    );
  }

  return target;
}
