"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./LandingSectionHeading";
import { H_CONTAINER, H_SECTION_Y, LP_ANCHOR_OFFSET } from "./styles";

/**
 * Six questions, answered from what the app does. Four are `/help`'s own
 * (`help.faq.*`), word for word, so the two pages cannot drift apart; two are
 * the landing's, for people who have not signed up yet: what it costs and
 * who the carriers are (landing_2026_11_spec.md §3).
 */
export const FAQ_ITEMS = [
  { source: "help", key: "q2" },
  { source: "landing", key: "cost" },
  { source: "landing", key: "carriers" },
  { source: "help", key: "q5" },
  { source: "help", key: "q3" },
  { source: "help", key: "q1" },
] as const;

function FaqItem({
  id,
  question,
  answer,
  open,
  onToggle,
}: {
  id: string;
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="border-b border-[var(--h-line)]">
      <h3 className="m-0">
        <button
          id={`${id}-question`}
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-answer`}
          onClick={onToggle}
          className="flex w-full cursor-pointer items-center justify-between gap-6 bg-transparent py-6 text-left text-[1.05rem] leading-snug font-bold tracking-[-0.01em] text-[var(--h-text)] focus-visible:ring-[3px] focus-visible:ring-[rgb(7_107_227/0.35)] focus-visible:outline-none sm:text-[1.15rem]"
        >
          {question}
          <span
            aria-hidden
            className={cn(
              "flex h-9 w-9 flex-none items-center justify-center rounded-full transition-[transform,background-color] duration-300 motion-reduce:transition-none",
              open ? "rotate-45 bg-primary text-white" : "bg-[var(--h-accent-soft)] text-[var(--h-accent-text)]"
            )}
          >
            <Plus className="h-[18px] w-[18px]" />
          </span>
        </button>
      </h3>
      <div
        id={`${id}-answer`}
        role="region"
        aria-labelledby={`${id}-question`}
        hidden={!open}
        className="pr-4 pb-7 text-[0.98rem] leading-[1.7] text-pretty text-[var(--h-muted)] sm:pr-16 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-300"
      >
        {answer}
      </div>
    </li>
  );
}

/** Where a question that is not here goes: `/help`, then a person. */
function MoreQuestions() {
  const t = useTranslations("marketing.faq");
  return (
    <div data-reveal className="flex flex-col items-start gap-3 rounded-[22px] bg-[var(--h-alt)] p-6 ring-1 ring-[var(--h-line)]">
      <span className="text-[1.05rem] font-bold text-[var(--h-text)]">{t("moreTitle")}</span>
      <span className="text-[0.95rem] leading-relaxed text-[var(--h-muted)]">{t("moreText")}</span>
      <div className="mt-1 flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/help" className="inline-flex items-center gap-1.5 text-[0.95rem] font-semibold text-[var(--h-accent-text)]">
          {t("help")}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <Link href="/contact" className="inline-flex items-center gap-1.5 text-[0.95rem] font-semibold text-[var(--h-accent-text)]">
          {t("contact")}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

/**
 * The reference's FAQ accordion: a button per question, a labelled region per
 * answer. One answer open at a time; the first is open on arrival, so the
 * page says something before anyone presses anything.
 */
export function LandingFaq() {
  const t = useTranslations("marketing.faq");
  const tHelp = useTranslations("help.faq");
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();
  const read = (item: (typeof FAQ_ITEMS)[number], part: "question" | "answer") =>
    item.source === "help" ? tHelp(`${item.key}.${part}`) : t(`${item.key}.${part}`);

  return (
    <section id="faq" aria-labelledby="faq-title" className={`${LP_ANCHOR_OFFSET} ${H_SECTION_Y} bg-[var(--h-bg)]`}>
      {/* Phone: heading, questions, then where else to ask. From `lg`: the
          heading and that box on the left, the questions down the right. */}
      <div className={`${H_CONTAINER} grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:grid-rows-[auto_1fr] lg:gap-x-20 lg:gap-y-10`}>
        <div className="lg:col-start-1 lg:row-start-1">
          <SectionHeading titleId="faq-title" eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")} />
        </div>
        <ul data-reveal className="m-0 list-none border-t border-[var(--h-line)] p-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {FAQ_ITEMS.map((item, index) => (
            <FaqItem
              key={`${item.source}-${item.key}`}
              id={`${base}-${index}`}
              question={read(item, "question")}
              answer={read(item, "answer")}
              open={open === index}
              onToggle={() => setOpen((current) => (current === index ? null : index))}
            />
          ))}
        </ul>
        <div className="lg:col-start-1 lg:row-start-2 lg:self-start">
          <MoreQuestions />
        </div>
      </div>
    </section>
  );
}
