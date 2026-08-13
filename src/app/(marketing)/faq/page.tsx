"use client";

import { LandingNavbar, LandingFooter } from "@/features/marketing/ui";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    category: "General",
    questions: [
      {
        q: "What is EXPEDITOO?",
        a: "EXPEDITOO is a unified marketplace and logistics platform that combines auctions, direct sales, and peer-to-peer shipping. You can buy, sell, and ship items all in one place.",
      },
      {
        q: "How do I create an account?",
        a: "Click the 'Get Started' button on the homepage and fill in your details. You can also sign up using your Google account for faster registration.",
      },
      {
        q: "Is EXPEDITOO free to use?",
        a: "Creating an account and browsing listings is free. We charge a small commission on successful transactions to cover platform costs.",
      },
    ],
  },
  {
    category: "Buying",
    questions: [
      {
        q: "How do I place a bid?",
        a: "Navigate to the item you're interested in, enter your bid amount (minimum €5 above current bid), and click 'Place Bid'. You'll receive notifications if you're outbid.",
      },
      {
        q: "What happens if I win an auction?",
        a: "You'll receive a notification and can proceed to checkout. You'll need to provide a delivery address and select a shipping option before completing payment.",
      },
      {
        q: "Can I buy items directly without bidding?",
        a: "Yes! Many items are listed with a fixed price option. Just click 'Buy Now' to purchase immediately without waiting for an auction to end.",
      },
    ],
  },
  {
    category: "Selling",
    questions: [
      {
        q: "How do I list an item for sale?",
        a: "Click 'Create Listing' from your dashboard. Fill in the item details, upload photos, set your price or starting bid, and publish. Your listing will be live immediately.",
      },
      {
        q: "What items can I sell?",
        a: "You can sell most physical items. Prohibited items include illegal goods, weapons, counterfeit items, and hazardous materials. See our Terms of Service for the full list.",
      },
      {
        q: "How do I get paid?",
        a: "Payments are processed through Stripe. After the buyer completes payment and the item is delivered, funds are released to your connected bank account.",
      },
    ],
  },
  {
    category: "Shipping",
    questions: [
      {
        q: "How does shipping work?",
        a: "EXPEDITOO connects you with drivers who can pick up and deliver items. After a sale, you can create a shipment request. Drivers will submit proposals, and you choose the best option.",
      },
      {
        q: "Can I become a driver?",
        a: "Yes! Go to your profile and click 'Become a Driver'. Fill out the application with your vehicle information and ID. Once approved, you can start accepting deliveries.",
      },
      {
        q: "How is shipping price determined?",
        a: "Drivers submit their own price proposals based on distance, package size, and timing. You can compare proposals and choose the one that works best for you.",
      },
    ],
  },
  {
    category: "Payments",
    questions: [
      {
        q: "What payment methods are accepted?",
        a: "We accept all major credit and debit cards through Stripe. Some regions may also have additional local payment options.",
      },
      {
        q: "Is my payment information secure?",
        a: "Yes. We use Stripe for payment processing, which is PCI Level 1 certified—the highest level of security certification in the payments industry.",
      },
      {
        q: "What if there's a problem with my order?",
        a: "Contact the seller through our messaging system first. If you can't resolve the issue, contact our support team and we'll help mediate.",
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <main className="relative bg-linear-to-br from-background via-background to-primary/5 min-h-screen">
      <LandingNavbar />
      <div className="container mx-auto px-4 py-24 max-w-4xl">
        <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
        <p className="text-muted-foreground mb-12">
          Find answers to common questions about EXPEDITOO.
        </p>

        <div className="space-y-8">
          {faqs.map((section) => (
            <div key={section.category}>
              <h2 className="text-2xl font-semibold mb-4">{section.category}</h2>
              <Accordion type="single" collapsible className="w-full">
                {section.questions.map((faq, index) => (
                  <AccordionItem
                    key={index}
                    value={`${section.category}-${index}`}
                  >
                    <AccordionTrigger className="text-left">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>

        <div className="mt-16 p-6 bg-muted/50 rounded-lg text-center">
          <h3 className="text-xl font-semibold mb-2">Still have questions?</h3>
          <p className="text-muted-foreground mb-4">
            Can&apos;t find what you&apos;re looking for? Our support team is here to help.
          </p>
          <a
            href="mailto:support@expeditoo.com"
            className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
      <LandingFooter />
    </main>
  );
}
