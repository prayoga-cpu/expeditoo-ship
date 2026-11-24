import type { Metadata } from "next";
import {
  LandingNavbar,
  LandingHero,
  LandingTrust,
  LandingRecentRequests,
  LandingHowItWorks,
  LandingAudiences,
  LandingCTA,
  LandingFooter,
} from "@/features/marketing/ui";

/**
 * The landing page, rebuilt in 2.96.0 for the person who needs something
 * moved (docs/specs/landing_2026_11_spec.md). The client pointed at a
 * reference for clarity on 19 Nov — « more clear and direct, more readable »,
 * « simple & quick » — and asked for its search card with the request's title
 * in place of « Date exacte ». Its structure is followed; its words, colours
 * and images are not.
 *
 * The header and footer may link only to sections this page renders
 * (`landing-anchors.test.tsx`): #how, #recent, #carriers.
 *
 * No `lp` class on `<main>`: the sections use the app's own tokens, which
 * follow the theme toggle; the shared header and footer carry `lp` on their
 * own roots, as on every marketing page.
 */
export const metadata: Metadata = {
  title: "Expeditop — Faites transporter vos objets par des transporteurs vérifiés",
  description:
    "Dites ce que vous transportez et où : des transporteurs vérifiés vous envoient leurs offres. Vous choisissez, vous payez à l'acceptation. En France et à l'étranger.",
};

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      <LandingNavbar />
      <LandingHero />
      <LandingTrust />
      <LandingRecentRequests />
      <LandingHowItWorks />
      <LandingAudiences />
      <LandingCTA />
      <LandingFooter flush />
    </main>
  );
}
