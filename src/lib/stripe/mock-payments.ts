/**
 * MOCK_PAYMENTS - a testing-only switch that short-circuits every Stripe call
 * in the payments service so the money chain (accept → deliver → capture →
 * payout) can be exercised end to end without a confirmable PaymentIntent.
 *
 * This is the single place the flag is read. The flag decides only whether a
 * NEW hold is synthetic; whether an EXISTING one is synthetic is decided by
 * its id alone (`isMockIntent`), so turning the flag on can never reclassify
 * a real PaymentIntent.
 */

// TODO(EXPEDITOO-TESTING): MOCK_PAYMENTS — the prefix is the sole marker of a synthetic hold; replace the whole mock path with SetupIntent confirmation + amount_capturable_updated webhook handling (see docs/TESTING_MOCKS.md).
export const MOCK_INTENT_PREFIX = "pi_mock_";

/** Read at call time, never at import time, so tests can flip the flag. */
export const isMockPaymentsEnabled = () =>
  process.env.MOCK_PAYMENTS === "true";

/**
 * Whether an intent is synthetic — decided by the id alone, never by the flag.
 *
 * The invariant: only an id this module minted is a mock. A real Stripe
 * `pi_...` stays real even while MOCK_PAYMENTS is on, so it is captured at
 * Stripe rather than silently marked captured; and a `pi_mock_...` hold stays
 * recognisable after the flag is turned off.
 */
export const isMockIntent = (intentId: string) =>
  intentId.startsWith(MOCK_INTENT_PREFIX);
