/**
 * Which deployment this process is.
 *
 * `NODE_ENV` cannot answer this on its own: `next build` sets it to
 * "production" on a laptop, and every Vercel Preview deploy runs with it set
 * too. Both of those must be treated as *not* production when we are deciding
 * whether a process may touch the production database or send a real email.
 */
export type AppEnv = "local" | "preview" | "production";

const APP_ENVS: readonly AppEnv[] = ["local", "preview", "production"];

function isAppEnv(value: string | undefined): value is AppEnv {
  return !!value && (APP_ENVS as readonly string[]).includes(value);
}

/**
 * The four variables `resolveAppEnv` reads, each spelled out as a literal
 * `process.env.X`.
 *
 * That spelling is the whole point. A bundler substitutes the literal token
 * `process.env.NEXT_PUBLIC_APP_ENV`; it does not substitute `env.NEXT_PUBLIC_APP_ENV`
 * on a parameter that merely happens to default to `process.env`. Passing
 * `process.env` straight in therefore worked on the server and failed silently
 * in the browser, where `process.env` carries nothing: every client bundle fell
 * through to "local", so a production page subscribed to
 * `local:user:<id>:stream` while its Ably token granted `user:<id>:*`, and the
 * channel was refused with 40160.
 *
 * `APP_ENV`, `VERCEL` and `VERCEL_ENV` resolve to undefined in the browser,
 * which is correct: `NEXT_PUBLIC_APP_ENV` is the only one it can know, and
 * next.config.mjs injects it precisely so it agrees with the server.
 */
export interface AppEnvSource {
  NEXT_PUBLIC_APP_ENV?: string;
  APP_ENV?: string;
  VERCEL?: string;
  VERCEL_ENV?: string;
}

function processEnvSnapshot(): AppEnvSource {
  return {
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    APP_ENV: process.env.APP_ENV,
    VERCEL: process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  };
}

/**
 * Resolve the environment from the process env.
 *
 * Order matters:
 *  1. `NEXT_PUBLIC_APP_ENV` wins when present. It only exists because
 *     `next.config.mjs` computes it with this same function and injects it
 *     into both the server and the browser bundle — it is how a client
 *     component (e.g. an Ably channel name) ends up agreeing with the server
 *     on which environment it is in, since `APP_ENV`/`VERCEL_ENV` are not
 *     visible in the browser at all.
 *  2. An explicit `APP_ENV` wins next, so a standalone script (migrations,
 *     seeds) that never goes through Next can still pin itself.
 *  3. Off Vercel we are always "local" — a local `next build` or a `tsx`
 *     script is never production, whatever `NODE_ENV` says.
 *  4. On Vercel, `VERCEL_ENV` is authoritative and distinguishes the three
 *     scopes the CLI also uses (production / preview / development).
 */
export function resolveAppEnv(
  env: AppEnvSource = processEnvSnapshot()
): AppEnv {
  if (isAppEnv(env.NEXT_PUBLIC_APP_ENV)) return env.NEXT_PUBLIC_APP_ENV;
  if (isAppEnv(env.APP_ENV)) return env.APP_ENV;

  if (!env.VERCEL) return "local";

  switch (env.VERCEL_ENV) {
    case "production":
      return "production";
    case "preview":
      return "preview";
    default:
      return "local";
  }
}

export const APP_ENV: AppEnv = resolveAppEnv();

export const isProductionEnv = APP_ENV === "production";
export const isPreviewEnv = APP_ENV === "preview";
export const isLocalEnv = APP_ENV === "local";

/**
 * Short suffix for anything shared by name across environments — Ably
 * channels, R2 key prefixes, log lines. Production is unsuffixed so existing
 * production data keeps the names it already has.
 */
export function envTag(appEnv: AppEnv = APP_ENV): string {
  return appEnv === "production" ? "" : appEnv;
}

/**
 * Namespace a shared identifier so a non-production process can never collide
 * with production. Returns `name` unchanged in production.
 */
export function namespaced(name: string, appEnv: AppEnv = APP_ENV): string {
  const tag = envTag(appEnv);
  return tag ? `${tag}:${name}` : name;
}
