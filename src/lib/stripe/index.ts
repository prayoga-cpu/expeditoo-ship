import Stripe from "stripe";

// Ensure the secret key is defined in environment variables
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY as string;

if (!STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY is missing. Stripe features will fail.");
}

/**
 * Stripe Server-Side Instance
 * Using API version compatible with the installed SDK.
 */
export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  // Left unset so the SDK uses the version it was built against; pinning a
  // string here drifts out of sync with the installed package.
  typescript: true,
});
