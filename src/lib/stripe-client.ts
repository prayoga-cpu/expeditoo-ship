import { loadStripe } from "@stripe/stripe-js";

export const getStripe = () => {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    console.error("Stripe publishable key is missing");
    return null;
  }
  return loadStripe(key);
};
