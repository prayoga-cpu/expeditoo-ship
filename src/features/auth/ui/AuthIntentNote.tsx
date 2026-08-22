"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { isJobReference, isLandingIntent } from "@/lib/landing-intent";

/**
 * Says out loud what the visitor was doing when the landing page sent them
 * here. Without it the intent carried in the query is invisible and the trip
 * from a bid button to a login form looks like the page losing their place.
 *
 * `docs/specs/landing_gated_actions_spec.md` §8.
 */
export function AuthIntentNote() {
  const searchParams = useSearchParams();
  const t = useTranslations("auth.intent");

  const intent = searchParams.get("intent");
  if (!isLandingIntent(intent)) return null;

  // A `ref` that is not a job reference is dropped rather than shown: the
  // generic line still tells the visitor why they are here.
  const reference = searchParams.get("ref");
  const message =
    intent === "bid" && isJobReference(reference)
      ? t("bidWithRef", { ref: reference })
      : t(intent);

  return (
    <div className="mb-4 rounded-lg border border-primary/20 bg-primary/10 p-3">
      <p className="text-sm text-foreground">{message}</p>
    </div>
  );
}
