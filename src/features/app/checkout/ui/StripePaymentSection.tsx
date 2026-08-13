"use client";

import { formatCurrency } from "@/lib/currency";
import { useEffect, useState } from "react";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe-client";
import { getStripeAppearance } from "@/lib/stripe-appearance";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CreditCard, Plus, Check } from "lucide-react";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { toast } from "sonner";
import { InlineLoader } from "@/components/ui/page-loader";
import { useTheme } from "next-themes";
import Link from "next/link";

interface PaymentMethod {
  id: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
}

interface StripePaymentSectionProps {
  orderId: string;
  totalAmount: number; // in cents
  onSuccess: () => void;
}

// Brand icon component
function CardBrandIcon({ brand }: { brand: string }) {
  const brandLower = brand.toLowerCase();
  // Simple text-based display, could be enhanced with actual icons
  const brandColors: Record<string, string> = {
    visa: "text-blue-600",
    mastercard: "text-orange-500",
    amex: "text-blue-400",
    discover: "text-orange-400",
  };

  return (
    <span
      className={`text-xs font-bold uppercase ${brandColors[brandLower] || "text-muted-foreground"}`}
    >
      {brand}
    </span>
  );
}

// Saved card payment form
function SavedCardPaymentForm({
  orderId,
  paymentMethodId,
  amount,
  onSuccess,
}: {
  orderId: string;
  paymentMethodId: string;
  amount: number;
  onSuccess: () => void;
}) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayWithSavedCard = async () => {
    setIsProcessing(true);
    try {
      console.log("[Payment] Starting saved card payment for order:", orderId);
      const res = await fetch(`/api/orders/${orderId}/payment-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId }),
      });
      const data = await res.json();
      console.log("[Payment] Response:", data);

      if (data.error) {
        toast.error(data.error);
        setIsProcessing(false);
        return;
      }

      // Payment succeeded immediately
      if (data.status === "succeeded" || data.success) {
        toast.success("Payment successful!");
        onSuccess();
        return;
      }

      // Payment requires additional action (3D Secure, etc)
      if (
        data.status === "requires_action" ||
        data.status === "requires_confirmation"
      ) {
        toast.error(
          "This card requires additional authentication. Please use a different card or add a new one."
        );
        setIsProcessing(false);
        return;
      }

      // Fallback - if we got clientSecret but no success, something is wrong
      if (data.clientSecret) {
        console.log(
          "[Payment] Got clientSecret but not succeeded - may need 3DS"
        );
        toast.error(
          "Payment requires additional verification. Please try adding a new card."
        );
        setIsProcessing(false);
        return;
      }

      // Unknown response
      console.error("[Payment] Unknown response:", data);
      toast.error("Payment processing issue. Please try again.");
      setIsProcessing(false);
    } catch (err: any) {
      console.error("[Payment] Error:", err);
      toast.error(err.message || "Payment failed");
      setIsProcessing(false);
    }
  };

  return (
    <Button
      onClick={handlePayWithSavedCard}
      disabled={isProcessing}
      className="w-full h-12 rounded-full font-bold text-base"
    >
      {isProcessing ? (
        <>
          <LottieLoader width={20} height={20} className="mr-2" />
          Processing...
        </>
      ) : (
        `Pay ${formatCurrency(amount)}`
      )}
    </Button>
  );
}

// New card payment form using Stripe Elements
function NewCardPaymentForm({
  amount,
  onSuccess,
}: {
  amount: number;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success`,
      },
      redirect: "if_required",
    });

    if (error) {
      setErrorMessage(error.message || "Payment failed");
      setIsProcessing(false);
    } else {
      toast.success("Payment successful!");
      onSuccess();
      setIsProcessing(false);
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
        className="w-full h-12 rounded-full font-bold text-base"
      >
        {isProcessing ? (
          <>
            <LottieLoader width={20} height={20} className="mr-2" />
            Processing...
          </>
        ) : (
          `Pay ${formatCurrency(amount)}`
        )}
      </Button>
    </form>
  );
}

export function StripePaymentSection({
  orderId,
  totalAmount,
  onSuccess,
}: StripePaymentSectionProps) {
  const [savedCards, setSavedCards] = useState<PaymentMethod[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<string>("new"); // 'new' or paymentMethodId
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch saved cards
  useEffect(() => {
    const fetchSavedCards = async () => {
      try {
        const res = await fetch("/api/stripe/payment-methods");
        const data = await res.json();
        if (Array.isArray(data)) {
          setSavedCards(data);
          // Auto-select first saved card if available
          if (data.length > 0) {
            setSelectedMethod(data[0].id);
          }
        }
      } catch (e) {
        console.error("Failed to fetch saved cards:", e);
      } finally {
        setLoadingCards(false);
      }
    };

    fetchSavedCards();
  }, []);

  // Fetch client secret for new card (only when needed)
  useEffect(() => {
    if (selectedMethod !== "new") return;

    const fetchIntent = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/payment-intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}), // Empty body for new card
        });
        const data = await res.json();

        if (data.error) {
          setError(data.error);
        } else if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        }
      } catch (err: any) {
        setError(err.message || "Failed to initialize payment");
      }
    };

    fetchIntent();
  }, [orderId, selectedMethod]);

  if (loadingCards || !mounted) {
    return (
      <div className="bg-card rounded-2xl p-6 border border-border/50 mb-6">
        <h3 className="font-semibold mb-6">Payment Method</h3>
        <div className="py-8 flex justify-center">
          <InlineLoader />
        </div>
      </div>
    );
  }

  if (error && selectedMethod === "new") {
    return (
      <div className="bg-card rounded-2xl p-6 border border-border/50 mb-6">
        <h3 className="font-semibold mb-6">Payment Method</h3>
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
          <p className="font-medium">Payment Error</p>
          <p className="text-sm">{error}</p>
          <Button
            variant="outline"
            className="mt-2"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const stripePromise = getStripe();
  const appearance = getStripeAppearance(resolvedTheme);

  return (
    <div className="bg-card rounded-2xl p-6 border border-border/50 mb-6">
      <h3 className="font-semibold mb-6">Payment Method</h3>

      <RadioGroup
        value={selectedMethod}
        onValueChange={setSelectedMethod}
        className="space-y-3 mb-6"
      >
        {/* Saved Cards */}
        {savedCards.map((card) => (
          <div
            key={card.id}
            className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
              selectedMethod === card.id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/30"
            }`}
            onClick={() => setSelectedMethod(card.id)}
          >
            <RadioGroupItem value={card.id} id={card.id} />
            <Label
              htmlFor={card.id}
              className="flex-1 flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="bg-muted p-2 rounded">
                  <CreditCard className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardBrandIcon brand={card.card.brand} />
                    <span className="font-medium">•••• {card.card.last4}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Expires {card.card.exp_month}/{card.card.exp_year}
                  </span>
                </div>
              </div>
              {selectedMethod === card.id && (
                <Check className="w-5 h-5 text-primary" />
              )}
            </Label>
          </div>
        ))}

        {/* Add New Card Option */}
        <div
          className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
            selectedMethod === "new"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/30"
          }`}
          onClick={() => setSelectedMethod("new")}
        >
          <RadioGroupItem value="new" id="new" />
          <Label
            htmlFor="new"
            className="flex-1 flex items-center gap-3 cursor-pointer"
          >
            <div className="bg-muted p-2 rounded">
              <Plus className="w-5 h-5 text-muted-foreground" />
            </div>
            <span className="font-medium">Add new card</span>
          </Label>
        </div>
      </RadioGroup>

      {/* Payment Action */}
      {selectedMethod === "new" ? (
        // New card form with Stripe Elements
        clientSecret && stripePromise ? (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance,
            }}
          >
            <NewCardPaymentForm amount={totalAmount} onSuccess={onSuccess} />
          </Elements>
        ) : (
          <div className="py-4 flex justify-center">
            <InlineLoader size="sm" />
          </div>
        )
      ) : (
        // Saved card payment
        <SavedCardPaymentForm
          orderId={orderId}
          paymentMethodId={selectedMethod}
          amount={totalAmount}
          onSuccess={onSuccess}
        />
      )}

      <p className="text-xs text-muted-foreground text-center mt-4">
        🔒 Encrypted & Secure Payment via Stripe
      </p>

      {savedCards.length === 0 && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          Want to save cards for faster checkout?{" "}
          <Link
            href="/profile/payment-methods"
            className="text-primary hover:underline"
          >
            Manage payment methods
          </Link>
        </p>
      )}
    </div>
  );
}
