/**
 * What is wrong with the Vercel environment variables, read from their names
 * and scopes alone — never their values.
 *
 * The check that matters is `shared`: a variable stored as ONE value for both
 * Production and Preview. For the keys in `MUST_DIFFER` that means a preview
 * or dev deployment is holding production's database, bucket, signing secret
 * or API key. On 2026-11-20 five of them were shared, and nothing anywhere
 * said so. See docs/specs/environments_spec.md §8.
 */

/** Keys whose Production value must never also be the Preview value. */
export const MUST_DIFFER: readonly string[] = [
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
  "BETTER_AUTH_SECRET",
  "CRON_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "R2_BUCKET_NAME",
  "R2_KYC_BUCKET_NAME",
  "R2_EXPEDION_BUCKET_NAME",
  "R2_SHIPMENT_BUCKET_NAME",
  "R2_PUBLIC_URL",
  "EXPEDION_API_KEY",
  "EXPEDION_ADMIN_API_KEY",
];

/** Keys a deployment cannot do without, so their absence is worth a line. */
export const REQUIRED: readonly string[] = [
  "POSTGRES_URL",
  "BETTER_AUTH_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "R2_BUCKET_NAME",
  "CRON_SECRET",
];

export type Scope = "production" | "preview";

export interface VercelEnvRow {
  key: string;
  target?: string[] | string | null;
}

export interface EnvAudit {
  /** `MUST_DIFFER` keys stored as one value for Production and Preview. */
  shared: string[];
  /** `REQUIRED` keys absent from a scope. */
  missing: Record<Scope, string[]>;
}

function targetsOf(row: VercelEnvRow): string[] {
  if (!row.target) return [];
  return Array.isArray(row.target) ? row.target : [row.target];
}

export function auditEnv(rows: VercelEnvRow[]): EnvAudit {
  const shared = new Set<string>();
  const present: Record<Scope, Set<string>> = {
    production: new Set(),
    preview: new Set(),
  };

  for (const row of rows) {
    const targets = targetsOf(row);
    const inProduction = targets.includes("production");
    const inPreview = targets.includes("preview");

    if (inProduction) present.production.add(row.key);
    if (inPreview) present.preview.add(row.key);
    if (inProduction && inPreview && MUST_DIFFER.includes(row.key)) {
      shared.add(row.key);
    }
  }

  const missingFrom = (scope: Scope) =>
    REQUIRED.filter((key) => !present[scope].has(key));

  return {
    shared: [...shared].sort(),
    missing: {
      production: missingFrom("production"),
      preview: missingFrom("preview"),
    },
  };
}
