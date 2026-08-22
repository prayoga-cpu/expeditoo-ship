"use client";

import type { ReactNode } from "react";
import { LandingNavbar } from "./LandingNavbar";
import { LandingFooter } from "./LandingFooter";
import { LP_BODY, LP_CONTAINER, LP_EYEBROW, LP_H2 } from "./styles";

/**
 * Frame shared by every marketing page that is not the landing page itself.
 *
 * It exists because `/terms` and `/privacy` used to set an app-palette
 * background (`from-background via-background`) while embedding the landing
 * navbar and footer, which are scoped to `.lp`. The result was two colour
 * systems stacked on one screen. The `lp` class belongs on the root here so a
 * page cannot reintroduce that split by forgetting it.
 */
export function MarketingPageShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <main className="lp min-h-screen">
      <LandingNavbar />

      <header className="lp px-5 pt-[56px] sm:px-8 lg:pt-[80px]">
        <div className={`${LP_CONTAINER} flex flex-col gap-3.5`}>
          <span className={LP_EYEBROW}>{eyebrow}</span>
          <h1 className={LP_H2}>{title}</h1>
          {intro ? <p className={`${LP_BODY} max-w-[620px]`}>{intro}</p> : null}
        </div>
      </header>

      <div className="lp px-5 pt-11 sm:px-8">{children}</div>

      <LandingFooter />
    </main>
  );
}
