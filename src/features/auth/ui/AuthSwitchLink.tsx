"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { isJobReference, isLandingIntent } from "@/lib/landing-intent";

/**
 * Keeps `intent` and `ref` when someone hops between login and signup.
 * Anything else in the query — `verified=true`, say — belongs to the page it
 * is on and is dropped.
 */
export function carriedIntentQuery(params: URLSearchParams): string {
  const intent = params.get("intent");
  if (!isLandingIntent(intent)) return "";

  const carried = new URLSearchParams({ intent });
  const reference = params.get("ref");
  if (isJobReference(reference)) carried.set("ref", reference);

  return `?${carried.toString()}`;
}

/** The "Don't have an account? Sign up" line, minus the amnesia. */
export function AuthSwitchLink({
  to,
  prompt,
  action,
}: {
  to: "/signin" | "/signup";
  prompt: string;
  action: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <p className="text-center text-muted-foreground mt-6">
      {prompt}{" "}
      <button
        type="button"
        onClick={() => router.push(`${to}${carriedIntentQuery(searchParams)}`)}
        className="text-primary hover:text-primary/80 font-semibold"
      >
        {action}
      </button>
    </p>
  );
}
