/**
 * Audit the Vercel environment variables by name and scope.
 *
 *   VERCEL_TOKEN=… pnpm env:audit
 *
 * Reads key names and targets only — the request never asks for values, and
 * nothing here prints one. Exits non-zero when a key that must differ between
 * Production and Preview is stored as a single shared value; a missing key is
 * reported but does not fail, because a scope may be half-built on purpose.
 *
 * Runs from `.github/workflows/env-audit.yml`. Rules: `src/lib/env-audit.ts`.
 */
import { auditEnv, type VercelEnvRow } from "../src/lib/env-audit";

// Identifiers, not secrets: they appear in every dashboard URL.
const PROJECT_ID = process.env.VERCEL_PROJECT_ID ?? "prj_emKQW315osEjMs522hSMEWz3eyvc";
const TEAM_ID = process.env.VERCEL_ORG_ID ?? "team_40PBrj63RhVgsHLIEXvDNYjb";

async function main() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    console.error(
      "❌ VERCEL_TOKEN is not set. Create one at vercel.com/account/tokens " +
        "(scope: the team) and export it, or add it as a repo secret."
    );
    process.exit(1);
  }

  const response = await fetch(
    `https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) {
    console.error(`❌ Vercel answered HTTP ${response.status}.`);
    process.exit(1);
  }

  const body = (await response.json()) as { envs?: VercelEnvRow[] };
  const audit = auditEnv(body.envs ?? []);

  for (const scope of ["production", "preview"] as const) {
    if (audit.missing[scope].length > 0) {
      console.warn(`⚠️  Missing from ${scope}: ${audit.missing[scope].join(", ")}`);
    }
  }

  if (audit.shared.length > 0) {
    console.error(
      "❌ Stored as ONE value for Production and Preview — a preview or dev " +
        `deployment holds production's: ${audit.shared.join(", ")}`
    );
    console.error("   Fix: docs/specs/environments_spec.md §8.");
    process.exit(1);
  }

  console.log("✅ No production value is shared with Preview.");
}

main();
