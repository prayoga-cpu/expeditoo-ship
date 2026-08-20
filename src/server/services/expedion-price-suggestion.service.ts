/**
 * ============================================================================
 * AI price suggestion — Expedion admin reprice flow
 * ============================================================================
 *
 * `expedionService.autoPrice` already prices most quotes deterministically on
 * creation. This exists for the ones that fall through — geocoding failed,
 * a dimension is missing, the bordereau describes something the formula
 * cannot see (fragility, a difficult pickup, several lots) — and for giving
 * the operator a documented second opinion instead of a blank field.
 *
 * It never writes to the quote. The engine estimate, when computable, is
 * handed to the model as an anchor so GPT-4.1 refines a number grounded in
 * the platform's own rate card rather than inventing one; when the engine
 * cannot price the job at all, the model estimates from the bordereau and
 * says what it had to guess. Publishing the price back onto the quote stays
 * a human act through `expedionService.adminUpdate`.
 */

import { z } from "zod";
import { getOpenAIClient, imageUrlToBase64DataUrl, isOpenAIAvailable } from "@/lib/ai/openai";
import { PRICING_CONFIG } from "@/lib/pricing/config";
import { expedionDal } from "@/server/dal/expedion.dal";
import { pricingService } from "@/server/services/pricing.service";
import {
  ExpedionError,
  adValoremInsuranceCents,
  geocodeFr,
  hasDimensions,
} from "@/server/services/expedion.service";
import type { ExpedionQuote } from "@/db/schema/expedion";
import type { BordereauExtraction } from "@/server/services/expedion-extraction.service";

const AI_MODEL = "gpt-4.1";

export interface PriceSuggestion {
  standardCents: number;
  insuredCents: number;
  reasoning: string;
  /** Things the model had to estimate because the quote/document did not say. */
  estimations: string[];
  confidence: number;
  source: "ai" | "engine";
}

interface EngineEstimate {
  cents: number;
  distanceKm: number;
  billableWeightKg: number;
  volumeM3: number;
}

// ========================================
// Engine anchor
// ========================================

/**
 * Read-only mirror of `expedionService.autoPrice`'s calculation — same
 * formula, but it never geocodes into persistence or touches the row. A
 * `null` return means the deterministic engine genuinely cannot price this
 * job (missing dimensions or ungeocodable addresses), which is exactly the
 * gap the AI suggestion is for.
 */
async function computeEngineEstimate(
  quote: ExpedionQuote
): Promise<EngineEstimate | null> {
  if (!hasDimensions(quote)) return null;

  const pickup =
    quote.pickupLat != null && quote.pickupLng != null
      ? { lat: quote.pickupLat, lng: quote.pickupLng }
      : await geocodeFr(quote.pickupAddress, quote.pickupPostalCode, quote.pickupCity);

  const dropoff =
    quote.deliveryLat != null && quote.deliveryLng != null
      ? { lat: quote.deliveryLat, lng: quote.deliveryLng }
      : await geocodeFr(quote.deliveryAddress, quote.deliveryPostalCode, quote.deliveryCity);

  if (!pickup || !dropoff) return null;

  try {
    const result = pricingService.calculatePrice({
      origin: pickup,
      destination: dropoff,
      package: {
        length: quote.lengthCm!,
        width: quote.widthCm!,
        height: quote.heightCm!,
        weight: quote.weightKg!,
      },
      speed: "STANDARD",
    });
    return {
      cents: Math.round(result.breakdown.total * 100),
      distanceKm: result.distance.km,
      billableWeightKg: result.weight.billable,
      volumeM3: result.volume.m3,
    };
  } catch {
    // Out of the engine's serviceable range (too far, too heavy) — the AI
    // path still has a documented opinion worth surfacing.
    return null;
  }
}

// ========================================
// Document parts
// ========================================

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail: "high" } }
  | { type: "file"; file: { filename: string; file_data: string } };

/** The bordereau plus up to two lot photos — capped for cost and latency. */
async function buildDocumentParts(quote: ExpedionQuote): Promise<ContentPart[]> {
  const urls = [quote.bordereauDocUrl, ...(quote.photoUrls ?? [])]
    .filter((u): u is string => !!u)
    .slice(0, 3);

  const parts: ContentPart[] = [];
  for (const url of urls) {
    const dataUrl = await imageUrlToBase64DataUrl(url);
    if (!dataUrl) continue;
    if (dataUrl.startsWith("data:application/pdf") || url.toLowerCase().endsWith(".pdf")) {
      parts.push({ type: "file", file: { filename: "bordereau.pdf", file_data: dataUrl } });
    } else {
      parts.push({ type: "image_url", image_url: { url: dataUrl, detail: "high" } });
    }
  }
  return parts;
}

// ========================================
// Prompt
// ========================================

const RATE_CARD = `Grille tarifaire de la plateforme (référence, pas à réciter) :
- Base fixe : ${PRICING_CONFIG.baseRate / 100} €
- Distance : 0-20 km ${PRICING_CONFIG.distanceTiers[0].ratePerKm / 100} €/km, 20-50 km ${PRICING_CONFIG.distanceTiers[1].ratePerKm / 100} €/km, 50-100 km ${PRICING_CONFIG.distanceTiers[2].ratePerKm / 100} €/km, 100+ km ${PRICING_CONFIG.distanceTiers[3].ratePerKm / 100} €/km
- Poids facturable (max du poids réel et du poids volumétrique L×l×h/5000) : 0-5 kg inclus, 5-15 kg ${PRICING_CONFIG.weightTiers[1].ratePerKg / 100} €/kg, 15-30 kg ${PRICING_CONFIG.weightTiers[2].ratePerKg / 100} €/kg, 30+ kg ${PRICING_CONFIG.weightTiers[3].ratePerKg / 100} €/kg
- Volume : ${PRICING_CONFIG.volumeRatePerM3 / 100} €/m³
- Frais de service : ${PRICING_CONFIG.serviceFeePercent}% du sous-total
- Prix plancher : ${PRICING_CONFIG.minPrice / 100} €`;

function describeQuote(quote: ExpedionQuote): string {
  const extraction = quote.extraction as BordereauExtraction | null;
  const lines = [
    `Maison de ventes : ${quote.auctionHouseName ?? "non renseignée"}`,
    `Enlèvement : ${[quote.pickupAddress, quote.pickupPostalCode, quote.pickupCity].filter(Boolean).join(", ") || "non renseigné"}`,
    `Livraison : ${[quote.deliveryAddress, quote.deliveryPostalCode, quote.deliveryCity].filter(Boolean).join(", ") || "non renseigné"}`,
    `Description du lot : ${quote.description ?? extraction?.lotDescription ?? "non renseignée"}`,
    `Dimensions (L×l×h) : ${quote.lengthCm ?? "?"} × ${quote.widthCm ?? "?"} × ${quote.heightCm ?? "?"} cm`,
    `Poids : ${quote.weightKg ?? "non renseigné"} kg`,
    `Emballage protégé demandé : ${quote.isProtected ? "oui" : "non"}`,
    `Valeur déclarée : ${quote.declaredValueCents != null ? `${quote.declaredValueCents / 100} €` : "non renseignée"}${quote.valueBracket ? ` (tranche Airtable : ${quote.valueBracket})` : ""}`,
  ];
  if (quote.storageDailyFeeCents) {
    lines.push(`Gardiennage facturé par la maison de ventes après franchise : ${quote.storageDailyFeeCents / 100} €/jour`);
  }
  return lines.join("\n");
}

function buildPrompt(quote: ExpedionQuote, engine: EngineEstimate | null): string {
  const parts = [
    "Tu es analyste tarifaire pour Expeditoo, une marketplace française de transport qui va chercher des lots achetés en salle des ventes chez l'acheteur.",
    "On te donne le devis et, si disponible, le bordereau d'adjudication scanné. Propose un prix de transport standard (hors assurance ad valorem, calculée séparément par la plateforme).",
    RATE_CARD,
    describeQuote(quote),
  ];

  if (engine) {
    parts.push(
      `Le moteur de tarification a calculé ${engine.cents / 100} € pour ce trajet (${engine.distanceKm} km, ${engine.billableWeightKg} kg facturables, ${engine.volumeM3} m³). ` +
        "Ce chiffre suit déjà la grille ci-dessus : garde-le comme base et ne l'ajuste que si le document ou la description justifie un écart (fragilité, accès difficile, lot volumineux ou multiple, emballage complexe). Explique tout écart dans ton raisonnement."
    );
  } else {
    parts.push(
      "Le moteur de tarification n'a pas pu calculer de prix automatique (coordonnées ou dimensions manquantes). Estime un prix raisonnable à partir de la grille ci-dessus, de la description et du document fourni, et liste dans `estimations` chaque valeur que tu as dû deviner (distance, poids, dimensions...) faute d'être renseignée."
    );
  }

  parts.push(
    "Réponds uniquement avec le JSON demandé. `standardEur` est un prix de transport réaliste en euros (nombre, pas de texte). `reasoning` est une explication concise en français (3-4 phrases maximum) que lira un opérateur avant de publier le prix. `estimations` liste les valeurs devinées faute d'être renseignées (tableau vide si tout était connu). `confidence` va de 0 à 1."
  );

  return parts.join("\n\n");
}

// ========================================
// Model call
// ========================================

const aiSuggestionSchema = z.object({
  standardEur: z.number().positive(),
  reasoning: z.string(),
  estimations: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    standardEur: { type: "number", description: "Prix de transport standard, en euros" },
    reasoning: { type: "string" },
    estimations: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
  },
  required: ["standardEur", "reasoning", "estimations", "confidence"],
} as const;

async function callModel(
  quote: ExpedionQuote,
  engine: EngineEstimate | null
): Promise<z.infer<typeof aiSuggestionSchema> | null> {
  const client = getOpenAIClient();
  if (!client) return null;

  const documentParts = await buildDocumentParts(quote);
  const prompt = buildPrompt(quote, engine);
  const content: ContentPart[] =
    documentParts.length > 0 ? [{ type: "text", text: prompt }, ...documentParts] : [{ type: "text", text: prompt }];

  const response = await client.chat.completions.create({
    model: AI_MODEL,
    temperature: 0.2,
    messages: [{ role: "user", content: content as never }],
    response_format: {
      type: "json_schema",
      json_schema: { name: "price_suggestion", strict: true, schema: JSON_SCHEMA as never },
    },
  });

  const text = response.choices[0]?.message?.content;
  if (!text) return null;

  const parsed = aiSuggestionSchema.safeParse(JSON.parse(text));
  return parsed.success ? parsed.data : null;
}

// ========================================
// Assembly
// ========================================

function withInsurance(
  quote: ExpedionQuote,
  standardCents: number,
  reasoning: string,
  estimations: string[],
  confidence: number,
  source: PriceSuggestion["source"]
): PriceSuggestion {
  const floored = Math.max(standardCents, PRICING_CONFIG.minPrice);
  return {
    standardCents: floored,
    insuredCents: floored + adValoremInsuranceCents(quote.declaredValueCents),
    reasoning,
    estimations,
    confidence,
    source,
  };
}

function engineOnlySuggestion(quote: ExpedionQuote, engine: EngineEstimate): PriceSuggestion {
  return withInsurance(
    quote,
    engine.cents,
    "Estimation automatique du moteur de tarification (distance et poids). L'analyse IA du document est indisponible pour le moment.",
    [],
    0.6,
    "engine"
  );
}

export const expedionPriceSuggestionService = {
  /**
   * Suggests a standard + ad valorem price for a quote, without writing
   * anything. Throws only when neither the AI path nor the deterministic
   * engine can produce a number — the same situation the operator faces
   * today, so the reprice dialog just falls back to manual entry.
   */
  async suggest(id: string): Promise<PriceSuggestion> {
    const quote = await expedionDal.getById(id);
    if (!quote) throw new ExpedionError("QUOTE_NOT_FOUND", 404);

    const engine = await computeEngineEstimate(quote).catch((e) => {
      console.error("[expedion] engine anchor failed", id, e);
      return null;
    });

    if (isOpenAIAvailable()) {
      try {
        const ai = await callModel(quote, engine);
        if (ai) {
          return withInsurance(
            quote,
            Math.round(ai.standardEur * 100),
            ai.reasoning,
            ai.estimations,
            ai.confidence,
            "ai"
          );
        }
      } catch (error) {
        console.error("[expedion] price suggestion failed", id, error);
      }
    }

    if (engine) return engineOnlySuggestion(quote, engine);

    throw new ExpedionError(
      "PRICE_SUGGESTION_UNAVAILABLE",
      503,
      "Suggestion indisponible pour le moment. Saisissez le prix manuellement."
    );
  },
};
