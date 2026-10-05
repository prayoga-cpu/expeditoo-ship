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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDeleteDraft, useUnschedule } from "../hooks/useDraftActions";
import type { Job } from "../types";

interface DraftActionsProps {
  job: Pick<Job, "id" | "status">;
  /** Where to go once the request is deleted; the list just refreshes. */
  onDeleted?: () => void;
  className?: string;
  /** The confirmation's open state, when the caller holds it (tests do). */
  confirmOpen?: boolean;
  onConfirmOpenChange?: (open: boolean) => void;
}

/**
 * What a requester can do with a request nobody else has seen yet
 * (docs/specs/draft_requests_spec.md §1). Publishing always goes through the
 * form's Budget step: only the browser can re-derive a flexible window from
 * the requester's own clock, and that step shows when bids would close.
 *
 * Rendered outside the card's link — a button inside a link is not a button.
 */
export function DraftActions({
  job,
  onDeleted,
  className,
  confirmOpen,
  onConfirmOpenChange,
}: DraftActionsProps) {
  const t = useTranslations("myJobs.draft");
  const [ownConfirming, setOwnConfirming] = useState(false);
  const confirming = confirmOpen ?? ownConfirming;
  const setConfirming = onConfirmOpenChange ?? setOwnConfirming;
  const remove = useDeleteDraft(onDeleted);
  const unschedule = useUnschedule();
  const scheduled = job.status === "scheduled";
  const busy = remove.isPending || unschedule.isPending;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button asChild size="sm">
        <Link href={`/create?draft=${job.id}&step=budget${scheduled ? "&publish=now" : ""}`}>
          {t(scheduled ? "publishNow" : "publish")}
        </Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link href={`/create?draft=${job.id}`}>{t(scheduled ? "edit" : "resume")}</Link>
      </Button>
      {scheduled && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => unschedule.mutate(job.id)}
        >
          {t("unschedule")}
        </Button>
      )}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogTrigger asChild>
          <Button type="button" size="sm" variant="ghost" disabled={busy} className="text-destructive">
            {t("delete")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(scheduled ? "deleteScheduledTitle" : "deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("keep")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => remove.mutate(job.id)}
            >
              {t("confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
