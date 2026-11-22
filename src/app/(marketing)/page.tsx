import {
  LandingNavbar,
  LandingHero,
  LandingHowItWorks,
  LandingAdvantages,
  LandingCTA,
  LandingFooter,
} from "@/features/marketing/ui";

/**
 * The landing page, cut to what a first visit needs (client feedback
 * 2026-11-06, U01): one message and one action, three steps, two reasons to
 * stay, one closing button. The cross-sell banner, the live-board preview, the
 * platform tour and the testimonials are no longer drawn here, and their
 * components were deleted in 2.95.0 — the header and footer must not link to
 * a section this page does not render (`landing-anchors.test.tsx`).
 */
export default function LandingPage() {
  return (
    <main className="lp min-h-screen">
      <LandingNavbar />
      <LandingHero />
      <LandingHowItWorks />
      <LandingAdvantages />
      <LandingCTA />
      <LandingFooter />
    </main>
  );
}
