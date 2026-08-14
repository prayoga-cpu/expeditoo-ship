"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LP_CONTAINER, LP_EYEBROW, LP_H2, LP_SECTION } from "./styles";

const JOBS = [
  { key: "one", ref: "EX-2481", route: "Paris 9e → Bordeaux", best: "196 €", time: "04:12" },
  { key: "two", ref: "EX-2477", route: "Lyon → Toulouse", best: "120 €", time: "01:45" },
  { key: "three", ref: "EX-2490", route: "Rouen → Paris 16e", best: "85 €", time: "09:00" },
] as const;

const ROW =
  "grid grid-cols-1 items-center gap-x-[18px] gap-y-3 rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-bg2)] px-6 py-5 lg:grid-cols-[1.5fr_1.1fr_0.9fr_0.8fr_auto]";

function JobRow({ job }: { job: (typeof JOBS)[number] }) {
  const t = useTranslations("marketing.jobBoard");

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
        <span className="font-mono text-base">{job.best}</span>
      </div>
      <span className="font-mono text-xs text-[var(--lp-bluetext)]">
        {t("closes", { time: job.time })}
      </span>
      <Link
        href="/signup"
        className="rounded-[10px] bg-[#0052FF] px-[18px] py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-[#1F63FF] hover:text-white"
      >
        {t("bid")}
      </Link>
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
            <h2 className={LP_H2}>{t("title")}</h2>
          </div>
          <Link
            href="/signup"
            className="text-[15px] font-medium text-[var(--lp-bluelink)]"
          >
            {t("joinCta")}
          </Link>
        </div>

        <div className="flex flex-col gap-2.5">
          {JOBS.map((job) => (
            <JobRow key={job.ref} job={job} />
          ))}
        </div>

        <span className="text-[13px] text-[var(--lp-dim)]">
          {t("anonymised")}
        </span>
      </div>
    </section>
  );
}
