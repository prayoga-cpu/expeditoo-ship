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
  apiVersion: "2024-12-18.acacia", // Updated to latest stable or use exact version from package
  typescript: true,
});
