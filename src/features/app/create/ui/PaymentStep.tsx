"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { getStripe } from "@/lib/stripe-client";
import { getStripeAppearance } from "@/lib/stripe-appearance";

/**
 * The card a job is charged to, collected before the job goes on the board.
 *
 * Nothing is taken here. The amount is the winning offer, which does not exist
 * yet — carriers have not bid. This step collects *permission* to charge, and
 * the charge happens the moment a carrier is chosen
 * (docs/specs/payment_at_booking_spec.md §7).
 *
 * It exists on `/create` rather than at the award because a job with no card is
 * a job that cannot be awarded, and finding that out at the award means telling
 * a driver who already won that the money was never there.
 */

/** The fields of a Stripe PaymentMethod this step actually renders. */
type SavedCard = {
  id: string;
  card?: { brand?: string; last4?: string } | null;
};

interface PaymentStepProps {
  /** Told upward so the form can gate "Post request" on a card being on file. */
  onCardChange: (hasCard: boolean) => void;
}

export function PaymentStep({ onCardChange }: PaymentStepProps) {
  const t = useTranslations("create.payment");
  const { resolvedTheme } = useTheme();
  const [card, setCard] = useState<SavedCard | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCards = useCallback(async () => {
    try {
      const res = await fetch("/api/stripe/payment-methods");
      const data: unknown = await res.json();
      const first = Array.isArray(data) ? (data[0] as SavedCard | undefined) : undefined;

      setCard(first ?? null);
      onCardChange(Boolean(first));
      return Boolean(first);
    } catch (error) {
      console.error("Failed to load payment methods", error);
      setCard(null);
      onCardChange(false);
      return false;
    }
  }, [onCardChange]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const found = await loadCards();
      // The SetupIntent is only opened when there is nothing to charge. Asking
      // for one on every visit would create a live intent for someone who
      // already has a card and is only passing through the step.
      if (!found && !cancelled) {
        try {
          const res = await fetch("/api/stripe/setup-intent", { method: "POST" });
          const data = await res.json();
          if (!cancelled) setClientSecret(data.clientSecret ?? null);
        } catch (error) {
          console.error("Failed to open a setup intent", error);
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [loadCards]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <LottieLoader />
      </div>
    );
  }

  if (card) {
    return (
      <div className="space-y-4">
        <StepHeading title={t("title")} description={t("savedDescription")} />

        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-4">
          <CreditCard className="size-5 shrink-0 text-muted-foreground" />
          <div className="text-sm">
            <p className="font-medium capitalize">
              {card.card?.brand ?? t("cardFallback")} •••• {card.card?.last4 ?? "----"}
            </p>
            <p className="text-muted-foreground">{t("chargedLater")}</p>
          </div>
        </div>
      </div>
    );
  }

  const stripePromise = getStripe();

  if (!stripePromise || !clientSecret) {
    return (
      <div className="space-y-4">
        <StepHeading title={t("title")} description={t("description")} />
        <p className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {t("unavailable")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StepHeading title={t("title")} description={t("description")} />

      <Elements
        stripe={stripePromise}
        options={{ clientSecret, appearance: getStripeAppearance(resolvedTheme) }}
      >
        <CardForm onSaved={loadCards} />
      </Elements>
    </div>
  );
}

function StepHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function CardForm({ onSaved }: { onSaved: () => Promise<boolean> }) {
  const t = useTranslations("create.payment");
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!stripe || !elements) return;

    setSaving(true);
    // `redirect: "if_required"` keeps a plain card on the page. A method that
    // genuinely needs a redirect leaves and comes back to `/create`, where the
    // form starts over — which is why this step only offers cards.
    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: `${window.location.origin}/create` },
      redirect: "if_required",
    });

    if (error) {
      toast.error(error.message ?? t("saveFailed"));
      setSaving(false);
      return;
    }

    await onSaved();
    toast.success(t("saved"));
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <PaymentElement />
      <Button
        type="button"
        onClick={handleSave}
        disabled={!stripe || saving}
        className="w-full"
      >
        {saving ? t("saving") : t("saveCard")}
      </Button>
    </div>
  );
}
