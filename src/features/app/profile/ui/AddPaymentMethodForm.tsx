"use client";

import { useState, useEffect } from "react";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe-client";
import { getStripeAppearance } from "@/lib/stripe-appearance";
import { Button } from "@/components/ui/button";
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

function StripeForm({ onSuccess }: { onSuccess: () => void }) {
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
      setErrorMessage(error.message || "Failed to setup card");
      setIsProcessing(false);
    } else {
      toast.success("Card added successfully");
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
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
            Saving secured card...
          </>
        ) : (
          "Save Card"
        )}
      </Button>
    </form>
  );
}

export function AddPaymentMethodForm() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const stripePromise = getStripe();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Ensure we're mounted before rendering Stripe (to get correct theme)
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetch("/api/stripe/setup-intent", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setClientSecret(d.clientSecret);
      })
      .catch((err) => {
        console.error("Failed to fetch setup intent", err);
        toast.error("Failed to initialize payment setup");
      })
      .finally(() => setLoading(false));
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
          <h1 className="text-3xl font-bold tracking-tight">Add New Card</h1>
          <p className="text-muted-foreground mt-1">
            Securely save your card for future purchases.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Card Details</CardTitle>
          <CardDescription>
            Your card information is encrypted and stored securely by Stripe. We
            do not store your card details on our servers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!stripePromise ? (
            <div className="p-4 text-destructive bg-destructive/10 rounded-md text-sm">
              Configuration Error: Stripe Publishable Key is missing. Please
              check your environment variables and restart the server.
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
            <div className="text-center text-muted-foreground p-8">
              Failed to load payment form. Please try refreshing the page.
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
