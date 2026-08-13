"use client";

import { LandingNavbar, LandingFooter } from "@/features/marketing/ui";

export default function TermsOfServicePage() {
  return (
    <main className="relative bg-linear-to-br from-background via-background to-primary/5 min-h-screen">
      <LandingNavbar />
      <div className="container mx-auto px-4 py-24 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <p className="text-muted-foreground mb-6">
          Last updated: December 10, 2025
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing and using EXPEDITOO, you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              EXPEDITOO is a unified marketplace and logistics platform that provides:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
              <li>Auction and direct sales services</li>
              <li>Peer-to-peer shipping coordination</li>
              <li>Messaging between buyers and sellers</li>
              <li>Payment processing</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
            <p className="text-muted-foreground leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials 
              and for all activities that occur under your account. You must notify us immediately 
              of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. User Conduct</h2>
            <p className="text-muted-foreground leading-relaxed">
              Users agree not to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
              <li>Post false, misleading, or fraudulent content</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on the rights of others</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Use the platform for illegal activities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Listings and Transactions</h2>
            <p className="text-muted-foreground leading-relaxed">
              Sellers are responsible for accurately describing their items. Buyers should review 
              listings carefully before making purchases. EXPEDITOO is not responsible for the 
              quality, safety, or legality of items listed.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Shipping and Delivery</h2>
            <p className="text-muted-foreground leading-relaxed">
              Shipping arrangements are made between users and drivers through our platform. 
              EXPEDITOO facilitates these connections but is not responsible for delivery outcomes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              EXPEDITOO is provided &quot;as is&quot; without warranties of any kind. We are not liable 
              for any damages arising from your use of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these terms at any time. Continued use of the platform 
              after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these Terms of Service, please contact us at support@expeditoo.com.
            </p>
          </section>
        </div>
      </div>
      <LandingFooter />
    </main>
  );
}
