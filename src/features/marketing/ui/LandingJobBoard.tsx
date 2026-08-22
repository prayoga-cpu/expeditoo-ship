"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LandingGatedButton } from "./LandingGatedButton";
import { LP_CONTAINER, LP_EYEBROW, LP_H2, LP_SECTION } from "./styles";

const JOBS = [
  { key: "one", ref: "EX-2481", route: "Paris 9e → Bordeaux", best: 196, time: "04:12" },
  { key: "two", ref: "EX-2477", route: "Lyon → Toulouse", best: 120, time: "01:45" },
  { key: "three", ref: "EX-2490", route: "Rouen → Paris 16e", best: 85, time: "09:00" },
] as const;

type Job = (typeof JOBS)[number];

const ROW =
  "grid grid-cols-1 items-center gap-x-[18px] gap-y-3 rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-bg2)] px-6 py-5 lg:grid-cols-[1.5fr_1.1fr_0.9fr_0.8fr_auto]";

/** Each row keeps its own cadence, so the board never moves in lockstep. */
const UNDERCUT_INTERVAL_MS = [11_000, 13_000, 17_000] as const;
const UNDERCUT_STEP = 3;
/** How far a row is allowed to be walked down before it reopens at its seed. */
const FLOOR_RATIO = 0.6;

function toSeconds(clock: string) {
  const [minutes, seconds] = clock.split(":").map(Number);
  return minutes * 60 + seconds;
}

function formatClock(total: number) {
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * The board is illustrative, but a still board contradicts the "live auctions"
 * claim two sections down. Both tickers start in an effect and step by fixed
 * amounts, so the first paint matches the server render and nothing here is
 * random. `docs/specs/landing_gated_actions_spec.md` §5.
 */
function useLiveRow(job: Job, index: number) {
  const seedSeconds = toSeconds(job.time);
  const [seconds, setSeconds] = useState(seedSeconds);
  const [best, setBest] = useState<number>(job.best);

  useEffect(() => {
    const timer = setInterval(
      () => setSeconds((s) => (s > 0 ? s - 1 : seedSeconds)),
      1000
    );
    return () => clearInterval(timer);
  }, [seedSeconds]);

  useEffect(() => {
    const floor = Math.round(job.best * FLOOR_RATIO);
    const timer = setInterval(
      () =>
        setBest((current) =>
          current - UNDERCUT_STEP <= floor ? job.best : current - UNDERCUT_STEP
        ),
      UNDERCUT_INTERVAL_MS[index] ?? UNDERCUT_INTERVAL_MS[0]
    );
    return () => clearInterval(timer);
  }, [job.best, index]);

  return { clock: formatClock(seconds), best };
}

function JobRow({ job, index }: { job: Job; index: number }) {
  const t = useTranslations("marketing.jobBoard");
  const { clock, best } = useLiveRow(job, index);

  return (
    <div className={ROW}>
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className="text-[15.5px] font-semibold">
          {t(`jobs.${job.key}`)}
        </span>
        <span className="font-mono text-[11px] text-[var(--lp-dim)]">
          {job.ref} · <span className="text-[var(--lp-ambertext)]">EXPEDION</span>
        </span>
      </div>
      <span className="text-sm text-[var(--lp-muted)]">{job.route}</span>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-[var(--lp-dim)]">{t("bestOffer")}</span>
        <span key={best} className="animate-lp-tick font-mono text-base">
          {best} €
        </span>
      </div>
      <span className="font-mono text-xs text-[var(--lp-bluetext)]">
        {t("closes", { time: clock })}
      </span>
      <LandingGatedButton
        intent="bid"
        reference={job.ref}
        label={t("bid")}
        compact
        className="min-w-[74px] rounded-[10px] bg-[#0052FF] px-[18px] py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-[#1F63FF] disabled:opacity-90"
      />
    </div>
  );
}

export function LandingJobBoard() {
  const t = useTranslations("marketing.jobBoard");

  return (
    <section id="courses" className={LP_SECTION}>
      <div className={`${LP_CONTAINER} flex flex-col gap-7`}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <span className={LP_EYEBROW}>{t("eyebrow")}</span>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className={LP_H2}>{t("title")}</h2>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--lp-line)] bg-[var(--lp-chip)] px-2.5 py-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--lp-green)]" />
                <span className="font-mono text-[10.5px] tracking-[0.1em] text-[var(--lp-muted)]">
                  {t("liveLabel")}
                </span>
              </span>
            </div>
          </div>
          <LandingGatedButton
            intent="jobs"
            label={t("joinCta")}
            className="text-[15px] font-medium text-[var(--lp-bluelink)]"
          />
        </div>

        <div className="flex flex-col gap-2.5">
          {JOBS.map((job, index) => (
            <JobRow key={job.ref} job={job} index={index} />
          ))}
        </div>

        <span className="text-[13px] text-[var(--lp-dim)]">
          {t("anonymised")}
        </span>
      </div>
    </section>
  );
}
