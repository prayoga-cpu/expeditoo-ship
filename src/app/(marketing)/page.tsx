import {
  LandingBanner,
  LandingNavbar,
  LandingHero,
  LandingHowItWorks,
  LandingJobBoard,
  LandingAdvantages,
  LandingPlatform,
  LandingTestimonials,
  LandingCTA,
  LandingFooter,
} from "@/features/marketing/ui";

export default function LandingPage() {
  return (
    <main className="lp min-h-screen">
      <LandingBanner />
      <LandingNavbar />
      <LandingHero />
      <LandingHowItWorks />
      <LandingJobBoard />
      <LandingAdvantages />
      <LandingPlatform />
      <LandingTestimonials />
      <LandingCTA />
      <LandingFooter />
    </main>
  );
}
