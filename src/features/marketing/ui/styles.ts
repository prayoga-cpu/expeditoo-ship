/**
 * Shared class strings for the landing surface. Values mirror the approved
 * landing design; the mobile steps are additions, since the design is
 * specified at desktop width only.
 */

/** Clears the sticky header when an in-page anchor is followed. */
export const LP_ANCHOR_OFFSET = "scroll-mt-[112px] md:scroll-mt-[66px]";

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

export const LP_BTN_PRIMARY =
  "rounded-xl bg-[#0052FF] font-medium text-white transition-colors hover:bg-[#1F63FF] hover:text-white";

export const LP_BTN_GHOST =
  "rounded-xl border border-[var(--lp-line2)] font-medium text-[var(--lp-text)] transition-colors hover:bg-[var(--lp-chip)] hover:text-[var(--lp-text)]";

export const EXPEDION_URL = "https://expedion-encheres.vercel.app/";

/**
 * Content pages sit narrower than the landing grid: the landing rows are
 * cards, these are prose, and a 1180px measure is unreadable as running text.
 */
export const LP_PROSE_CONTAINER = "mx-auto w-full max-w-[760px]";

export const LP_H3 =
  "m-0 text-[19px] leading-[1.25] font-semibold tracking-[-0.015em] text-pretty sm:text-[21px]";

export const LP_BODY =
  "m-0 text-[15.5px] leading-[1.7] text-pretty text-[var(--lp-muted)]";
