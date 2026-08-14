"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

const START_SECONDS = 252;
const OPENING_BID = 196;
const OPENING_COUNT = 3;

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

/** Local state for the demo auction: an offer only lands if it undercuts. */
function useDemoBid() {
  const [best, setBest] = useState(OPENING_BID);
  const [count, setCount] = useState(OPENING_COUNT);
  const [leading, setLeading] = useState(false);
  const [rejected, setRejected] = useState(false);
  const rejectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (rejectTimer.current) clearTimeout(rejectTimer.current);
    },
    []
  );

  function submit(raw: string) {
    const value = parseFloat(raw.replace(",", "."));
    if (!value || value >= best) {
      setRejected(true);
      if (rejectTimer.current) clearTimeout(rejectTimer.current);
      rejectTimer.current = setTimeout(() => setRejected(false), 900);
      return false;
    }
    setBest(Math.round(value));
    setCount((c) => c + 1);
    setLeading(true);
    return true;
  }

  return { best, count, leading, rejected, submit };
}

export function LandingBidCard() {
  const t = useTranslations("marketing.bidCard");
  const clock = useCountdown();
  const { best, count, leading, rejected, submit } = useDemoBid();
  const [draft, setDraft] = useState("");

  function handleSubmit() {
    if (submit(draft)) setDraft("");
  }

  return (
    <div className="flex flex-col gap-4 rounded-[20px] border border-[var(--lp-line)] bg-[var(--lp-bg2)] p-[22px] shadow-[var(--lp-shadow)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] tracking-[0.12em] text-[var(--lp-dim)]">
          COURSE EX-2481
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
          <span className="font-mono text-[30px] font-medium tracking-[-0.02em]">
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
        <div className="flex items-center gap-2 rounded-[10px] border border-[var(--lp-greenbg)] bg-[var(--lp-greenbg)] px-3.5 py-2.5">
          <span className="h-[7px] w-[7px] rounded-full bg-[var(--lp-green)]" />
          <span className="text-[13.5px] font-medium text-[var(--lp-green)]">
            {t("leading")}
          </span>
        </div>
      )}

      <div className="flex gap-2.5">
        <input
          type="text"
          inputMode="numeric"
          placeholder="189"
          aria-label={t("bidInputLabel")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className={`box-border w-[110px] min-w-0 rounded-[11px] border bg-[var(--lp-input)] px-3.5 py-3 font-mono text-base text-[var(--lp-text)] outline-none ${
            rejected
              ? "border-[var(--lp-red)]"
              : "border-[var(--lp-line2)] focus:border-[#0052FF]"
          }`}
        />
        <button
          type="button"
          onClick={handleSubmit}
          className="flex-1 cursor-pointer rounded-[11px] border-0 bg-[#0052FF] px-[18px] py-3 text-[15px] font-medium text-white transition-colors hover:bg-[#1F63FF]"
        >
          {t("bidCta")}
        </button>
      </div>

      <span className="font-mono text-[10.5px] tracking-[0.1em] text-[var(--lp-faint)]">
        {t("insured")}
      </span>
    </div>
  );
}
