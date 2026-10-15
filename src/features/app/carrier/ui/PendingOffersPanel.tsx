"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Gavel } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/page-loader";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
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
import { ApiError } from "@/lib/fetcher";
import {
  usePendingOffers,
  useWithdrawPendingOffer,
  type PendingOffer,
} from "../hooks/useCarrierTrips";
import { PendingOfferCard } from "./PendingOfferCard";
import { TripsLoadError } from "./TripsLoadError";

/** `GET /api/carrier/offers` answers this to an account without the carrier role. */
const NOT_A_CARRIER = "FORBIDDEN_NOT_CARRIER";

/**
 * « En attente de réponse »: the bids the carrier made that neither the
 * requester nor an operator has answered yet (client_feedback_2026_10_spec.md §5).
 */
export function PendingOffersPanel() {
  const t = useTranslations("carrier.trips.pending");
  const { data, isLoading, isError, error, refetch } = usePendingOffers();
  const withdraw = useWithdrawPendingOffer();
  const [confirming, setConfirming] = useState<PendingOffer | null>(null);

  if (isLoading) return <PageLoader className="xl:min-h-[50vh]" />;

  const offers = data ?? [];
  const notACarrier = error instanceof ApiError && error.code === NOT_A_CARRIER;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>

      {notACarrier ? (
        <CenteredEmptyState
          icon={Gavel}
          title={t("noCarrier.title")}
          description={t("noCarrier.description")}
        />
      ) : isError ? (
        <TripsLoadError onRetry={() => void refetch()} />
      ) : offers.length === 0 ? (
        <PendingOffersEmpty />
      ) : (
        <div className="grid gap-3">
          {offers.map((offer) => (
            <PendingOfferCard
              key={offer.id}
              offer={offer}
              isWithdrawing={withdraw.isPending && withdraw.variables === offer.id}
              onWithdraw={setConfirming}
            />
          ))}
        </div>
      )}

      <WithdrawConfirmDialog
        offer={confirming}
        onClose={() => setConfirming(null)}
        onConfirm={(offer) => withdraw.mutate(offer.id)}
      />
    </div>
  );
}

function PendingOffersEmpty() {
  const t = useTranslations("carrier.trips.pending.empty");

  return (
    <CenteredEmptyState
      icon={Gavel}
      title={t("title")}
      description={t("description")}
    >
      <Button asChild>
        {/* The board lives at /expedion; /home is the driver dashboard. */}
        <Link href="/expedion">{t("browse")}</Link>
      </Button>
    </CenteredEmptyState>
  );
}

/**
 * Asked first, as « Prévus » asks before deleting a trajet: a withdrawn bid
 * leaves the requester's list at once, and the card's two buttons sit side by
 * side on a phone.
 */
function WithdrawConfirmDialog({
  offer,
  onClose,
  onConfirm,
}: {
  offer: PendingOffer | null;
  onClose: () => void;
  onConfirm: (offer: PendingOffer) => void;
}) {
  const t = useTranslations("carrier.trips.pending.confirm");

  return (
    <AlertDialog open={offer !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (offer) onConfirm(offer);
              onClose();
            }}
          >
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
