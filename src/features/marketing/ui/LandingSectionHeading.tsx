import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { H_H2, H_INTRO } from "./styles";

/**
 * A stagger step for `[data-reveal]` blocks (landing.module.css). Read only
 * once `LandingReveal` has set `lp-motion` on <html>; without it the delay
 * applies to nothing.
 */
export function revealDelay(index: number, stepMs = 90): CSSProperties {
  return { "--lp-delay": `${index * stepMs}ms` } as CSSProperties;
}

/** The small label over a section title: a short accent rule, then words. */
export function Eyebrow({ children, onDark = false }: { children: ReactNode; onDark?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 text-[0.8rem] font-semibold tracking-[0.02em]",
        onDark ? "text-[#a9c8ff]" : "text-[var(--h-accent-text)]"
      )}
    >
      <span aria-hidden className={cn("h-[3px] w-6 rounded-full", onDark ? "bg-[#5b9dff]" : "bg-[var(--h-accent)]")} />
      {children}
    </span>
  );
}

/**
 * Eyebrow, title and intro, in the one type scale every section shares. The
 * block fades up from a light blur as it enters (`data-reveal`).
 */
export function SectionHeading({
  titleId,
  eyebrow,
  title,
  intro,
  centered = false,
}: {
  titleId: string;
  eyebrow: string;
  title: string;
  intro?: string;
  centered?: boolean;
}) {
  return (
    <div
      data-reveal
      className={cn("flex max-w-[44rem] flex-col gap-4", centered && "mx-auto items-center text-center")}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={titleId} className={H_H2}>
        {title}
      </h2>
      {intro && <p className={H_INTRO}>{intro}</p>}
    </div>
  );
}
