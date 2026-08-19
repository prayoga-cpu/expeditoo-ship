import { describeDatabase } from "@/lib/db-target";
import { APP_ENV, isProductionEnv } from "@/lib/env";

/**
 * Boot-time checks that catch a misconfigured environment before it does
 * damage, rather than after. Run once, from `src/instrumentation.ts`, so
 * every server start — `next dev`, `next start`, a Vercel deployment — is
 * covered without each API route remembering to call this itself.
 *
 * These are `throw`, not `console.warn`: the failure mode being guarded
 * against (mock payments live, a preview deployment holding a real Stripe
 * key, production quietly pointed at an empty database) is worse than a
 * crashed boot.
 */
export function assertEnvironmentIsSane(): void {
  assertPaymentsConfig();
  assertDatabaseTarget();
}

function assertPaymentsConfig(): void {
  if (isProductionEnv && process.env.MOCK_PAYMENTS === "true") {
    throw new Error(
      "MOCK_PAYMENTS=true in production. This flag skips Stripe entirely — " +
        "see docs/TESTING_MOCKS.md. Unset it in the Vercel Production environment."
    );
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return; // src/lib/stripe/index.ts already warns on this.

  const isLiveKey = stripeKey.startsWith("sk_live_");
  const isTestKey = stripeKey.startsWith("sk_test_");

  if (isProductionEnv && !isLiveKey) {
    throw new Error(
      `STRIPE_SECRET_KEY in production is not a live key (starts with ` +
        `"${stripeKey.slice(0, 8)}..."). Set the Production STRIPE_SECRET_KEY ` +
        "in Vercel to a sk_live_ key."
    );
  }

  if (!isProductionEnv && isLiveKey) {
    throw new Error(
      `STRIPE_SECRET_KEY in a "${APP_ENV}" environment is a LIVE key. ` +
        "That means real charges. Use a sk_test_ key outside production."
    );
  }

  if (!isProductionEnv && !isTestKey) {
    // Some other shape (e.g. a restricted key) — not necessarily wrong, but
    // worth knowing rather than assuming.
    console.warn(
      `[env] STRIPE_SECRET_KEY in "${APP_ENV}" is neither sk_test_ nor sk_live_ — ` +
        "double-check it is the intended key."
    );
  }
}

/**
 * `src/db/index.ts` already refuses a non-production process that points at
 * production — that covers local dev and preview. The gap it cannot cover is
 * the opposite direction: production itself pointed at the wrong database,
 * which its own guard treats as a no-op by design. This closes that gap.
 */
function assertDatabaseTarget(): void {
  if (!isProductionEnv) return;

  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) return; // src/db/index.ts already throws on this.

  const target = describeDatabase(connectionString);
  if (!target.isProduction) {
    throw new Error(
      `This is the production deployment but POSTGRES_URL points at ` +
        `"${target.label}", not production. Fix the Production environment ` +
        "variable in Vercel before this serves traffic."
    );
  }
}
