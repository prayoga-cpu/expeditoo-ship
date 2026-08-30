"use client";

import Link from "next/link";
import { Circle, CircleDot, FileCheck, Star } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import type { DeliveredRequest } from "../hooks/useMyRequests";

/**
 * One delivery the requester received.
 *
 * The transporter is the line this card exists for, so they lead it rather
 * than sitting in a footnote. The title links to the shipment, because that is
 * where the proof of delivery and the review form already live.
 */
export function DeliveredRequestCard({ job, delivery }: DeliveredRequest) {
  const t = useTranslations("myJobs.history");
  const format = useFormatter();
  const carrier = delivery.carrier;

  return (
    <Card className="transition-colors hover:border-primary/40">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-9 w-9 shrink-0">
              {/* The name is the visible line right beside this, so an alt
                  would only have a screen reader read it twice. */}
              {carrier?.image && <AvatarImage src={carrier.image} alt="" />}
              <AvatarFallback>
                {initial(carrier?.name) ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t("carrier")}</p>
              <p className="truncate font-semibold">
                {carrier?.name ?? t("unknownCarrier")}
              </p>
            </div>
          </div>

          {carrier && carrier.rating > 0 && (
            <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
              <span className="font-mono">{carrier.rating.toFixed(1)}</span>
            </span>
          )}
        </div>

        <div className="flex items-start justify-between gap-4 border-t border-border pt-3">
          <div className="min-w-0">
            <Link
              href={`/deliveries/${delivery.shipmentId}`}
              className="font-medium hover:underline"
            >
              {job.title}
            </Link>
            {delivery.deliveredAt && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("deliveredOn", {
                  date: format.dateTime(new Date(delivery.deliveredAt), {
                    dateStyle: "medium",
                  }),
                })}
              </p>
            )}
          </div>

          <span className="shrink-0 font-mono text-lg font-semibold">
            {formatCurrency(delivery.priceCents)}
          </span>
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <Circle className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="truncate">{job.pickupCity}</span>
          </div>
          <div className="flex items-center gap-2">
            <CircleDot className="h-3 w-3 shrink-0 text-primary" />
            <span className="truncate">{job.dropoffCity}</span>
          </div>
        </div>

        {(delivery.hasProofOfDelivery || job.origin === "expedion") && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {delivery.hasProofOfDelivery && (
              <Badge
                variant="outline"
                className="border-success/30 bg-success/10 text-success"
              >
                <FileCheck className="h-3.5 w-3.5" />
                {t("proof")}
              </Badge>
            )}
            {job.origin === "expedion" && (
              <Badge variant="secondary">via Expedion</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const initial = (name?: string) =>
  name?.trim() ? name.trim().charAt(0).toUpperCase() : undefined;
