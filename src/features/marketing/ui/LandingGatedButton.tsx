"use client";

import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useGatedAction, type GatedPhase } from "../hooks/useGatedAction";
import type { LandingIntent } from "@/lib/landing-intent";

/**
 * The visible half of a gated action, split out so the bid card — which has to
 * validate before it may start the flow — shows exactly the same three frames
 * as a plain button. `docs/specs/landing_gated_actions_spec.md` §3.
 *
 * The label is a plain span and the *button* carries `aria-live`, rather than
 * the label carrying `role="status"`: a live-region role on a descendant is
 * skipped by name-from-content, which left the button with no accessible name
 * at all — confirmed in Chromium, and invisible to jsdom.
 */
export function GatedButtonContent({
  phase,
  intent,
  idleLabel,
  compact = false,
}: {
  phase: GatedPhase;
  intent: LandingIntent;
  idleLabel: string;
  /** Board rows are too narrow for a sentence, so they show icons only. */
  compact?: boolean;
}) {
  const t = useTranslations("marketing.actions");

  const running = phase !== "idle";
  const done = running && phase !== "validating";
  const label = running
    ? t(done ? `${intent}.success` : `${intent}.validating`)
    : idleLabel;

  return (
    <span className="inline-flex items-center justify-center gap-2">
      {running &&
        (done ? (
          <Check className="animate-lp-pop h-[18px] w-[18px]" aria-hidden />
        ) : (
          <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
        ))}
      <span className={running && compact ? "sr-only" : undefined}>
        {label}
      </span>
    </span>
  );
}

export interface LandingGatedButtonProps {
  intent: LandingIntent;
  /** Job reference carried through to the auth page, where there is one. */
  reference?: string;
  label: string;
  className?: string;
  compact?: boolean;
}

/**
 * A landing CTA that acknowledges the press, then routes the visitor to
 * whichever door is theirs — the app, login, or signup.
 */
export function LandingGatedButton({
  intent,
  reference,
  label,
  className,
  compact = false,
}: LandingGatedButtonProps) {
  const { phase, start, isBusy, isSessionLoading } = useGatedAction({
    intent,
    reference,
  });

  return (
    <button
      type="button"
      onClick={start}
      disabled={isBusy || isSessionLoading}
      aria-busy={isBusy}
      aria-live="polite"
      className={`cursor-pointer disabled:cursor-default ${className ?? ""}`}
    >
      <GatedButtonContent
        phase={phase}
        intent={intent}
        idleLabel={label}
        compact={compact}
      />
    </button>
  );
}
