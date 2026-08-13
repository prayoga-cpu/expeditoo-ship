/**
 * ============================================================================
 * SHIPPING ESTIMATE COMPONENT
 * ============================================================================
 *
 * Displays an estimated shipping cost based on origin/destination coordinates
 * and optional package dimensions. Used in checkout to give buyers an idea
 * of shipping costs before driver proposals come in.
 */

"use client";

import { useEffect } from "react";
import { useCalculatePrice, usePricingConfig } from "@/features/app/common/hooks";
import { Badge } from "@/components/ui/badge";
import { Calculator, Truck, Info } from "lucide-react";
import { LottieLoader } from "@/components/ui/lottie-loader";
import type { DeliverySpeed } from "@/lib/pricing/types";

interface ShippingEstimateProps {
    origin: {
        lat: number | null;
        lng: number | null;
    };
    destination: {
        lat: number | null;
        lng: number | null;
    };
    /** Optional package info (defaults to medium package) */
    packageInfo?: {
        length: number;
        width: number;
        height: number;
        weight: number;
    };
    /** Show compact version */
    compact?: boolean;
    /** Speed to calculate for */
    speed?: DeliverySpeed;
    /** Class name override */
    className?: string;
}

/**
 * Default package dimensions for estimation when not provided
 */
const DEFAULT_PACKAGE = {
    length: 40, // cm
    width: 30, // cm
    height: 20, // cm
    weight: 5, // kg
};

export function ShippingEstimate({
    origin,
    destination,
    packageInfo,
    compact = false,
    speed = "STANDARD",
    className = "",
}: ShippingEstimateProps) {
    const { calculate, result, isCalculating, error } = useCalculatePrice();
    const { deliverySpeeds } = usePricingConfig();

    // Calculate when we have valid coordinates
    useEffect(() => {
        if (
            origin.lat &&
            origin.lng &&
            destination.lat &&
            destination.lng
        ) {
            calculate({
                origin: {
                    lat: origin.lat,
                    lng: origin.lng,
                },
                destination: {
                    lat: destination.lat,
                    lng: destination.lng,
                },
                package: packageInfo || DEFAULT_PACKAGE,
                speed,
            });
        }
    }, [
        origin.lat,
        origin.lng,
        destination.lat,
        destination.lng,
        packageInfo,
        speed,
        calculate,
    ]);

    // Can't calculate if missing coordinates
    if (!origin.lat || !origin.lng || !destination.lat || !destination.lng) {
        return null;
    }

    // Loading state
    if (isCalculating) {
        return (
            <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
                <LottieLoader width={20} height={20} />
                <span className="text-sm">Calculating estimate...</span>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
                <Info className="w-4 h-4" />
                <span className="text-sm">Unable to estimate</span>
            </div>
        );
    }

    // No result yet
    if (!result) {
        return null;
    }

    // Compact version (one line)
    if (compact) {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <Calculator className="w-4 h-4 text-primary" />
                <span className="text-sm">
                    Est. shipping: <strong>€{result.breakdown.total.toFixed(2)}</strong>
                </span>
                <Badge variant="secondary" className="text-xs">
                    ~{result.distance.km.toFixed(0)} km
                </Badge>
            </div>
        );
    }

    // Full version with breakdown
    return (
        <div
            className={`rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-4 ${className}`}
        >
            <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-full bg-primary/10">
                    <Calculator className="w-4 h-4 text-primary" />
                </div>
                <div>
                    <h4 className="font-medium text-sm">Estimated Shipping Cost</h4>
                    <p className="text-xs text-muted-foreground">
                        Based on {result.distance.km.toFixed(1)} km distance
                    </p>
                </div>
            </div>

            <div className="flex items-baseline justify-between mb-3">
                <span className="text-3xl font-bold text-primary">
                    €{result.breakdown.total.toFixed(2)}
                </span>
                <Badge variant="outline" className="gap-1">
                    <Truck className="w-3 h-3" />
                    {result.estimatedDelivery.text}
                </Badge>
            </div>

            {/* Breakdown */}
            <div className="text-xs text-muted-foreground space-y-1 border-t pt-3">
                <div className="flex justify-between">
                    <span>Base Rate</span>
                    <span>€{result.breakdown.baseRate.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span>Distance ({result.distance.tier})</span>
                    <span>€{result.breakdown.distanceCost.toFixed(2)}</span>
                </div>
                {result.breakdown.weightCost > 0 && (
                    <div className="flex justify-between">
                        <span>Weight ({result.weight.tier})</span>
                        <span>€{result.breakdown.weightCost.toFixed(2)}</span>
                    </div>
                )}
                {result.breakdown.volumeCost > 0 && (
                    <div className="flex justify-between">
                        <span>Volume</span>
                        <span>€{result.breakdown.volumeCost.toFixed(2)}</span>
                    </div>
                )}
                {result.breakdown.speedSurcharge > 0 && (
                    <div className="flex justify-between">
                        <span>Speed Surcharge</span>
                        <span>€{result.breakdown.speedSurcharge.toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between">
                    <span>Platform Fee (10%)</span>
                    <span>€{result.breakdown.serviceFee.toFixed(2)}</span>
                </div>
            </div>

            {/* Note */}
            <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>
                    This is an estimate. Final price will depend on the driver&apos;s proposal.
                </span>
            </p>

            {/* Delivery speed options */}
            {deliverySpeeds.length > 1 && (
                <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground mb-2">
                        Other delivery options:
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {deliverySpeeds
                            .filter((s) => s.speed !== speed)
                            .slice(0, 2)
                            .map((s) => (
                                <Badge key={s.speed} variant="secondary" className="text-xs">
                                    {s.speed}: +€{s.surcharge.toFixed(2)}
                                </Badge>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
}
