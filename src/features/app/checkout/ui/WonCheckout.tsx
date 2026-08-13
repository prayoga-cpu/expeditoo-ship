"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  MapPin,
  Package,
  Truck,
  CreditCard,
  CheckCircle,
  Clock,
  Plus,
  Home,
  Briefcase,
} from "lucide-react";
import { LottieLoader } from "@/components/ui/lottie-loader";
import Link from "next/link";
import { useWonCheckout } from "../hooks/useWonCheckout";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { ShippingEstimate } from "./ShippingEstimate";
import { fetchAddresses, type Address as ApiAddress } from "../api";
import { PageLoader, InlineLoader } from "@/components/ui/page-loader";
import { StripePaymentSection } from "./StripePaymentSection";
import { formatCurrency } from "@/lib/currency";
import { queryClient } from "@/lib/query-client";

interface WonCheckoutProps {
  listingId: string;
}

interface SavedAddress {
  id: string;
  label: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  isDefault: boolean;
  lat?: number | null;
  lng?: number | null;
}

export function WonCheckout({ listingId }: WonCheckoutProps) {
  const {
    order,
    isLoading,
    error,
    paymentStatus,
    setPaymentStatus,
    canSetAddress,
    canPay,
    isWaitingForProposals,
    isWaitingForSelection,
    isPaid,
    isDelivered,
    setDeliveryAddress,
    isSettingAddress,
    confirmPayment,
    isConfirmingPayment,
    itemImage,
    formattedItemPrice,
    formattedShippingPrice,
    formattedTotalPrice,
  } = useWonCheckout(listingId);

  // Loading state
  if (isLoading) {
    return <PageLoader variant="padded" />;
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-md mx-auto p-6 text-center pt-20">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">❌</span>
        </div>
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-8">
          {error instanceof Error
            ? error.message
            : "You don't have access to this order."}
        </p>
        <Link href="/my-bids">
          <Button className="w-full h-12 rounded-full">View My Bids</Button>
        </Link>
      </div>
    );
  }

  // Payment success state
  if (paymentStatus === "success" || isPaid) {
    return (
      <div className="max-w-md mx-auto p-6 text-center pt-20">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">
          {isDelivered ? "Item Delivered!" : "Payment Successful!"}
        </h1>
        <p className="text-muted-foreground mb-8">
          {isDelivered
            ? "Your item has been delivered. Thank you for your purchase!"
            : "Your payment has been confirmed. The driver will pick up your item soon."}
        </p>
        <div className="space-y-3">
          {order?.shipment?.id && (
            <Link href={`/deliveries/${order.shipment.id}`}>
              <Button className="w-full h-12 rounded-full">
                Track Delivery
              </Button>
            </Link>
          )}
          <Link href="/home">
            <Button variant="outline" className="w-full h-12 rounded-full mt-4">
              Return to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/my-bids"
          className="p-2 hover:bg-primary rounded-full transition-all"
        >
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold">Complete Your Order</h1>
      </div>

      {/* Item Card */}
      <div className="bg-card rounded-2xl p-4 border border-border/50 mb-6">
        <div className="flex gap-4">
          <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-muted flex-shrink-0">
            {itemImage ? (
              <Image
                src={itemImage}
                alt={order?.listing?.title || ""}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-foreground truncate">
              {order?.listing?.title}
            </h2>
            <p className="text-sm text-muted-foreground">Auction Win</p>
            <p className="text-primary font-bold mt-1">
              {order?.itemPrice ? formatCurrency(order.itemPrice) : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Status Steps */}
      <div className="bg-card rounded-2xl p-6 border border-border/50 mb-6">
        <h3 className="font-semibold mb-4">Order Progress</h3>
        <div className="space-y-4">
          <Step
            icon={<MapPin className="w-4 h-4" />}
            title="Delivery Address"
            description={order?.deliveryAddress || "Waiting for your address"}
            status={
              canSetAddress
                ? "current"
                : order?.deliveryAddress
                  ? "complete"
                  : "pending"
            }
          />
          <Step
            icon={<Truck className="w-4 h-4" />}
            title="Driver Selection"
            description={
              order?.shipment?.driver?.name
                ? `Driver: ${order.shipment.driver.name}`
                : isWaitingForProposals
                  ? "Waiting for driver proposals..."
                  : isWaitingForSelection
                    ? "Admin is selecting a driver..."
                    : "Pending"
            }
            status={
              order?.shipment?.driver
                ? "complete"
                : isWaitingForProposals || isWaitingForSelection
                  ? "current"
                  : "pending"
            }
          />
          <Step
            icon={<CreditCard className="w-4 h-4" />}
            title="Payment"
            description={
              canPay
                ? `Total: ${order?.totalPrice ? formatCurrency(order.totalPrice) : "—"}`
                : isPaid
                  ? "Payment confirmed"
                  : "Waiting for driver selection"
            }
            status={isPaid ? "complete" : canPay ? "current" : "pending"}
          />
        </div>
      </div>

      {/* Action Section */}
      {canSetAddress && (
        <AddressSelectionSection
          onSelectAddress={(data) => setDeliveryAddress(data)}
          isSettingAddress={isSettingAddress}
          listingId={listingId}
        />
      )}

      {(isWaitingForProposals || isWaitingForSelection) && (
        <div className="space-y-4 mb-6">
          <div className="bg-primary/5 rounded-2xl p-6 border border-primary/20 text-center">
            <Clock className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="font-semibold mb-2">
              {isWaitingForProposals
                ? "Waiting for Drivers"
                : "Selecting Best Driver"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isWaitingForProposals
                ? "Drivers are submitting their shipping proposals. You'll be notified when a driver is selected."
                : "Our team is reviewing proposals and will select the best driver for your delivery."}
            </p>
          </div>

          {/* Shipping Cost Estimate */}
          {order?.listing?.lat && order?.shipment?.destinationLat && (
            <ShippingEstimate
              origin={{
                lat: order.listing.lat,
                lng: order.listing.lng,
              }}
              destination={{
                lat: order.shipment.destinationLat,
                lng: order.shipment.destinationLng,
              }}
            />
          )}
        </div>
      )}

      {canPay && order?.id && order?.totalPrice && (
        <>
          {/* Order Summary - Price Breakdown */}
          <div className="bg-card rounded-2xl p-6 border border-border/50 mb-6">
            <h3 className="font-semibold mb-4">Order Summary</h3>
            <div className="space-y-3">
              {/* Item Price */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Item Price</span>
                <span className="font-medium">
                  {order.itemPrice ? formatCurrency(order.itemPrice) : "—"}
                </span>
              </div>

              {/* Shipping Price */}
              {order.shippingPrice && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-medium">
                    {formatCurrency(order.shippingPrice)}
                  </span>
                </div>
              )}

              {/* Service Fee Calculation */}
              {(() => {
                // Backend standard: 10% fee
                // We calculate it exactly as backend does to match Stripe charge
                const subtotal = order.itemPrice + (order.shippingPrice || 0);
                const FEE_PERCENT = 0.1; // 10%
                const serviceFee = Math.round(subtotal * FEE_PERCENT);
                const totalWithFee = subtotal + serviceFee;

                return (
                  <>
                    {/* Subtotal */}
                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">
                        {formatCurrency(subtotal)}
                      </span>
                    </div>

                    {/* Service Fee */}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Service Fee (10%)
                      </span>
                      <span className="font-medium">
                        {formatCurrency(serviceFee)}
                      </span>
                    </div>

                    {/* Total */}
                    <div className="flex justify-between pt-3 border-t">
                      <span className="font-semibold text-base">Total</span>
                      <span className="font-bold text-lg text-primary">
                        {formatCurrency(totalWithFee)}
                      </span>
                    </div>

                    {/* Payment Info */}
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">
                        💳 The total amount of {formatCurrency(totalWithFee)}{" "}
                        will be charged to your payment method.
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Payment Section - Using Calculated Total */}
          {(() => {
            const subtotal = order.itemPrice + (order.shippingPrice || 0);
            const serviceFee = Math.round(subtotal * 0.1);
            const totalWithFee = subtotal + serviceFee;

            return (
              <StripePaymentSection
                orderId={order.id}
                totalAmount={totalWithFee}
                onSuccess={() => {
                  setPaymentStatus("success");
                  queryClient.invalidateQueries({
                    queryKey: ["order", "listing", listingId],
                  });
                }}
              />
            );
          })()}
        </>
      )}
    </div>
  );
}

// Step component
function Step({
  icon,
  title,
  description,
  status,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: "pending" | "current" | "complete";
}) {
  return (
    <div className="flex gap-3">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          status === "complete"
            ? "bg-green-100 text-green-600"
            : status === "current"
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {status === "complete" ? <CheckCircle className="w-4 h-4" /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`font-medium ${status === "pending" ? "text-muted-foreground" : ""}`}
        >
          {title}
        </p>
        <p className="text-sm text-muted-foreground truncate">{description}</p>
      </div>
      {status === "current" && (
        <div className="flex-shrink-0">
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
            Current
          </span>
        </div>
      )}
    </div>
  );
}

// Address Selection Section
function AddressSelectionSection({
  onSelectAddress,
  isSettingAddress,
  listingId,
}: {
  onSelectAddress: (data: {
    address: string;
    lat?: string;
    lng?: string;
  }) => void;
  isSettingAddress: boolean;
  listingId: string;
}) {
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null
  );

  const { data: addresses = [], isLoading } = useQuery<ApiAddress[]>({
    queryKey: ["user-addresses"],
    queryFn: fetchAddresses,
  });

  const selectedAddress = addresses.find(
    (a: ApiAddress) => a.id === selectedAddressId
  );

  const formatAddress = (addr: SavedAddress) => {
    return `${addr.street}, ${addr.city}, ${addr.zip}, ${addr.country}`;
  };

  const handleConfirm = () => {
    if (selectedAddress) {
      onSelectAddress({
        address: formatAddress(selectedAddress),
        lat: selectedAddress.lat?.toString(),
        lng: selectedAddress.lng?.toString(),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl p-6 border border-border/50 mb-6 flex justify-center py-8">
        <InlineLoader size="md" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl p-6 border border-border/50 mb-6">
      <h3 className="font-semibold mb-4">Select Delivery Address</h3>

      {addresses.length > 0 ? (
        <div className="space-y-3 mb-4">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              onClick={() => setSelectedAddressId(addr.id)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selectedAddressId === addr.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-full ${
                    selectedAddressId === addr.id
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {addr.label.toLowerCase() === "home" ? (
                    <Home className="w-4 h-4" />
                  ) : (
                    <Briefcase className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{addr.label}</span>
                    {addr.isDefault && (
                      <span className="text-[10px] uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {addr.street}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {addr.city}, {addr.zip}
                  </p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedAddressId === addr.id
                      ? "border-primary"
                      : "border-muted-foreground/30"
                  }`}
                >
                  {selectedAddressId === addr.id && (
                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm mb-4">
          You don't have any saved addresses.
        </p>
      )}

      {/* Add New Address Link */}
      <Link
        href={`/profile/addresses/create?returnUrl=/checkout/won/${listingId}`}
        className="block"
      >
        <Button
          variant="outline"
          className="w-full h-12 border-dashed border-2 hover:border-primary hover:text-primary hover:bg-primary/5 gap-2"
        >
          <Plus className="w-4 h-4" />
          Add New Address
        </Button>
      </Link>

      {/* Confirm Button */}
      {addresses.length > 0 && (
        <Button
          onClick={handleConfirm}
          disabled={!selectedAddressId || isSettingAddress}
          className="w-full h-12 rounded-full mt-4"
        >
          {isSettingAddress ? (
            <>
              <LottieLoader width={20} height={20} className="mr-2" />
              Saving...
            </>
          ) : (
            "Use This Address"
          )}
        </Button>
      )}
    </div>
  );
}
