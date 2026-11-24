"use client";

import { useTranslations } from "next-intl";
import styles from "./landing.module.css";

/**
 * What people move, as `/create` itself names it: these are keys of the
 * request form's own suggestions (`create.what.itemSuggestions`), so the
 * strip can only list things the form offers — no invented category.
 */
export const MARQUEE_ITEMS = [
  "sofa",
  "wardrobe",
  "washingMachine",
  "fridge",
  "piano",
  "bike",
  "motorbike",
  "artwork",
  "pallet",
  "movingBox",
  "mattress",
  "suitcase",
  "gardenFurniture",
  "parcel",
] as const;

function Words({ words, copy }: { words: string[]; copy: 1 | 2 }) {
  return (
    <ul
      data-copy={copy}
      aria-hidden={copy === 2 ? true : undefined}
      className="m-0 flex list-none items-center p-0"
    >
      {words.map((word) => (
        <li
          key={word}
          className="flex items-center gap-7 pr-7 text-[1.3rem] font-bold tracking-[-0.025em] whitespace-nowrap text-[var(--h-text)] sm:gap-9 sm:pr-9 sm:text-[1.7rem]"
        >
          {word}
          <span aria-hidden className="h-2 w-2 rotate-45 rounded-[2px] bg-[var(--h-accent)]" />
        </li>
      ))}
    </ul>
  );
}

/**
 * The slow strip under the hero (landing_2026_11_spec.md §3): the items, then
 * « Déménagement », scrolling left forever. The list is written twice so the
 * loop has no seam; the second copy is hidden from assistive technology and,
 * under reduced motion, from everyone (the first then wraps, still).
 */
export function LandingMarquee() {
  const t = useTranslations("create.what.itemSuggestions");
  const tMarquee = useTranslations("marketing.marquee");
  const tKind = useTranslations("marketing.recent.kind");
  const words = [...MARQUEE_ITEMS.map((key) => t(key)), tKind("moving")];

  return (
    <section
      aria-label={tMarquee("label")}
      className="border-b border-[var(--h-line)] bg-[var(--h-bg)] py-6 sm:py-8"
    >
      <div className={`${styles.marquee} overflow-hidden`}>
        <div className={styles.marqueeTrack}>
          <Words words={words} copy={1} />
          <Words words={words} copy={2} />
        </div>
      </div>
    </section>
  );
}
