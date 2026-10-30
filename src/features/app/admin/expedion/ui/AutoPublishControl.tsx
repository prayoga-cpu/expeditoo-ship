"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";

/** How long a resumed quote waits before publishing — the bridge's own window. */
const RESUME_AFTER_MS = 48 * 3_600_000;

/**
 * Parks a paid quote's automatic publication, or resumes it
 * (client_feedback_2026_10_29_spec.md §X1). The sweep publishes only quotes
 * whose `escalate_after` has passed, so clearing it parks the quote — nothing
 * is deleted, the client's payment stands, and « Publier » still works by
 * hand. Resuming gives it a fresh 48 h. Built for `a-111-02`, the 1 € test
 * quote that would otherwise reach the drivers the moment the scheduled jobs
 * switch on.
 */
export function AutoPublishControl({
  quoteId,
  escalateAfter,
}: {
  quoteId: string;
  escalateAfter: string | Date | null;
}) {
  const t = useTranslations("admin.expedion.autoPublish");
  const queryClient = useQueryClient();
  const parked = !escalateAfter;

  const change = useMutation({
    mutationFn: async (next: Date | null) => {
      const res = await fetch(`/api/expedion/quotes/${quoteId}/admin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escalateAfter: next ? next.toISOString() : null }),
      });
      const body = (await res.json()) as { success: boolean; error?: { message?: string } };
      if (!res.ok || !body.success) throw new Error(body.error?.message ?? t("failed"));
    },
    onSuccess: (_data, next) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "expedion"] });
      toast.success(next ? t("resumed") : t("paused"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">
        {parked ? t("parkedNote") : t("activeNote")}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={change.isPending}
        onClick={() =>
          change.mutate(parked ? new Date(Date.now() + RESUME_AFTER_MS) : null)
        }
      >
        {parked ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        {parked ? t("resume") : t("pause")}
      </Button>
    </div>
  );
}
