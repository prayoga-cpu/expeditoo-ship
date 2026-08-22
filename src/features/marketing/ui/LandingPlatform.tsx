"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePrefersReducedMotion } from "../hooks/useGatedAction";
import {
  EXPEDION_URL,
  LP_CONTAINER,
  LP_EYEBROW,
  LP_H2,
  LP_SECTION,
} from "./styles";

const POINTS = ["point1", "point2", "point3", "point4"] as const;

/** Illustrative rows for the vignette; mirrors the demo data in LandingJobBoard. */
const PREVIEW_JOBS = [
  { ref: "EX-2481", route: "Paris 9e → Bordeaux", best: "196 €", time: "04:12" },
  { ref: "EX-2477", route: "Lyon → Toulouse", best: "120 €", time: "01:45" },
  { ref: "EX-2490", route: "Rouen → Paris 16e", best: "85 €", time: "09:00" },
] as const;

function PreviewJobRow({
  job,
  active,
}: {
  job: (typeof PREVIEW_JOBS)[number];
  active: boolean;
}) {
  const tBoard = useTranslations("marketing.jobBoard");

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-[14px] border bg-[var(--lp-bg2)] px-3.5 py-2.5 transition-colors ${
        active
          ? "border-[var(--lp-green)]"
          : "border-[var(--lp-line)]"
      }`}
    >
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className="truncate text-[13px] font-semibold text-[var(--lp-text)]">
          {job.route}
        </span>
        <span className="font-mono text-[10px] text-[var(--lp-dim)]">
          {job.ref} ·{" "}
          <span className="text-[var(--lp-ambertext)]">EXPEDION</span>
        </span>
      </div>
      <div className="flex flex-none flex-col items-end gap-[3px]">
        <span className="font-mono text-[13px] text-[var(--lp-text)]">
          {job.best}
        </span>
        <span className="font-mono text-[10px] text-[var(--lp-bluetext)]">
          {tBoard("closes", { time: job.time })}
        </span>
      </div>
    </div>
  );
}

/** Browser chrome around a miniature, CSS-only job-board vignette. */
function PlatformPreview() {
  const t = useTranslations("marketing.platform");
  const reducedMotion = usePrefersReducedMotion();

  // Starts on the row the still design shows, so the server render and the
  // hydrated one agree; the cycle only begins once the effect runs.
  const [activeIndex, setActiveIndex] = useState(1);

  useEffect(() => {
    if (reducedMotion) return;

    const timer = setInterval(
      () => setActiveIndex((index) => (index + 1) % PREVIEW_JOBS.length),
      4000
    );
    return () => clearInterval(timer);
  }, [reducedMotion]);

  const active = PREVIEW_JOBS[activeIndex] ?? PREVIEW_JOBS[0];

  return (
    <div className="flex flex-col gap-3 rounded-[22px] border border-[var(--lp-line)] bg-[var(--lp-bg2)] p-3.5">
      <div className="flex items-center gap-1.5 px-1.5 py-0.5">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="h-2.5 w-2.5 rounded-full bg-[var(--lp-line2)]"
          />
        ))}
        <span className="ml-2.5 flex h-[22px] flex-1 items-center rounded-md border border-[var(--lp-line)] bg-[var(--lp-chip)] px-2.5">
          <span className="font-mono text-[10px] text-[var(--lp-faint)]">
            expeditoo.com/courses
          </span>
        </span>
      </div>
      <div className="flex min-h-[260px] flex-col gap-2.5 rounded-xl border border-[var(--lp-line)] bg-[var(--lp-bg)] p-3.5 lg:min-h-[390px] lg:justify-center lg:gap-3.5 lg:p-6">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-[0.14em] text-[var(--lp-dim)]">
            {t("preview.board")}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-[var(--lp-line)] bg-[var(--lp-bg2)] px-2 py-[3px]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--lp-green)]" />
            <span className="font-mono text-[10px] text-[var(--lp-muted)]">
              {t("preview.live")}
            </span>
          </span>
        </div>
        {PREVIEW_JOBS.map((job) => (
          <PreviewJobRow
            key={job.ref}
            job={job}
            active={job.ref === active.ref}
          />
        ))}
        <div
          key={active.ref}
          className="animate-lp-tick flex items-center gap-2 rounded-[14px] bg-[var(--lp-greenbg)] px-3.5 py-2.5"
        >
          <span className="h-1.5 w-1.5 flex-none rounded-full bg-[var(--lp-green)]" />
          <span className="truncate text-xs font-medium text-[var(--lp-green)]">
            {t("preview.accepted", { route: active.route, price: active.best })}
          </span>
        </div>
      </div>
      <span className="px-1.5 pb-1 font-mono text-[11px] text-[var(--lp-faint)]">
        {t("preview.caption")}
      </span>
    </div>
  );
}

export function LandingPlatform() {
  const t = useTranslations("marketing.platform");

  return (
    <section id="platform" className={LP_SECTION}>
      <div
        className={`${LP_CONTAINER} grid grid-cols-1 items-center gap-12 lg:grid-cols-2`}
      >
        <div className="flex flex-col gap-5">
          <span className={LP_EYEBROW}>{t("eyebrow")}</span>
          <h2 className={LP_H2}>{t("title")}</h2>
          <p className="m-0 text-base leading-[1.6] text-pretty text-[var(--lp-muted)]">
            {t("intro")}
          </p>

          <div className="flex flex-col gap-3.5">
            {POINTS.map((point) => (
              <div key={point} className="flex gap-3.5">
                <span className="flex-none pt-[3px] font-mono text-xs text-[var(--lp-bluelink)]">
                  →
                </span>
                <span className="text-[15px] leading-[1.6] text-[var(--lp-text)]">
                  <strong className="font-semibold">
                    {t(`${point}.title`)}
                  </strong>{" "}
                  <span className="text-[var(--lp-muted)]">
                    {t(`${point}.desc`)}
                  </span>
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-[rgba(255,169,31,0.24)] bg-[rgba(255,169,31,0.07)] px-[18px] py-4">
            <span className="text-sm text-[var(--lp-ambersub)]">
              {t("note")}
            </span>
            <a
              href={EXPEDION_URL}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium whitespace-nowrap text-[var(--lp-ambertext)]"
            >
              {t("noteCta")}
            </a>
          </div>
        </div>

        <PlatformPreview />
      </div>
    </section>
  );
}
