"use client";

import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { ArrowRight, MessageSquare, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { parseDayString } from "@/lib/availability-window";
import type { CarrierMatch } from "../api/carriers.api";

interface CarrierMatchCardProps {
  match: CarrierMatch;
  /** Only this row's button spins, so the pending state names the row tapped. */
  isContacting: boolean;
  /** Any contact in flight: opening two threads at once helps nobody. */
  disabled: boolean;
  onContact: (matchId: string) => void;
}

/**
 * What the carrier declared themselves to be at KYC, when they declared it.
 *
 * `null` renders **nothing**, and nothing is not a badge reading
 * « Particulier »: an empty `legal_form` means *not stated*, so a default would
 * be a claim about someone's legal status that nobody made. That is also why
 * the two Particuliers / Professionnels checkboxes the competitor screenshot
 * shows are not built — spec §4.4 and §4.5.
 *
 * Rendered as the carrier typed it, because it is their own declaration rather
 * than UI copy, and so belongs in neither message catalogue. The DTO bounds the
 * value; `max-w-36 truncate` bounds the layout and `title` keeps a clipped one
 * readable.
 */
function LegalFormBadge({ legalForm }: { legalForm: string | null }) {
  if (legalForm === null) return null;

  return (
    <Badge
      variant="outline"
      title={legalForm}
      className="max-w-36 shrink truncate font-normal"
    >
      {legalForm}
    </Badge>
  );
}

/**
 * One carrier who drives this job's trajet.
 *
 * A trajet is a declaration, never a commitment: nothing here says the carrier
 * is available for this job, only that they make the trip (spec §8). Cities,
 * run days and a declared legal form are the whole disclosure — no address, no
 * coordinates, no vehicle (spec §4.3).
 */
export function CarrierMatchCard({
  match,
  isContacting,
  disabled,
  onContact,
}: CarrierMatchCardProps) {
  const t = useTranslations("myJobs.carriers");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? fr : enUS;

  // From the ISO string's date half, parsed as local: a run stored at midnight
  // UTC read from a western timezone would otherwise name the day before.
  const runLabel = (iso: string) =>
    format(parseDayString(iso.slice(0, 10)), "EEE d MMM", {
      locale: dateLocale,
    });

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={match.avatarUrl ?? undefined} alt="" />
            <AvatarFallback>
              {match.displayName.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate font-semibold">{match.displayName}</p>

              <LegalFormBadge legalForm={match.legalForm} />
            </div>

            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
              <span className="font-mono">{match.rating.toFixed(1)}</span>
              <span>{t("reviews", { count: match.reviewCount })}</span>
            </div>

            <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
              <span className="truncate">{match.originCity}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{match.destinationCity}</span>
            </p>

            <p className="text-sm text-muted-foreground">
              {t("detour", { km: match.detourKm })}
            </p>

            {match.nextRuns.length > 0 && (
              <div className="pt-1">
                <p className="text-sm font-medium text-foreground">
                  {t("upcomingRuns")}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {match.nextRuns.map((run) => (
                    <Badge key={run} variant="secondary">
                      {runLabel(run)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <Button
          onClick={() => onContact(match.matchId)}
          disabled={disabled}
          className="shrink-0"
        >
          <MessageSquare className="h-4 w-4" />
          {isContacting ? t("contacting") : t("contact")}
        </Button>
      </div>
    </Card>
  );
}
