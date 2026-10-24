"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CheckCircle2, Send } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/fetcher";

interface RequestActivity {
  posted: number;
  taken: number;
}

/**
 * Two figures: how many requests this person has published, and how many a
 * transporter took (client feedback 2026-10-21, §D6). Shown on their own
 * profile and on the admin's view of them; the server refuses anyone else.
 */
export function RequestActivityCard({ userId }: { userId: string }) {
  const t = useTranslations("profile.activity");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["users", userId, "activity"],
    queryFn: () => api.get<RequestActivity>(`/api/users/${userId}/activity`),
  });

  // A failed read shows a dash, never a zero that would read as a fact
  // (CLAUDE.md gotcha 9).
  const figure = (value: number | undefined) =>
    isLoading || isError || value === undefined ? "—" : String(value);

  return (
    <Card data-testid="request-activity">
      <CardContent className="grid grid-cols-2 gap-4 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <Send className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="font-mono text-2xl leading-none font-semibold tabular-nums">
              {figure(data?.posted)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{t("posted")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
          <div>
            <p className="font-mono text-2xl leading-none font-semibold tabular-nums">
              {figure(data?.taken)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{t("taken")}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
