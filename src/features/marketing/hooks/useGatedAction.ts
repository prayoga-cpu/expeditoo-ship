"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { isReturningVisitor } from "@/lib/returning-visitor";
import {
  resolveLandingDestination,
  type LandingIntent,
} from "@/lib/landing-intent";

/**
 * The one flow every gated element on the landing page runs:
 * `idle → validating → success → redirecting`.
 *
 * The two beats are visual. Nothing is written server-side — there is no
 * listing to bid on and no carrier to create until the visitor has an account —
 * so what the flow really does is acknowledge the press before moving the page.
 * `docs/specs/landing_gated_actions_spec.md` §3.
 */

export type GatedPhase = "idle" | "validating" | "success" | "redirecting";

const VALIDATING_MS = 650;
const SUCCESS_MS = 900;
/** Reduced motion keeps the phases, just stops dwelling on them. */
const REDUCED_SUCCESS_MS = 250;

/** Guarded by hand: jsdom has no `matchMedia`, and neither does the server. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

export interface UseGatedActionOptions {
  intent: LandingIntent;
  /** Job reference to carry through to the auth page, when there is one. */
  reference?: string;
}

export function useGatedAction({ intent, reference }: UseGatedActionOptions) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const reducedMotion = usePrefersReducedMotion();
  const [phase, setPhase] = useState<GatedPhase>("idle");

  // Storage only exists on the client, so the first render assumes a
  // first-time visitor and the mount corrects it — long before anything here
  // can be pressed.
  const [isReturning, setIsReturning] = useState(false);
  useEffect(() => setIsReturning(isReturningVisitor()), []);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const destination = resolveLandingDestination(
    intent,
    { isAuthenticated, isReturning },
    reference
  );

  const start = useCallback(() => {
    // Inert until the session is known: nobody should be told to sign up and
    // then bounced into the app a beat later.
    if (phase !== "idle" || isLoading) return;

    setPhase("validating");

    const validatingMs = reducedMotion ? 0 : VALIDATING_MS;
    const successMs = reducedMotion ? REDUCED_SUCCESS_MS : SUCCESS_MS;

    timers.current.push(setTimeout(() => setPhase("success"), validatingMs));
    timers.current.push(
      setTimeout(() => {
        setPhase("redirecting");
        router.push(destination);
      }, validatingMs + successMs)
    );
  }, [phase, isLoading, reducedMotion, router, destination]);

  return {
    phase,
    start,
    destination,
    isAuthenticated,
    isSessionLoading: isLoading,
    isBusy: phase !== "idle",
  };
}
