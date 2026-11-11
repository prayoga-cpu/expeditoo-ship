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
 * platform tour and the testimonials are no longer drawn here; their
 * components remain in `features/marketing/ui` if the client wants any back.
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
