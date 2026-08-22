"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useGatedAction } from "../hooks/useGatedAction";
import { GatedButtonContent } from "./LandingGatedButton";

const START_SECONDS = 252;
const OPENING_BID = 196;
const OPENING_COUNT = 3;
const JOB_REF = "EX-2481";
/** Below this the demo stops being a demo of anything. */
const MIN_BID = 50;

type BidError = "errorInvalid" | "errorTooLow" | "errorTooHigh";

function formatClock(total: number) {
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function useCountdown() {
  const [seconds, setSeconds] = useState(START_SECONDS);

  useEffect(() => {
    const timer = setInterval(
      () => setSeconds((s) => (s > 0 ? s - 1 : START_SECONDS)),
      1000
    );
    return () => clearInterval(timer);
  }, []);

  return formatClock(seconds);
}

/**
 * Local state for the demo auction. An offer only lands if it parses, clears
 * the floor and undercuts the standing best — the same three rules the real
 * board applies, minus the listing.
 * `docs/specs/landing_gated_actions_spec.md` §4.
 */
function useDemoBid() {
  const [best, setBest] = useState(OPENING_BID);
  const [count, setCount] = useState(OPENING_COUNT);
  const [leading, setLeading] = useState(false);
  const [error, setError] = useState<BidError | null>(null);
  const [shaking, setShaking] = useState(false);

  /** Two frames off, then on, so a repeated rejection replays the shake. */
  function shake() {
    setShaking(false);
    if (typeof requestAnimationFrame !== "function") return;
    requestAnimationFrame(() => requestAnimationFrame(() => setShaking(true)));
  }

  function reject(code: BidError) {
    setError(code);
    shake();
    return false;
  }

  function submit(raw: string) {
    const value = Number.parseFloat(raw.replace(",", "."));

    if (!Number.isFinite(value)) return reject("errorInvalid");
    if (value < MIN_BID) return reject("errorTooLow");
    if (value >= best) return reject("errorTooHigh");

    setError(null);
    // Floor, not round: 195.6 against a standing 196 would round back up to
    // 196 and the card would claim the lead at a price that never undercut.
    setBest(Math.floor(value));
    setCount((c) => c + 1);
    setLeading(true);
    return true;
  }

  return { best, count, leading, error, shaking, submit, clearError: () => setError(null) };
}

export function LandingBidCard() {
  const t = useTranslations("marketing.bidCard");
  const clock = useCountdown();
  const { best, count, leading, error, shaking, submit, clearError } =
    useDemoBid();
  const [draft, setDraft] = useState("");
  const { phase, start, isBusy, isSessionLoading } = useGatedAction({
    intent: "bid",
    reference: JOB_REF,
  });

  function handleSubmit() {
    // `start()` refuses while the session is unknown, so without this the
    // Enter key would consume the offer — best price moved, count raised — and
    // then go nowhere.
    if (isBusy || isSessionLoading) return;
    if (submit(draft)) {
      setDraft("");
      start();
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-[20px] border border-[var(--lp-line)] bg-[var(--lp-bg2)] p-[22px] shadow-[var(--lp-shadow)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] tracking-[0.12em] text-[var(--lp-dim)]">
          COURSE {JOB_REF}
        </span>
        <span className="rounded-md border border-[rgba(255,169,31,0.3)] bg-[rgba(255,169,31,0.12)] px-2 py-1 font-mono text-[10px] tracking-[0.1em] text-[var(--lp-ambertext)]">
          {t("fromExpedion")}
        </span>
        <span className="ml-auto inline-flex items-center gap-[7px] rounded-full bg-[rgba(0,82,255,0.14)] px-2.5 py-[5px] font-mono text-[11px] text-[var(--lp-bluetext)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#3D7BFF]" />
          <span>
            {t("closes")}&nbsp;{clock}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[19px] font-semibold tracking-[-0.01em]">
          {t("item")}
        </span>
        <span className="text-[13.5px] text-[var(--lp-muted)]">
          Drouot, Paris 9e → 33000 Bordeaux · 480 km
        </span>
        <span className="text-[13px] text-[var(--lp-dim)]">{t("details")}</span>
      </div>

      <div className="h-px bg-[var(--lp-line)]" />

      <div className="flex items-center justify-between gap-3.5">
        <div className="flex flex-col gap-[3px]">
          <span className="text-[12.5px] text-[var(--lp-muted)]">
            {leading ? t("yourOffer") : t("bestOffer")}
          </span>
          <span
            key={best}
            className="animate-lp-tick font-mono text-[30px] font-medium tracking-[-0.02em]"
          >
            {best} €
          </span>
        </div>
        <div className="flex flex-col gap-[3px] text-right">
          <span className="text-[12.5px] text-[var(--lp-muted)]">
            {t("offers")}
          </span>
          <span className="font-mono text-[30px] font-medium tracking-[-0.02em]">
            {count}
          </span>
        </div>
      </div>

      {leading && (
        <div className="animate-lp-pop flex items-center gap-2 rounded-[10px] border border-[var(--lp-greenbg)] bg-[var(--lp-greenbg)] px-3.5 py-2.5">
          <span className="h-[7px] w-[7px] rounded-full bg-[var(--lp-green)]" />
          <span className="text-[13.5px] font-medium text-[var(--lp-green)]">
            {t("leading")}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex gap-2.5">
          <input
            type="text"
            inputMode="numeric"
            placeholder="189"
            aria-label={t("bidInputLabel")}
            aria-invalid={!!error}
            aria-describedby={error ? "lp-bid-error" : undefined}
            value={draft}
            disabled={isBusy}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) clearError();
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className={`box-border w-[110px] min-w-0 rounded-[11px] border bg-[var(--lp-input)] px-3.5 py-3 font-mono text-base text-[var(--lp-text)] outline-none disabled:opacity-60 ${
              error
                ? "border-[var(--lp-red)]"
                : "border-[var(--lp-line2)] focus:border-[#0052FF]"
            } ${shaking ? "animate-lp-shake" : ""}`}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isBusy || isSessionLoading}
            aria-busy={isBusy}
            aria-live="polite"
            className="flex-1 cursor-pointer rounded-[11px] border-0 bg-[#0052FF] px-[18px] py-3 text-[15px] font-medium text-white transition-colors hover:bg-[#1F63FF] disabled:cursor-default disabled:opacity-90"
          >
            <GatedButtonContent
              phase={phase}
              intent="bid"
              idleLabel={t("bidCta")}
            />
          </button>
        </div>

        {error && (
          <span
            id="lp-bid-error"
            role="alert"
            className="text-[13px] text-[var(--lp-red)]"
          >
            {t(error, { min: MIN_BID, best })}
          </span>
        )}
      </div>

      <span className="font-mono text-[10.5px] tracking-[0.1em] text-[var(--lp-faint)]">
        {t("insured")}
      </span>
    </div>
  );
}
