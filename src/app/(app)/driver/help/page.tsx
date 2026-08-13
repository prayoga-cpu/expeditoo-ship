"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Phone, Truck } from "lucide-react";
import Link from "next/link";

export default function DriverHelpPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Driver Support</h1>
        <p className="text-muted-foreground">
          Resources and support for our transporter partners.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Driver Operations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Issues with a current delivery or vehicle? Contact the operations
              team directly.
            </p>
            <Button variant="outline" className="w-full" asChild>
              <a href="mailto:drivers@expeditoo.com">drivers@expeditoo.com</a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Emergency Line
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              For accidents or urgent delivery issues only. Available 24/7.
            </p>
            <Button variant="destructive" className="w-full" asChild>
              <a href="tel:+1987654321">+1 (987) 654-321</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Driver FAQ</h2>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>How do I get paid?</AccordionTrigger>
            <AccordionContent>
              Payments are processed weekly for all completed deliveries. Ensure
              your bank details are up to date in your profile. You can view
              your earnings in the "Wallet" section.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>
              What if the recipient is not home?
            </AccordionTrigger>
            <AccordionContent>
              If you cannot deliver the package, try calling the recipient
              through the app. If there is no answer after 10 minutes, please
              contact Driver Support for further instructions. Do not leave
              packages unattended unless specified.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger>How do I accept a new job?</AccordionTrigger>
            <AccordionContent>
              Go to the "Available Shipments" tab in your dashboard. Review the
              details and submit a proposal with your price and estimated time.
              If accepted, you will be notified immediately.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-4">
            <AccordionTrigger>
              Can I update my vehicle details?
            </AccordionTrigger>
            <AccordionContent>
              Yes, you can update your vehicle information in your Profile
              settings. Note that changing vehicles may require re-verification
              of your documents.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="bg-muted/50 rounded-lg p-6 text-center space-y-4">
        <h3 className="font-semibold">Need to report an issue?</h3>
        <p className="text-sm text-muted-foreground">
          Use the driver chat to report non-urgent issues or feedback.
        </p>
        <Button asChild variant="secondary">
          <Link href="/driver/messages">
            <MessageSquare className="w-4 h-4 mr-2" />
            Go to Driver Chat
          </Link>
        </Button>
      </div>
    </div>
  );
}
