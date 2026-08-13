import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";

interface ExtractedData {
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  weight?: string;
  price?: number;
  description?: string;
  volume?: number; // in cm³
}

interface PriceEstimate {
  estimatedPrice: number;
  basePrice: number;
  volumeMultiplier: number;
  weightMultiplier: number;
  reasoning: string;
}

/**
 * Hook for AI slip processing and price estimation
 */
export function useAISlipProcessor() {
  const t = useTranslations("create.ai.reasoning");
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [priceEstimate, setPriceEstimate] = useState<PriceEstimate | null>(null);

  /**
   * Estimate price based on dimensions, volume, and weight
   */
  const estimatePrice = useCallback(
    (data: ExtractedData): PriceEstimate => {
      // Base price per cm³
      const BASE_PRICE_PER_CM3 = 0.001; // €0.001 per cm³
      const WEIGHT_MULTIPLIER = 0.5; // €0.5 per kg
      const MIN_PRICE = 10; // Minimum €10
      const MAX_PRICE = 1000; // Maximum €1000

      let volumeMultiplier = 0;
      let weightMultiplier = 0;
      let reasoning = "";

      // Calculate volume if dimensions are available
      if (data.dimensions) {
        const { length, width, height } = data.dimensions;
        const volume = length * width * height; // cm³
        volumeMultiplier = volume * BASE_PRICE_PER_CM3;
        reasoning += t("volume", {
          volume: volume.toFixed(0),
          price: "€" + BASE_PRICE_PER_CM3,
          total: "€" + volumeMultiplier.toFixed(2)
        }) + " ";
      }

      // Calculate weight multiplier
      if (data.weight) {
        const weightValue = parseWeight(data.weight);
        if (weightValue > 0) {
          weightMultiplier = weightValue * WEIGHT_MULTIPLIER;
          reasoning += t("weight", {
            weight: weightValue,
            price: "€" + WEIGHT_MULTIPLIER,
            total: "€" + weightMultiplier.toFixed(2)
          }) + " ";
        }
      }

      // Use original price from slip if available, otherwise calculate
      let estimatedPrice = data.price || 0;

      if (estimatedPrice === 0) {
        // Calculate estimated price
        estimatedPrice = volumeMultiplier + weightMultiplier;
        reasoning += t("estimatedTotal", { total: "€" + estimatedPrice.toFixed(2) }) + " ";
      } else {
        reasoning += t("usingSlipPrice", { total: "€" + estimatedPrice.toFixed(2) }) + " ";
      }

      // Apply min/max constraints
      if (estimatedPrice < MIN_PRICE) {
        reasoning += t("minPrice", { total: "€" + MIN_PRICE }) + " ";
        estimatedPrice = MIN_PRICE;
      } else if (estimatedPrice > MAX_PRICE) {
        reasoning += t("maxPrice", { total: "€" + MAX_PRICE }) + " ";
        estimatedPrice = MAX_PRICE;
      }

      return {
        estimatedPrice: Math.round(estimatedPrice * 100) / 100, // Round to 2 decimals
        basePrice: volumeMultiplier,
        volumeMultiplier,
        weightMultiplier,
        reasoning: reasoning.trim(),
      };
    },
    [t]
  );

  /**
   * Process extracted data and generate price estimate
   */
  const processExtractedData = useCallback(
    (data: ExtractedData) => {
      setExtractedData(data);

      // Calculate volume if dimensions exist
      if (data.dimensions) {
        const volume =
          data.dimensions.length *
          data.dimensions.width *
          data.dimensions.height;
        data.volume = volume;
      }

      // Generate price estimate
      const estimate = estimatePrice(data);
      setPriceEstimate(estimate);

      return {
        ...data,
        estimatedPrice: estimate.estimatedPrice,
      };
    },
    [estimatePrice]
  );

  return {
    isProcessing,
    extractedData,
    priceEstimate,
    processExtractedData,
    setIsProcessing,
  };
}

/**
 * Parse weight string to number (kg)
 * Handles formats like "25-50", "50+", "10", etc.
 */
function parseWeight(weight: string): number {
  // Remove "kg" if present
  const cleaned = weight.replace(/kg/gi, "").trim();

  // Handle ranges like "25-50"
  if (cleaned.includes("-")) {
    const [min, max] = cleaned.split("-").map(Number);
    return (min + max) / 2; // Return average
  }

  // Handle "50+" format
  if (cleaned.endsWith("+")) {
    return Number(cleaned.replace("+", "")) || 0;
  }

  // Try to parse as number
  return Number(cleaned) || 0;
}

