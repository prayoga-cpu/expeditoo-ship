"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mail, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { messagesApi } from "@/features/app/messages/api/messages.api";

export default function HelpPage() {
  const t = useTranslations("help");
  const router = useRouter();
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  const handleChatWithSupport = async () => {
    setIsCreatingChat(true);
    try {
      const data = await messagesApi.createSupportChat();
      // Navigate to the chat room
      router.push(`/messages/${data.chatRoomId}`);
    } catch (error) {
      console.error("Error creating support chat:", error);
      toast.error("Failed to start chat. Please try again.");
    } finally {
      setIsCreatingChat(false);
    }
  };

  return (
    <div className="w-full mx-auto p-4 md:p-6 space-y-8 pb-16 md:pb-6">
      <div className="flex flex-col items-start gap-3">
        <div className="flex items-center gap-3">
          <Link href="/profile">
            <Button variant="ghost" size="icon" className="rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>

          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        </div>
        <p className="text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              {t("emailSupport.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t("emailSupport.description")}
            </p>
            <Button variant="outline" className="w-full" asChild>
              <a href="mailto:support@expeditoo.com">support@expeditoo.com</a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              {t("phoneSupport.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t("phoneSupport.description")}
            </p>
            <Button variant="outline" className="w-full" asChild>
              <a href="tel:+1234567890">+1 (234) 567-890</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t("faq.title")}
        </h2>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>{t("faq.q1.question")}</AccordionTrigger>
            <AccordionContent>
              {t("faq.q1.answer")}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>
              {t("faq.q2.question")}
            </AccordionTrigger>
            <AccordionContent>
              {t("faq.q2.answer")}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger>{t("faq.q3.question")}</AccordionTrigger>
            <AccordionContent>
              {t("faq.q3.answer")}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-4">
            <AccordionTrigger>{t("faq.q4.question")}</AccordionTrigger>
            <AccordionContent>
              {t("faq.q4.answer")}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-5">
            <AccordionTrigger>
              {t("faq.q5.question")}
            </AccordionTrigger>
            <AccordionContent>
              {t("faq.q5.answer")}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="bg-muted/50 rounded-lg p-6 text-center space-y-4">
        <h3 className="font-semibold">{t("stillNeedHelp.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("stillNeedHelp.description")}
        </p>
        <Button onClick={handleChatWithSupport} disabled={isCreatingChat}>
          <MessageCircle className="w-4 h-4 mr-2" />
          {isCreatingChat ? "Starting chat..." : t("stillNeedHelp.chatButton")}
        </Button>
      </div>
    </div>
  );
}
