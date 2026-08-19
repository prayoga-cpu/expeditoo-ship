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
 * Supabase project refs that are production.
 *
 * Hardcoded on purpose. Reading this from the environment would mean a missing
 * variable silently disables the guard, which is the one failure mode that
 * matters. The ref is not a secret — it is already public in
 * `NEXT_PUBLIC_SUPABASE_URL`.
 */
export const PRODUCTION_DB_REFS: readonly string[] = ["nobjujwfmqlserxuryvf"];

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

export interface DbTarget {
  host: string;
  port: string;
  database: string;
  /** Supabase project ref, when the URL points at Supabase. */
  projectRef: string | null;
  isLocal: boolean;
  isProduction: boolean;
  /** Explicitly allow-listed as a development target. */
  isKnownDev: boolean;
  /** Safe to print and log — never carries the password. */
  label: string;
}

/**
 * Pull the Supabase project ref out of either URL shape Supabase hands out:
 * the session/direct URL `db.<ref>.supabase.co`, and the pooler URL where the
 * ref rides in the username as `postgres.<ref>`.
 */
function extractProjectRef(host: string, username: string): string | null {
  const directMatch = /^db\.([a-z0-9]+)\.supabase\.(co|com)$/i.exec(host);
  if (directMatch) return directMatch[1];

  if (host.endsWith("pooler.supabase.com")) {
    const [, ref] = username.split(".");
    if (ref) return ref;
  }

  return null;
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
  const projectRef = extractProjectRef(host, decodeURIComponent(parsed.username));

  /*
   * Two independent checks, because the structured one only understands the
   * URL shapes Supabase uses today. The raw sweep catches a production ref
   * arriving in any other form — a direct IP with the ref in the database
   * name, a proxied host, a shape Supabase adds later.
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
        "Allowed targets are localhost, or a Supabase project ref listed in DEV_DB_REFS.",
        "If this really is a development database, add its ref:",
        `  DEV_DB_REFS=${target.projectRef ?? "<project-ref>"}`,
        "",
        "See docs/specs/environments_spec.md.",
      ].join("\n")
    );
  }

  return target;
}
