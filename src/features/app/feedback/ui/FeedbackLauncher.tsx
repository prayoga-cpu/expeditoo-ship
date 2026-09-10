"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MessageSquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FeedbackDialog } from "./FeedbackDialog";

/**
 * "Tell us something" — for every signed-in user, in every shell.
 *
 * Mounted in the header action cluster of all three shells (MainLayout,
 * DriverLayout, AdminLayout) because the header is the only chrome all three
 * render unconditionally at every width, so one placement covers desktop and
 * mobile. Not in `Providers` — that wraps the signed-out marketing pages, where
 * the dialog could not submit. Not in `BottomNav` — six slots, already full.
 *
 * **Deliberately ungated.** `HeaderQuickActions` returns null for anyone who is
 * not an approved driver, which is exactly the complaint that a new signup sees
 * an empty header. Everyone who reaches these shells is signed in, and everyone
 * signed in may write to us.
 */
export function FeedbackLauncher({ className }: { className?: string }) {
  const t = useTranslations("feedback.trigger");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("label")}
        title={t("label")}
        onClick={() => setOpen(true)}
        className={cn(
          "h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground",
          className
        )}
      >
        <MessageSquarePlus className="h-4 w-4" />
      </Button>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
