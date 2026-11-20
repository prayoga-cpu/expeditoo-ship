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
import { useTranslations } from "next-intl";
import { FeedbackRequestCard } from "@/features/app/feedback/ui/FeedbackRequestCard";

const FAQ = ["paid", "absent", "accept", "vehicle"] as const;

export default function DriverHelpPage() {
  const t = useTranslations("driver.help");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="md:col-span-2">
          <FeedbackRequestCard />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              {t("operations.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t("operations.description")}
            </p>
            <Button variant="outline" className="w-full" asChild>
              <a href="mailto:drivers@expeditop.fr">drivers@expeditop.fr</a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              {t("emergency.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t("emergency.description")}
            </p>
            {/* TODO(EXPEDITOO-LEGAL): a placeholder, not a real line. Replace
                it with the operations number before drivers rely on it. */}
            <Button variant="destructive" className="w-full" asChild>
              <a href="tel:+1987654321">+1 (987) 654-321</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t("faq.title")}
        </h2>
        <Accordion type="single" collapsible className="w-full">
          {FAQ.map((key) => (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger>{t(`faq.${key}.question`)}</AccordionTrigger>
              <AccordionContent>{t(`faq.${key}.answer`)}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <div className="bg-muted/50 rounded-lg p-6 text-center space-y-4">
        <h3 className="font-semibold">{t("report.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("report.description")}</p>
        <Button asChild variant="secondary">
          <Link href="/driver/messages">
            <MessageSquare className="w-4 h-4 mr-2" />
            {t("report.action")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
