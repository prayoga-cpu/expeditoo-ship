"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeEuro } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { ThreadOfferContext } from "../types";
import { ThreadOfferDialog } from "./ThreadOfferDialog";

interface ThreadOfferActionProps {
  conversationId: string;
  context: ThreadOfferContext | null | undefined;
}

/**
 * The button in the composer, and the reason it is sometimes not there.
 *
 * Every branch below is decided on the server (`threadOffersService.contextFor`)
 * so nothing here re-derives a permission. That is why the control is correct
 * in `/messages`, `/driver/messages` and `/admin/support` with no per-shell
 * wiring: a pure driver has no carrier row and gets `NOT_A_CARRIER`, a support
 * thread is the standalone lane, and neither needs a client role list.
 *
 * A blocked state renders either a muted explanation or nothing at all - never
 * a disabled button, which invites a support ticket rather than answering one.
 */
export function ThreadOfferAction({
  conversationId,
  context,
}: ThreadOfferActionProps) {
  const t = useTranslations("messages.offer");
  const [open, setOpen] = useState(false);

  if (!context) return null;

  if (context.canOffer) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-full shrink-0"
          aria-label={t("button")}
          title={t("button")}
          onClick={() => setOpen(true)}
        >
          <BadgeEuro className="w-5 h-5" />
        </Button>
        <ThreadOfferDialog
          conversationId={conversationId}
          context={context}
          open={open}
          onOpenChange={setOpen}
        />
      </>
    );
  }

  return null;
}

/**
 * The muted line above the composer explaining an absent button.
 *
 * Split from the trigger because it belongs above the input row, not inside
 * it. Only the two states a sender can act on say anything; the rest - not a
 * carrier, not approved, own listing, listing closed - are silent, because
 * naming them would explain the product to someone who did not ask.
 */
export function ThreadOfferNotice({ context }: { context: ThreadOfferContext | null | undefined }) {
  const t = useTranslations("messages.offer");

  if (!context || context.canOffer) return null;

  if (context.blockedBy === "OFFER_LIVE") {
    return (
      <p className="px-4 md:px-6 pt-3 text-xs text-muted-foreground">
        {t("alreadyBid")}{" "}
        {/* On the job lane the live bid may have been placed from the job page,
            in which case this thread holds no card to withdraw from - so the
            way out has to be named. On the standalone lane the offer is always
            in this thread and its card carries Withdraw. */}
        {context.lane === "job" && (
          <Link
            href="/carrier/offers"
            className="underline underline-offset-2"
          >
            {t("manageOffers")}
          </Link>
        )}
      </p>
    );
  }

  if (context.blockedBy === "OFFER_SLOT_BURNT" && context.job) {
    return (
      <p className="px-4 md:px-6 pt-3 text-xs text-muted-foreground">
        {t("slotBurnt")}{" "}
        <Link
          href={`/listing/${context.job.id}`}
          className="underline underline-offset-2"
        >
          {t("card.viewJob")}
        </Link>
      </p>
    );
  }

  return null;
}
