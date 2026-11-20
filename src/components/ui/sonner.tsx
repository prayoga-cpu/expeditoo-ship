"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

/** Tailwind's `lg`: from here the shells draw a sidebar and no bottom bar. */
const SIDEBAR_QUERY = "(min-width: 1024px)";

/**
 * Clear of the shells' 48px header, and of the notch. Sonner writes these
 * values into CSS custom properties, so `env()` survives.
 */
const BELOW_HEADER = { top: "calc(3.5rem + env(safe-area-inset-top, 0px))" };

/**
 * Where a toast appears (2.92.0 #36).
 *
 * Sonner's default is the bottom, full width on a phone — exactly where the
 * floating navigation bar is. Every confirmation therefore covered the bar for
 * its four seconds, and a tap meant for a tab landed on the toast. Below `lg`
 * toasts now come from the top, under the header rather than over its buttons;
 * from `lg` there is no bar, and they keep the bottom-right corner.
 *
 * The top is also what renders before the effect has run: it is the placement
 * that is safe at every width.
 */
function useToastPlacement(): Pick<ToasterProps, "position" | "offset" | "mobileOffset"> {
  const [hasSidebar, setHasSidebar] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(SIDEBAR_QUERY);
    const sync = () => setHasSidebar(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  if (hasSidebar) return { position: "bottom-right" };
  return { position: "top-center", offset: BELOW_HEADER, mobileOffset: BELOW_HEADER };
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const placement = useToastPlacement();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...placement}
      {...props}
    />
  );
};

export { Toaster };
