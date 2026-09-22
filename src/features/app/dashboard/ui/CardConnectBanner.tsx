"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CreditCard } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * A requester with an open or awarded direct-origin listing and no saved
 * card, nudged toward /profile/payment-methods/create.
 *
 * Posting no longer requires a card. The charge still only happens when a
 * carrier is accepted (`chargeForShipment`), which throws
 * `PAYMENT_METHOD_REQUIRED` and reopens the listing (`compensateFailedAward`)
 * if there is still no card at that point — this banner is the advance
 * warning for a failure that would otherwise stay silent until someone
 * actually tries to accept a bid.
 */
export function CardConnectBanner() {
  const t = useTranslations("dashboard.cardNudge");

  return (
    <Alert>
      <CreditCard />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription>
        <p>{t("description")}</p>
        <Button asChild size="sm" variant="outline" className="mt-2 w-fit">
          <Link href="/profile/payment-methods/create">{t("action")}</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
