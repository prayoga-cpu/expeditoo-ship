"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaymentMethodSelector } from "./PaymentMethodSelector";
import { Plus, Home, Briefcase, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useCheckout } from "../hooks/useCheckout";
import { Stepper } from "@/components/Stepper";
import { fetchAddresses, type Address as ApiAddress } from "../api";
import { useTranslations } from "next-intl";
import { StripePaymentSection } from "./StripePaymentSection";
import { useRouter } from "next/navigation";
import { InlineLoader, PageLoader } from "@/components/ui/page-loader";

interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  isDefault: boolean;
}

export function Checkout({ auctionId }: { auctionId?: string }) {
  const t = useTranslations("checkout");
  const router = useRouter();

  const steps = [t("steps.address"), t("steps.payment")];
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAddress, setSelectedAddress] = useState<string>("");

  const {
    selectedPayment,
    setSelectedPayment,
    email,
    setEmail,
    status,
    orderTotal,
    item,
    order,
    isLoading,
    handleCheckout,
  } = useCheckout(auctionId);

  // Real addresses from API
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Fetch addresses from API on mount
  useEffect(() => {
    const loadAddresses = async () => {
      try {
        setIsLoadingAddresses(true);
        setAddressError(null);
        const data = await fetchAddresses();

        setAddresses(data || []);

        // Auto-select default address if exists
        const defaultAddr = data?.find((addr: ApiAddress) => addr.isDefault);
        if (defaultAddr) {
          setSelectedAddress(defaultAddr.id);
        } else if (data?.length > 0) {
          setSelectedAddress(data[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch addresses:", error);
        setAddressError(
          error instanceof Error ? error.message : "Failed to load addresses"
        );
      } finally {
        setIsLoadingAddresses(false);
      }
    };

    loadAddresses();
  }, []);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    } else {
      window.history.back();
    }
  };

  if (status === "confirming" || isLoading) {
    return <PageLoader variant="padded" />;
  }

  return (
    <div className="mx-auto p-4 md:p-6 min-h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={handlePrev}
          className="p-2 hover:bg-muted rounded-full transition-all duration-200 ease-out"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          {t("title")}
        </h1>
      </div>

      {/* Stepper */}
      <Stepper steps={steps} currentStep={currentStep} />

      {/* Step Content */}
      <div className="bg-card rounded-2xl p-6 md:p-8 shadow-sm border border-border/50 mb-6 space-y-8 flex-1">
        {currentStep === 0 && (
          <div className="space-y-6">
            {isLoadingAddresses ? (
              <div className="text-center py-8">
                <InlineLoader size="md" />
                <p className="text-muted-foreground mt-4">{t("loadingAddresses")}</p>
              </div>
            ) : addressError ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 text-center">
                <p className="text-destructive font-medium mb-2">
                  {t("errors.loadAddresses")}
                </p>
                <p className="text-sm text-muted-foreground">{addressError}</p>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  className="mt-4"
                >
                  {t("retry")}
                </Button>
              </div>
            ) : addresses.length === 0 ? (
              <div className="text-center py-8">
                <Home className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-semibold text-foreground mb-2">
                  {t("noAddresses.title")}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("noAddresses.subtitle")}
                </p>
                <Link
                  href={`/profile/addresses/create?returnUrl=/checkout/${auctionId || ""}`}
                >
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    {t("addAddress")}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-4">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className={`relative p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 group ${
                      selectedAddress === addr.id
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedAddress(addr.id)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-full ${selectedAddress === addr.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground group-hover:text-primary transition-colors"}`}
                        >
                          {addr.label.toLowerCase() === "home" ? (
                            <Home className="w-4 h-4" />
                          ) : (
                            <Briefcase className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {addr.label}
                            </span>
                            {addr.isDefault && (
                              <span className="text-[10px] uppercase tracking-wider font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                {t("default")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          selectedAddress === addr.id
                            ? "border-primary"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {selectedAddress === addr.id && (
                          <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                        )}
                      </div>
                    </div>
                    <div className="pl-[52px] text-sm text-muted-foreground space-y-1">
                      <p>{addr.street}</p>
                      <p>
                        {addr.city}, {addr.zip}
                      </p>
                      <p>{addr.country}</p>
                    </div>
                  </div>
                ))}

                <Link
                  href={`/profile/addresses/create?returnUrl=/checkout/${auctionId || ""}`}
                >
                  <Button
                    variant="outline"
                    className="w-full h-14 border-dashed border-2 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all gap-2 text-muted-foreground"
                  >
                    <Plus className="w-5 h-5" />
                    {t("addNewAddress")}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-8">
            {/* Order Summary */}
            <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
              <h2 className="font-bold text-foreground mb-4">
                {t("orderSummary")}
              </h2>

              {item && (
                <div className="flex items-center gap-4 mb-4 pb-4 border-b border-border/50">
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t("summary.auctionWin")}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2 mb-4 pb-4 border-b border-border/50">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("summary.itemPrice")}
                  </span>
                  <span className="text-foreground">
                    ${item ? item.price : orderTotal}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("summary.shippingFee")}
                  </span>
                  <span className="text-foreground">
                    ${item ? item.shippingFee : 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("summary.platformFee")}
                  </span>
                  <span className="text-foreground">$0</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-foreground">{t("total")}</span>
                <span className="text-2xl font-bold text-primary">
                  ${orderTotal}
                </span>
              </div>
            </div>

            {/* Email Input */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("emailReceipt.label")}
              </label>
              <Input
                type="email"
                placeholder={t("emailReceipt.placeholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl bg-muted/30 border-transparent focus:bg-background focus:border-primary transition-all"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {t("emailReceipt.hint")}
              </p>
            </div>

            {/* Secure Payment Section */}
            {order?.id && (
              <StripePaymentSection
                orderId={order.id}
                totalAmount={order.totalPrice || 0}
                onSuccess={() => router.push(`/checkout/${auctionId}/success`)}
              />
            )}

            {/* Security Notice */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
              <span>🔒</span>
              <p>{t("security")}</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons (Only for Step 1) */}
      {currentStep === 0 && (
        <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-sm p-4 -mx-4 md:static md:p-0 md:mx-0 md:bg-transparent mt-auto border-t border-border/50 md:border-0">
          <div className="space-y-2">
            <Button
              onClick={handleNext}
              disabled={
                !selectedAddress || isLoadingAddresses || addresses.length === 0
              }
              className="w-full h-12 rounded-full text-base font-bold"
            >
              {t("actions.continue")}
            </Button>

            <Button
              onClick={handlePrev}
              variant="outline"
              className="w-full h-12 rounded-full text-base font-bold bg-transparent"
            >
              {t("actions.back")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
