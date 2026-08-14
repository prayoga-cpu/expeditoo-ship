/**
 * MOCK_PAYMENTS - a testing-only switch that short-circuits every Stripe call
 * in the payments service so the money chain (accept → deliver → capture →
 * payout) can be exercised end to end without a confirmable PaymentIntent.
 *
 * This is the single place the flag is read. Synthetic intent ids carry the
 * prefix so a hold created while the flag was on is still recognised after
 * the flag is turned off.
 */

// TODO(EXPEDITOO-TESTING): MOCK_PAYMENTS — replace with SetupIntent confirmation + amount_capturable_updated webhook handling (see docs/TESTING_MOCKS.md).
export const MOCK_INTENT_PREFIX = "pi_mock_";

/** Read at call time, never at import time, so tests can flip the flag. */
export const isMockPaymentsEnabled = () =>
  process.env.MOCK_PAYMENTS === "true";

/** A payment holds a mock intent when the flag is on or the id says so. */
export const isMockIntent = (intentId: string) =>
  isMockPaymentsEnabled() || intentId.startsWith(MOCK_INTENT_PREFIX);
