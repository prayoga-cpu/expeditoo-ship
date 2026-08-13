/**
 * ============================================================================
 * EXPEDITOO PRICING ENGINE - CONFIGURATION
 * ============================================================================
 *
 * 🇫🇷 FRENCH MARKET RATES (Updated: December 2025)
 *
 * This file contains all configurable pricing constants for the shipping
 * cost calculator. All rates are based on French logistics market research.
 *
 * To adjust pricing, simply modify the values below. All changes will
 * automatically propagate throughout the pricing system.
 *
 * ⚠️  IMPORTANT: After modifying rates, test thoroughly with the
 *     /api/pricing/calculate endpoint to verify expected behavior.
 * ============================================================================
 */

import type { PricingConfig } from "./types";

/**
 * ============================================================================
 * MAIN PRICING CONFIGURATION
 * ============================================================================
 *
 * Modify these values to adjust pricing for your market.
 */
export const PRICING_CONFIG: PricingConfig = {
  // ---------------------------------------------------------------------------
  // BASE RATES
  // ---------------------------------------------------------------------------
  // These are the foundational rates that apply to every delivery.

  /**
   * Fixed base cost for any delivery (CENTS)
   * This covers: driver time, vehicle wear, platform overhead
   *
   * 💡 Typical range in France: €3.50 - €6.00
   */
  baseRate: 450, // 4.50 EUR

  /**
   * Platform service fee as a percentage (10 = 10%)
   * This is EXPEDITOO's commission on each delivery.
   *
   * 💡 Typical marketplace fees: 8% - 15%
   */
  serviceFeePercent: 10,

  /**
   * Minimum total price for any delivery (CENTS)
   * Even if calculated price is lower, this is the floor.
   *
   * 💡 Should cover base costs + minimum driver compensation
   */
  minPrice: 800, // 8.00 EUR

  // ---------------------------------------------------------------------------
  // LIMITS
  // ---------------------------------------------------------------------------
  // These limits define the boundaries of our service.

  /**
   * Maximum weight allowed per shipment (kg)
   * Packages exceeding this require special freight service.
   */
  maxWeight: 100,

  /**
   * Maximum distance for standard delivery (km)
   * Beyond this, customers should use freight services.
   */
  maxDistance: 1000,

  /**
   * Minimum distance threshold (km)
   * Origins and destinations closer than this are considered "same location".
   */
  minDistanceThreshold: 0.5,

  // ---------------------------------------------------------------------------
  // DISTANCE PRICING TIERS
  // ---------------------------------------------------------------------------
  // Rates decrease for longer distances (economies of scale).
  // Order matters! Tiers are evaluated from first to last.

  /**
   * Distance-based pricing tiers
   *
   * 💡 French market rates (per km):
   *    - Urban: €0.40 - €0.55
   *    - Suburban: €0.35 - €0.45
   *    - Regional: €0.28 - €0.38
   *    - Long-distance: €0.22 - €0.32
   */
  distanceTiers: [
    {
      maxKm: 20, // 0-20 km
      ratePerKm: 45, // Urban/local deliveries
      tier: "urban",
    },
    {
      maxKm: 50, // 20-50 km
      ratePerKm: 38, // Suburban deliveries
      tier: "suburban",
    },
    {
      maxKm: 100, // 50-100 km
      ratePerKm: 32, // Regional deliveries
      tier: "regional",
    },
    {
      maxKm: Infinity, // 100+ km
      ratePerKm: 28, // Long-distance deliveries
      tier: "long_distance",
    },
  ],

  // ---------------------------------------------------------------------------
  // WEIGHT PRICING TIERS
  // ---------------------------------------------------------------------------
  // Heavier packages cost more per kg due to handling difficulty.

  /**
   * Weight-based pricing tiers
   *
   * 💡 French market rates (per kg):
   *    - Light (0-5kg): Often included in base
   *    - Medium (5-15kg): €0.30 - €0.45
   *    - Heavy (15-30kg): €0.50 - €0.70
   *    - Very heavy (30kg+): €0.70 - €1.00
   */
  weightTiers: [
    {
      maxKg: 5, // 0-5 kg
      ratePerKg: 0.0, // Light packages (included in base rate)
      tier: "light",
    },
    {
      maxKg: 15, // 5-15 kg
      ratePerKg: 35, // Medium packages
      tier: "medium",
    },
    {
      maxKg: 30, // 15-30 kg
      ratePerKg: 55, // Heavy packages
      tier: "heavy",
    },
    {
      maxKg: Infinity, // 30+ kg
      ratePerKg: 80, // Very heavy packages
      tier: "very_heavy",
    },
  ],

  // ---------------------------------------------------------------------------
  // SPEED SURCHARGES
  // ---------------------------------------------------------------------------
  // Faster delivery = higher price.

  /**
   * Delivery speed surcharges
   *
   * 💡 French market surcharges:
   *    - Express (next-day): €6 - €12
   *    - Same-day: €12 - €20
   *    - Scheduled: €2 - €4 (small fee for flexibility)
   */
  speedSurcharges: [
    {
      speed: "STANDARD",
      surcharge: 0.0, // No surcharge
      estimateText: "3-5 jours ouvrés",
      minDays: 3,
      maxDays: 5,
    },
    {
      speed: "EXPRESS",
      surcharge: 850, // Next-day premium
      estimateText: "Livraison le lendemain",
      minDays: 1,
      maxDays: 1,
    },
    {
      speed: "SAME_DAY",
      surcharge: 1500, // Same-day premium
      estimateText: "Livraison le jour même",
      minDays: 0,
      maxDays: 0,
    },
    {
      speed: "SCHEDULED",
      surcharge: 250, // Small fee for scheduling
      estimateText: "Date choisie par le client",
      minDays: 1,
      maxDays: 14,
    },
  ],

  // ---------------------------------------------------------------------------
  // VOLUME PRICING
  // ---------------------------------------------------------------------------
  // Large but light items are charged by volume.

  /**
   * Rate per cubic meter (m³)
   *
   * 💡 French market: €15 - €25 per m³
   */
  volumeRatePerM3: 1800.0,

  /**
   * Volumetric weight divisor
   *
   * Industry standard: 5000 (for cm and kg)
   * Formula: (L × W × H in cm) / 5000 = volumetric weight in kg
   *
   * ⚠️ Only change if you understand volumetric calculations!
   */
  volumetricDivisor: 5000,

  // ---------------------------------------------------------------------------
  // CURRENCY
  // ---------------------------------------------------------------------------

  /**
   * Currency for all pricing
   *
   * Currently only EUR is supported.
   */
  currency: "EUR",
};

// ============================================================================
// HELPER EXPORTS
// ============================================================================

/**
 * Get distance rate for a specific distance
 * Returns the appropriate tier rate based on distance
 */
export function getDistanceRate(distanceKm: number): {
  rate: number;
  tier: string;
} {
  for (const tier of PRICING_CONFIG.distanceTiers) {
    if (distanceKm <= tier.maxKm) {
      return { rate: tier.ratePerKm, tier: tier.tier };
    }
  }
  // Fallback to highest tier
  const lastTier =
    PRICING_CONFIG.distanceTiers[PRICING_CONFIG.distanceTiers.length - 1];
  return { rate: lastTier.ratePerKm, tier: lastTier.tier };
}

/**
 * Get weight rate for a specific weight
 * Returns the appropriate tier rate based on weight
 */
export function getWeightRate(weightKg: number): {
  rate: number;
  tier: string;
} {
  for (const tier of PRICING_CONFIG.weightTiers) {
    if (weightKg <= tier.maxKg) {
      return { rate: tier.ratePerKg, tier: tier.tier };
    }
  }
  // Fallback to highest tier
  const lastTier =
    PRICING_CONFIG.weightTiers[PRICING_CONFIG.weightTiers.length - 1];
  return { rate: lastTier.ratePerKg, tier: lastTier.tier };
}

/**
 * Get speed surcharge for a specific speed option
 */
export function getSpeedSurcharge(speed: string): number {
  const option = PRICING_CONFIG.speedSurcharges.find((s) => s.speed === speed);
  return option ? option.surcharge : 0;
}

/**
 * Get full speed configuration for a specific speed option
 * Returns surcharge, estimateText, minDays, maxDays
 */
export function getSpeedConfig(speed: string):
  | {
      speed: string;
      surcharge: number;
      estimateText: string;
      minDays: number;
      maxDays: number;
    }
  | undefined {
  return PRICING_CONFIG.speedSurcharges.find((s) => s.speed === speed);
}
