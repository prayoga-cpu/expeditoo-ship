import {
  LandingNavbar,
  LandingFooter,
  LandingHero,
  LandingStats,
  LandingHowItWorks,
  LandingWhatToShip,
  LandingTestimonials,
  LandingAdvantages,
  LandingShowcase,
  LandingCTA,
  FloatingLanguageSwitcher,
} from "@/features/marketing/ui";

export default function LandingPage() {
  return (
    <main className="relative bg-linear-to-br from-background via-background to-primary/5">
      <LandingNavbar />
      <section>
        <LandingHero />
        <LandingStats />
        <LandingHowItWorks />
        <LandingWhatToShip />
        <LandingAdvantages />
        <LandingShowcase />
        <LandingTestimonials />
        <LandingCTA />
      </section>
      <LandingFooter />
      <FloatingLanguageSwitcher />
    </main>
  );
}
