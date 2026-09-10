import { api } from "@/lib/fetcher";

/**
 * Stripe Connect onboarding, from the browser's side.
 *
 * Its own module because the payout button used to call `fetch` inline and
 * read the envelope by hand (docs/rules.md §3.6). That is how it came to be
 * silent on failure: an inline handler that only looked for a `url` had no
 * branch left when there was not one, so Stripe refusing the request and the
 * button doing nothing were indistinguishable. Going through `api` means a
 * refusal arrives as an `ApiError` carrying the server's `code`, which the
 * caller has to handle.
 */
export const payoutApi = {
  /** The hosted onboarding URL to send the browser to. */
  startOnboarding: () =>
    api.post<{ url: string }>("/api/stripe/connect"),
};
