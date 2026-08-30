"use client";

import Link from "next/link";
import { Check, CheckCheck, Truck } from "lucide-react";
import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { parseDayString } from "@/lib/availability-window";
import type { ThreadOfferView } from "../types";
import { useThreadOffer } from "../hooks/useThreadOffer";

/**
 * What the card actually shows.
 *
 * On the job lane the bid is the truth - an operator awarding at /admin/awards
 * flips the winner's card to accepted and every rival's to rejected for free,
 * with no message rewrite and no realtime event. On the standalone lane the
 * thread offer's own status is all there is.
 */
type Shown = "pending" | "accepted" | "declined" | "withdrawn" | "rejected" | "expired";

const shownStatus = (offer: ThreadOfferView): Shown =>
  offer.offer ? offer.offer.status : offer.status;

const BADGE: Record<Shown, string> = {
  pending: "bg-muted text-muted-foreground border-border",
  accepted: "bg-success/15 text-success border-success/30",
  declined: "bg-destructive/10 text-destructive border-destructive/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  expired: "bg-destructive/10 text-destructive border-destructive/30",
  withdrawn: "bg-muted text-muted-foreground border-border",
};

interface ThreadOfferBubbleProps {
  conversationId: string;
  offer: ThreadOfferView;
  isOwn: boolean;
  timestamp: string;
  avatar?: string;
  readByOther?: boolean;
  /** Whether this viewer is who awards the underlying job. */
  viewerCanAward: boolean;
}

/**
 * An offer in the thread.
 *
 * Keeps `ChatBubble`'s rhythm exactly - same gap, same side, same avatar, same
 * timestamp and read ticks - but renders a bordered card. An own-side card
 * takes `border-primary/40` rather than inverting to `bg-primary`, which would
 * make the price unreadable, and every colour comes from the theme token map
 * so light and dark are one definition.
 */
export function ThreadOfferBubble({
  conversationId,
  offer,
  isOwn,
  timestamp,
  avatar,
  readByOther,
  viewerCanAward,
}: ThreadOfferBubbleProps) {
  const t = useTranslations("messages.offer");
  const tSlots = useTranslations("listing.bid.slots");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? fr : enUS;
  const { accept, decline, withdraw } = useThreadOffer(conversationId);

  const status = shownStatus(offer);
  const isPending = status === "pending";
  const isJobLane = offer.offer !== null;
  // The recipient decides. On the job lane awarding also has to be theirs to
  // do, which mirrors acceptOffer's own owner/operator fork.
  const canRespond = isPending && !isOwn && (!isJobLane || viewerCanAward);
  const busy = accept.isPending || decline.isPending || withdraw.isPending;

  return (
    <div className={cn("flex gap-3 mb-4", isOwn && "flex-row-reverse")}>
      {!isOwn && (
        <Avatar className="w-8 h-8 shrink-0 flex-none">
          <AvatarImage src={avatar} />
          <AvatarFallback className="bg-linear-to-br from-primary to-accent-pink text-white text-[10px]">
            ?
          </AvatarFallback>
        </Avatar>
      )}

      <div
        className={cn(
          "flex flex-col max-w-[19rem] sm:max-w-sm",
          isOwn && "items-end"
        )}
      >
        <div
          className={cn(
            "w-full rounded-2xl border bg-card p-4 space-y-3",
            isOwn ? "border-primary/40 rounded-br-none" : "border-border rounded-bl-none"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("card.title")}
            </span>
            <Badge variant="outline" className={BADGE[status]}>
              {t(`card.status.${status}`)}
            </Badge>
          </div>

          <p
            className={cn(
              "font-mono text-lg font-semibold tabular-nums text-foreground",
              status === "withdrawn" && "line-through text-muted-foreground"
            )}
          >
            {formatCurrency(offer.priceCents)}
          </p>

          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t("card.pickup")}</dt>
              <dd className="text-right text-foreground">
                {format(parseDayString(offer.pickupDay), "EEE d MMM", {
                  locale: dateLocale,
                })}{" "}
                — {tSlots(`slot.${offer.pickupSlot}`)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t("card.delivery")}</dt>
              <dd className="text-right text-foreground">
                {offer.deliveryLeadDays === 0
                  ? tSlots("leadSameDay")
                  : tSlots("leadDays", { count: offer.deliveryLeadDays })}
              </dd>
            </div>
          </dl>

          {offer.vehicle && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Truck className="h-3.5 w-3.5 shrink-0" />
              {[offer.vehicle.make, offer.vehicle.model]
                .filter(Boolean)
                .join(" ") || offer.vehicle.type.replace(/_/g, " ")}
            </p>
          )}

          {/* The row's own note, not the message text: when the sender wrote
              nothing the message carries a generated summary, and echoing it
              under the rows it summarises reads as a stutter. */}
          {offer.note && (
            <p className="text-sm text-foreground/90">{offer.note}</p>
          )}

          {/* A standalone offer moves no money and creates no shipment. Saying
              so is the honest half of putting the button on every thread. */}
          {!isJobLane && status === "accepted" && (
            <p className="text-xs text-muted-foreground">{t("card.noPayment")}</p>
          )}

          {canRespond && (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1"
                disabled={busy}
                onClick={() => accept.mutate(offer.id)}
              >
                {t("card.accept")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => decline.mutate(offer.id)}
              >
                {t("card.decline")}
              </Button>
            </div>
          )}

          {isPending && !isOwn && isJobLane && !viewerCanAward && (
            <p className="text-xs text-muted-foreground">
              {t("card.operatorDecides")}
            </p>
          )}

          {isPending && isOwn && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-muted-foreground"
              disabled={busy}
              onClick={() => withdraw.mutate(offer.id)}
            >
              {t("card.withdraw")}
            </Button>
          )}

          {offer.offer && (
            <Link
              href={`/listing/${offer.offer.listingId}`}
              className="block text-xs underline underline-offset-2 text-muted-foreground"
            >
              {t("card.viewJob")}
            </Link>
          )}
        </div>

        <div className="flex items-center gap-1 mt-1">
          <span className="text-xs text-muted-foreground">{timestamp}</span>
          {isOwn && (
            <span className="text-muted-foreground">
              {readByOther ? (
                <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
