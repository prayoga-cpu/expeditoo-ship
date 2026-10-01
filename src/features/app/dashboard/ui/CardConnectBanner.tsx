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
 * A nudge, not a warning. Neither posting nor accepting needs a saved card:
 * the requester types one into `AcceptPaymentDialog` when they accept a bid
 * (pay_at_accept_spec.md). This used to say they could not accept without
 * one, and the client said plainly that it should not be necessary — only
 * easier, which is what a saved card now is: one tap instead of a form.
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
