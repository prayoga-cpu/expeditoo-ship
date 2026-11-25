import type { Metadata } from "next";
import {
  LandingNavbar,
  LandingHero,
  LandingMarquee,
  LandingRecentRequests,
  LandingServices,
  LandingHowItWorks,
  LandingPromises,
  LandingAppTour,
  LandingCarriers,
  LandingFaq,
  LandingCTA,
  LandingFooter,
  LandingMotion,
} from "@/features/marketing/ui";
import styles from "@/features/marketing/ui/landing.module.css";

/**
 * The landing page (docs/specs/landing_2026_11_spec.md). 2.96.0 rebuilt it
 * for the person who needs something moved, on the structure of the
 * client's reference — the blue band and its four-field card, « Demandes
 * récentes », three steps « Simple et rapide », the promises. 2.97.0 dressed
 * it in the manner of a second reference the owner chose: a floating header
 * and full-screen menu, a video hero, a marquee, tabs, numbered points round
 * a photograph, a dark band, an FAQ and a picture band to close. Their
 * structure and motion are taken; their words, colours, fonts, images and
 * video are not.
 *
 * The header and footer may link only to sections this page renders
 * (`landing-anchors.test.tsx`), and so may the menu.
 *
 * No `lp` class on `<main>`: the sections read the home page's own tokens
 * (`styles.home`), which follow the theme toggle; the shared header and
 * footer carry `lp` on their own roots, as on every marketing page.
 */
export const metadata: Metadata = {
  // `absolute`: the root layout's `%s · EXPEDITOP` template would name the
  // brand twice.
  title: {
    absolute: "Expeditop — Faites transporter vos objets par des transporteurs vérifiés",
  },
  description:
    "Dites ce que vous transportez et où : des transporteurs vérifiés vous envoient leurs offres. Vous choisissez, vous payez à l'acceptation. En France et à l'étranger.",
};

export default function LandingPage() {
  return (
    <main className={`${styles.home} min-h-screen bg-[var(--h-bg)] font-sans text-[var(--h-text)]`}>
      <LandingMotion />
      <LandingNavbar overlay />
      <LandingHero />
      <LandingMarquee />
      <LandingRecentRequests />
      <LandingServices />
      <LandingHowItWorks />
      <LandingPromises />
      <LandingAppTour />
      <LandingCarriers />
      <LandingFaq />
      <LandingCTA />
      <LandingFooter flush />
    </main>
  );
}
