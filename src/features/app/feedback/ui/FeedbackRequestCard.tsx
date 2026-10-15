"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MessageSquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackDialog } from "./FeedbackDialog";

/**
 * « J'ai une demande », on the help pages.
 *
 * It used to be a quick link of its own on `/profile`; the client asked for it
 * under « Contact & Aide » (client_feedback_2026_10_spec.md §6), which is the
 * page that link opens. A dialog rather than a page, as before: the request
 * reaches the same feedback queue the header launcher feeds.
 */
export function FeedbackRequestCard() {
  const t = useTranslations("feedback.helpCard");
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquarePlus className="h-5 w-5 text-primary" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">{t("description")}</p>
        <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
          {t("button")}
        </Button>
      </CardContent>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </Card>
  );
}
