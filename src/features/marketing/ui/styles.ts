/**
 * Shared class strings for the landing surface. Values mirror the approved
 * landing design; the mobile steps are additions, since the design is
 * specified at desktop width only.
 */

/**
 * Clears the floating header when an in-page anchor is followed: 12px of
 * inset, the 64px bar, and some air (2.97.0). The bar no longer wraps to two
 * rows on a phone, so one value holds at every width. Lenis reads the same
 * `scroll-margin-top` when it handles the jump.
 */
export const LP_ANCHOR_OFFSET = "scroll-mt-[92px]";

/** The home page's one content measure: header, sections and footer share it. */
export const H_CONTAINER = "mx-auto w-full max-w-[1200px] px-4 sm:px-8";

/** Vertical rhythm of a home section. */
export const H_SECTION_Y = "py-20 sm:py-24 lg:py-32";

/** Section titles: Plus Jakarta Sans, heavy and tight (spec §7). */
export const H_H2 =
  "m-0 text-[2rem] leading-[1.06] font-extrabold tracking-[-0.035em] text-balance text-[var(--h-text)] sm:text-[2.6rem] lg:text-[3.25rem]";

export const H_INTRO =
  "m-0 text-[1.02rem] leading-relaxed text-pretty text-[var(--h-muted)] sm:text-[1.1rem]";

const H_BTN =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-[1rem] font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:outline-none";

/** The app primary, as everywhere: white on #076BE3 is 5.0:1. */
export const H_BTN_PRIMARY = `${H_BTN} bg-primary text-white hover:bg-[#055bc4] focus-visible:ring-[rgb(7_107_227/0.45)] focus-visible:ring-offset-[var(--h-bg)]`;

/** For the dark and blue bands: white, the primary's text on it. */
export const H_BTN_WHITE = `${H_BTN} bg-white text-[#0b4fb0] hover:bg-[#eaf2ff] focus-visible:ring-white focus-visible:ring-offset-[#0a2348]`;

export const H_BTN_OUTLINE_WHITE = `${H_BTN} border border-[rgb(255_255_255/0.55)] bg-transparent text-white hover:bg-[rgb(255_255_255/0.12)] focus-visible:ring-white focus-visible:ring-offset-[#0a2348]`;

/** Every landing block roots itself in `lp` so the palette resolves anywhere. */
export const LP_SECTION = `lp ${LP_ANCHOR_OFFSET} px-5 sm:px-8 pt-[72px] lg:pt-[110px]`;

export const LP_CONTAINER = "mx-auto w-full max-w-[1180px]";

export const LP_EYEBROW =
  "font-mono text-[11px] tracking-[0.16em] text-[var(--lp-dim)]";

export const LP_H2 =
  "m-0 text-[26px] leading-[1.1] font-semibold tracking-[-0.03em] text-pretty sm:text-[32px] lg:text-[38px]";

export const LP_CARD =
  "flex flex-col rounded-[20px] border border-[var(--lp-line)] bg-[var(--lp-bg2)] p-[26px]";

/** 4-up card rows collapse to 2-up then 1-up below the desktop breakpoint. */
export const LP_GRID_4 =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4";

/**
 * The app's own primary (`--primary`, #076BE3 — ROADMAP.md §7), so the
 * header's button and the landing's agree. `!` on the hover colour: `.lp a:hover`
 * in globals.css is unlayered and would otherwise paint a link-button's label
 * light blue on blue.
 */
export const LP_BTN_PRIMARY =
  "rounded-xl bg-primary font-medium text-white transition-colors hover:bg-[#055bc4] hover:text-white!";

export const LP_BTN_GHOST =
  "rounded-xl border border-[var(--lp-line2)] font-medium text-[var(--lp-text)] transition-colors hover:bg-[var(--lp-chip)] hover:text-[var(--lp-text)]";

/**
 * Re-exported so the landing call sites keep importing it from the module
 * they always have. The value lives in `@/lib/constants/expedion` now that
 * the job board links out too.
 */
export { EXPEDION_URL } from "@/lib/constants/expedion";

/**
 * Content pages sit narrower than the landing grid: the landing rows are
 * cards, these are prose, and a 1180px measure is unreadable as running text.
 */
export const LP_PROSE_CONTAINER = "mx-auto w-full max-w-[760px]";

export const LP_H3 =
  "m-0 text-[19px] leading-[1.25] font-semibold tracking-[-0.015em] text-pretty sm:text-[21px]";

export const LP_BODY =
  "m-0 text-[15.5px] leading-[1.7] text-pretty text-[var(--lp-muted)]";
