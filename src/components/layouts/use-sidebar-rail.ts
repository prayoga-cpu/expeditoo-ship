import { useCallback, useEffect, useState } from "react";

/**
 * The sidebar's two widths, for all three shells (2.92.0 #17).
 *
 * The sidebar used to exist from `xl` only, so a 1024–1279px laptop got the
 * phone's bottom bar. It now shows from `lg`, in one of two shapes: expanded
 * (`w-64`, as before) or a rail (`w-16`, icons only). With no choice made it is
 * a rail below `xl` and expanded from `xl`; the header's three-line button
 * flips it, and the choice is remembered on this device.
 *
 * **The default is drawn by CSS, not by this hook.** `data-rail="auto"` on the
 * `<aside>` means "nobody chose": the classes in `RAIL` then key on the
 * viewport (`max-xl:`), so the first paint is already right and nothing jumps
 * when the effect below runs. Only a stored choice changes the attribute, to
 * `on` or `off`. `wide` exists for one thing: telling the toggle which way an
 * `auto` sidebar is currently drawn, so `aria-expanded` is true to the screen.
 */
export const SIDEBAR_RAIL_KEY = "expeditoo-sidebar";
/** What the toggle's `aria-controls` names. One sidebar per shell, one shell per page. */
export const SIDEBAR_ID = "app-sidebar";

/** Tailwind's `xl`: where an unchosen sidebar goes from rail to expanded. */
const WIDE_QUERY = "(min-width: 1280px)";

export type SidebarChoice = "rail" | "expanded";
/** The `data-rail` attribute: `auto` until someone chooses. */
export type SidebarRailState = "auto" | "on" | "off";

const isChoice = (value: unknown): value is SidebarChoice =>
  value === "rail" || value === "expanded";

function readChoice(): SidebarChoice | null {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_RAIL_KEY);
    return isChoice(stored) ? stored : null;
  } catch {
    // Private window or blocked storage: the width decides.
    return null;
  }
}

function writeChoice(choice: SidebarChoice) {
  try {
    window.localStorage.setItem(SIDEBAR_RAIL_KEY, choice);
  } catch {
    // Not remembered; the choice still applies to this visit.
  }
}

export interface SidebarRail {
  /** For the `<aside>`'s `data-rail`. */
  state: SidebarRailState;
  /** Whether the sidebar is drawn expanded right now. */
  expanded: boolean;
  toggle: () => void;
}

export function useSidebarRail(): SidebarRail {
  const [choice, setChoice] = useState<SidebarChoice | null>(null);
  const [wide, setWide] = useState(false);

  // Read after mount, so the server and the first client render agree.
  useEffect(() => {
    setChoice(readChoice());
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(WIDE_QUERY);
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const expanded = choice ? choice === "expanded" : wide;

  const toggle = useCallback(() => {
    const next: SidebarChoice = expanded ? "rail" : "expanded";
    setChoice(next);
    writeChoice(next);
  }, [expanded]);

  return {
    state: choice === null ? "auto" : choice === "rail" ? "on" : "off",
    expanded,
    toggle,
  };
}

/**
 * The classes that draw the rail. Every one is the same rule written twice —
 * "the rail was chosen" and "nobody chose and the screen is below `xl`" — and
 * spelled out in full because Tailwind only emits classes it can read in the
 * source. They hang off the `group/sidebar` the `<aside>` declares.
 */
export const RAIL = {
  /** On the `<aside>` itself. */
  aside: "w-64 data-[rail=on]:w-16 max-xl:data-[rail=auto]:w-16",
  /** Kept for screen readers, so a link's name survives losing its label. */
  srOnly:
    "group-data-[rail=on]/sidebar:sr-only max-xl:group-data-[rail=auto]/sidebar:sr-only",
  /** Gone in the rail. */
  hidden:
    "group-data-[rail=on]/sidebar:hidden max-xl:group-data-[rail=auto]/sidebar:hidden",
  /** Drawn in the rail only. */
  only: "hidden group-data-[rail=on]/sidebar:flex max-xl:group-data-[rail=auto]/sidebar:flex",
  /** A row that centres its icon once the label is gone. */
  center:
    "group-data-[rail=on]/sidebar:justify-center group-data-[rail=on]/sidebar:px-0 max-xl:group-data-[rail=auto]/sidebar:justify-center max-xl:group-data-[rail=auto]/sidebar:px-0",
  /** Side padding of the list: 16px expanded, 8px in the rail (48px targets). */
  gutter:
    "group-data-[rail=on]/sidebar:px-2 max-xl:group-data-[rail=auto]/sidebar:px-2",
  /** A count that moves from the end of the row to the icon's corner. */
  badge:
    "group-data-[rail=on]/sidebar:absolute group-data-[rail=on]/sidebar:right-0.5 group-data-[rail=on]/sidebar:top-0.5 max-xl:group-data-[rail=auto]/sidebar:absolute max-xl:group-data-[rail=auto]/sidebar:right-0.5 max-xl:group-data-[rail=auto]/sidebar:top-0.5",
} as const;

/**
 * Header pieces that stand in for what a rail cannot hold — the access
 * switcher, whose badge is wider than 64px. `withBar` is for a header that
 * already shows the piece beside the phone bar (MainLayout, from `md`);
 * `sidebarOnly` for one that never did (admin, driver).
 */
export const WHEN_RAIL: Record<
  "withBar" | "sidebarOnly",
  Record<SidebarRailState, string>
> = {
  withBar: {
    auto: "max-md:hidden xl:hidden",
    on: "max-md:hidden",
    off: "max-md:hidden lg:hidden",
  },
  sidebarOnly: {
    auto: "max-lg:hidden xl:hidden",
    on: "max-lg:hidden",
    off: "hidden",
  },
};
