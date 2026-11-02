"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useCancelRequest,
  useEditLiveRequest,
  useRepostRequest,
} from "../hooks/useRequestActions";
import type { Job } from "../types";

interface RequestActionsProps {
  job: Pick<Job, "id" | "status" | "origin" | "offersCount">;
  className?: string;
  /** The open confirmation, when the caller holds it (tests do). */
  confirming?: Confirming;
  onConfirmingChange?: (next: Confirming) => void;
}

type Confirming = "edit" | "cancel" | null;

const ENDED: Job["status"][] = ["expired", "cancelled", "completed"];
const RUNNING: Job["status"][] = ["awarded", "in_progress"];

/**
 * What a requester can do with their request once it is live or done
 * (docs/specs/no_dead_ends_spec.md §2–3) — the half `DraftActions` does not
 * cover. Live: change it or call it off. Taken: follow the delivery, which is
 * where cancelling goes from there. Ended: post it again.
 *
 * Direct requests only: an escalated job belongs to the Expedion system
 * account, and its client acts in the Expedion app. Rendered outside the
 * card's link — a button inside a link is not a button.
 */
export function RequestActions({
  job,
  className,
  confirming: heldConfirming,
  onConfirmingChange,
}: RequestActionsProps) {
  const t = useTranslations("myJobs.owner");
  const [ownConfirming, setOwnConfirming] = useState<Confirming>(null);
  const confirming = heldConfirming ?? ownConfirming;
  const setConfirming = onConfirmingChange ?? setOwnConfirming;
  const edit = useEditLiveRequest();
  const cancel = useCancelRequest();
  const repost = useRepostRequest();
  const busy = edit.isPending || cancel.isPending || repost.isPending;

  if (job.origin !== "direct") return null;

  if (RUNNING.includes(job.status)) {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <Button asChild size="sm" variant="outline">
          <Link href="/deliveries">{t("trackDelivery")}</Link>
        </Button>
      </div>
    );
  }

  if (ENDED.includes(job.status)) {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <Button type="button" size="sm" disabled={busy} onClick={() => repost.mutate(job.id)}>
          {repost.isPending ? t("working") : t("repost")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("repostHint")}</p>
      </div>
    );
  }

  if (job.status !== "open") return null;

  const run = () => {
    if (confirming === "edit") edit.mutate(job.id);
    if (confirming === "cancel") cancel.mutate(job.id);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => setConfirming("edit")}
      >
        {t("edit")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={busy}
        className="text-destructive"
        onClick={() => setConfirming("cancel")}
      >
        {t("cancel")}
      </Button>

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(confirming === "cancel" ? "cancelTitle" : "editTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(confirming === "cancel" ? "cancelBody" : "editBody")}
              {job.offersCount > 0 && ` ${t("offersWithdrawn", { count: job.offersCount })}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("keep")}</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirming === "cancel"
                  ? "bg-destructive text-white hover:bg-destructive/90"
                  : undefined
              }
              onClick={run}
            >
              {t(confirming === "cancel" ? "cancelConfirm" : "editConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
