"use client";

/**
 * AI Price Recommendation Card (Minimalist Version)
 * Displays AI-generated price recommendations with simple apply buttons
 */

import { Sparkles, Check, TrendingUp, Tag, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineLoader } from "@/components/ui/page-loader";
import { useTranslations } from "next-intl";
import type { AIPriceRecommendationOutput } from "@/server/dto/ai.dto";

interface AIPriceRecommendationCardProps {
    recommendation: AIPriceRecommendationOutput | null;
    isLoading: boolean;
    error: string | null;
    hasAttempted: boolean;
    hasSlip: boolean;
    onApplyStartingBid: () => void;
    onApplyBuyNowPrice: () => void;
    onGetRecommendation: () => void;
    appliedFields: { startingBid: boolean; buyNowPrice: boolean };
    // Props removed but kept for interface compatibility if needed upstream
    onRefresh?: () => void;
}

export function AIPriceRecommendationCard({
    recommendation,
    isLoading,
    error,
    hasAttempted,
    hasSlip,
    onApplyStartingBid,
    onApplyBuyNowPrice,
    onGetRecommendation,
    appliedFields,
}: AIPriceRecommendationCardProps) {
    const t = useTranslations("create.ai");

    // Not attempted state - Minimal button
    if (!hasAttempted && !isLoading) {
        return (
            <div className="mb-6">
                <Button
                    onClick={onGetRecommendation}
                    variant="outline"
                    className="w-full h-auto py-3 gap-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 text-primary"
                >
                    <Sparkles className="w-4 h-4" />
                    <div>
                        <span className="font-medium">{t("title")}</span>
                        <span className="block text-xs text-muted-foreground font-normal">
                            {hasSlip ? t("readyWithSlip") : t("noSlipDesc")}
                        </span>
                    </div>
                </Button>
            </div>
        );
    }

    // Loading state - Simple spinner
    if (isLoading) {
        return (
            <div className="mb-6 p-4 border rounded-xl bg-muted/20 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <InlineLoader size="sm" />
                <span>{t("loading")}</span>
            </div>
        );
    }

    // Error state - Simple alert
    if (error) {
        return (
            <div className="mb-6 p-4 border border-destructive/20 bg-destructive/5 rounded-xl flex items-center gap-3 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" />
                <span>{t("error")}</span>
                <Button
                    variant="link"
                    size="sm"
                    className="p-0 h-auto text-destructive underline ml-auto"
                    onClick={onGetRecommendation}
                >
                    {t("errorRetry")}
                </Button>
            </div>
        );
    }

    // Success state - Minimalist cards
    if (recommendation) {
        return (
            <div className="mb-6 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground px-1">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    {t("title")}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Starting Bid Card */}
                    <div className="p-3 border rounded-lg bg-card hover:bg-muted/10 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                <TrendingUp className="w-3 h-3" />
                                {t("startingBid")}
                            </span>
                            {appliedFields.startingBid && (
                                <span className="text-xs text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    {t("applied")}
                                </span>
                            )}
                        </div>

                        <div className="flex items-end justify-between gap-3">
                            <span className="text-xl font-bold">
                                €{recommendation.recommendedStartingBid.toFixed(2)}
                            </span>
                            {!appliedFields.startingBid && (
                                <Button
                                    onClick={onApplyStartingBid}
                                    variant="secondary"
                                    size="sm"
                                    className="h-7 text-xs px-2.5"
                                >
                                    {t("useThis")}
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Buy Now Price Card */}
                    <div className="p-3 border rounded-lg bg-card hover:bg-muted/10 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                <Tag className="w-3 h-3" />
                                {t("buyNowPrice")}
                            </span>
                            {appliedFields.buyNowPrice && (
                                <span className="text-xs text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    {t("applied")}
                                </span>
                            )}
                        </div>

                        <div className="flex items-end justify-between gap-3">
                            <span className="text-xl font-bold">
                                €{recommendation.recommendedBuyNowPrice.toFixed(2)}
                            </span>
                            {!appliedFields.buyNowPrice && (
                                <Button
                                    onClick={onApplyBuyNowPrice}
                                    variant="secondary"
                                    size="sm"
                                    className="h-7 text-xs px-2.5"
                                >
                                    {t("useThis")}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Reasoning - Minimal text */}
                <p className="text-xs text-muted-foreground px-1 leading-relaxed">
                    {recommendation.reasoning}
                </p>
            </div>
        );
    }

    return null;
}
