"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useTranslations } from "next-intl";
import { getStripe } from "@/lib/stripe-client";
import { getStripeAppearance } from "@/lib/stripe-appearance";
import { Button } from "@/components/ui/button";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { LottieLoader } from "@/components/ui/lottie-loader";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

/**
 * Apple Pay and Google Pay keep a card too, so they sit beside the card
 * fields where the device and the domain allow them. Nothing else is offered
 * here: a kept method is charged later as a card, and PayPal is chosen when
 * paying for a transport instead (payment_alternatives_spec.md §4).
 */
const SAVE_WALLETS = { applePay: "auto", googlePay: "auto" } as const;

function StripeForm({ onSuccess }: { onSuccess: () => void }) {
  const t = useTranslations("profile.paymentMethods.add");
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/profile/payment-methods`,
      },
      redirect: "if_required",
    });

    if (error) {
      // Stripe.js already words its refusal in the viewer's language.
      setErrorMessage(error.message || t("failed"));
      setIsProcessing(false);
    } else {
      toast.success(t("saved"));
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement options={{ wallets: SAVE_WALLETS }} />
      <p className="text-xs text-muted-foreground">{t("paypalHint")}</p>
      {errorMessage && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
          {errorMessage}
        </div>
      )}
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
      >
        {isProcessing ? (
          <>
            <LottieLoader width={20} height={20} className="mr-2" />
            {t("saving")}
          </>
        ) : (
          t("save")
        )}
      </Button>
    </form>
  );
}

/** The form's own setup intent, asked for again on « Réessayer ». */
function useSetupIntent() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/stripe/setup-intent", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setClientSecret(d.clientSecret);
      })
      .catch((err) => {
        console.error("Failed to fetch setup intent", err);
        setClientSecret(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return { clientSecret, loading, retry: load };
}

export function AddPaymentMethodForm() {
  const t = useTranslations("profile.paymentMethods.add");
  const { clientSecret, loading, retry } = useSetupIntent();
  const router = useRouter();
  const stripePromise = getStripe();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Ensure we're mounted before rendering Stripe (to get correct theme)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get appearance based on current theme
  const appearance = getStripeAppearance(resolvedTheme);

  return (
    <>
      <div className="flex items-start gap-2 mb-6">
        <Link href="/profile">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("cardTitle")}</CardTitle>
          <CardDescription>{t("cardDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {!stripePromise ? (
            <div className="p-4 text-destructive bg-destructive/10 rounded-md text-sm">
              {t("unavailable")}
            </div>
          ) : loading || !mounted ? (
            <div className="flex justify-center p-12">
              <LottieLoader width={40} height={40} />
            </div>
          ) : clientSecret ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance,
              }}
            >
              <StripeForm
                onSuccess={() => router.push("/profile/payment-methods")}
              />
            </Elements>
          ) : (
            // A failed setup intent was « refresh the page », in English, with
            // nothing to press (no_dead_ends_spec.md §4).
            <LoadErrorState
              onRetry={retry}
              back={{ href: "/profile/payment-methods", label: t("back") }}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
