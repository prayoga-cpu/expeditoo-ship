"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { LottieLoader } from "@/components/ui/lottie-loader";
import { useTheme } from "next-themes";

function AddCardForm({ onSuccess }: { onSuccess: () => void }) {
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
        return_url: `${window.location.origin}/profile`,
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
    <form onSubmit={handleSubmit} className="space-y-4">
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
            Saving...
          </>
        ) : (
          "Save Card"
        )}
      </Button>
    </form>
  );
}

interface AddPaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}

export function AddPaymentMethodDialog({
  open,
  onOpenChange,
  onAdded,
}: AddPaymentMethodDialogProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      fetch("/api/stripe/setup-intent", { method: "POST" })
        .then((r) => r.json())
        .then((d) => setClientSecret(d.clientSecret))
        .catch((err) => console.error("Failed to fetch setup intent", err));
    } else {
      setClientSecret(null);
    }
  }, [open]);

  const stripePromise = getStripe();
  const appearance = getStripeAppearance(resolvedTheme);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Card</DialogTitle>
        </DialogHeader>
        {!stripePromise ? (
          <div className="p-4 text-destructive bg-destructive/10 rounded-md text-sm">
            Configuration Error: Stripe Publishable Key is missing. Please check
            your environment variables and restart the server.
          </div>
        ) : clientSecret && mounted ? (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance,
            }}
          >
            <AddCardForm
              onSuccess={() => {
                onOpenChange(false);
                onAdded();
              }}
            />
          </Elements>
        ) : (
          <div className="flex justify-center p-8">
            <LottieLoader width={40} height={40} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
