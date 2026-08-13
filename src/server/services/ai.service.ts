/**
 * AI Service
 * Handles price recommendation and slip processing using OpenAI
 * 
 * Architecture: Service Layer (called by API routes, never directly from UI)
 */

import {
    getOpenAIClient,
    imageUrlToBase64DataUrl,
    isOpenAIAvailable,
} from "@/lib/ai/openai";
import type {
    AIPriceRecommendationInput,
    AIPriceRecommendationOutput,
    ProcessSlipOutput,
} from "@/server/dto/ai.dto";

// Model to use - gpt-4o-mini is cheap and fast
const MODEL = "gpt-4o-mini";

// ============================================
// Price Recommendation
// ============================================

/**
 * Build optimized prompt for price recommendation
 */
function buildPriceRecommendationPrompt(input: AIPriceRecommendationInput): string {
    const { form, slip, location } = input;

    let prompt = `You are a marketplace pricing expert specializing in second-hand goods and auctions.
Analyze this item and recommend optimal auction prices in EUR (€).

**Item Details:**
- Title: ${form.title}
- Category: ${form.category}
- Condition: ${form.condition.replace("_", " ")}
- Dimensions: ${form.dimensions.length}cm × ${form.dimensions.width}cm × ${form.dimensions.height}cm
- Weight Range: ${form.weight}kg
- Quantity: ${form.quantity}
${form.description ? `- Description: ${form.description}` : ""}

**Seller Location:**
- City: ${location.city || "Unknown"}
- Country: ${location.country || "Unknown"}
`;

    if (slip) {
        prompt += `
**Purchase Information (from receipt):**
${slip.originalPrice ? `- Original Purchase Price: €${slip.originalPrice}` : "- Original price: Unknown"}
${slip.purchaseDate ? `- Purchase Date: ${slip.purchaseDate}` : ""}
${slip.extractedDescription ? `- Receipt Description: ${slip.extractedDescription}` : ""}
`;
    }

    prompt += `
**Your Task:**
1. Estimate the current market value based on condition and category
2. **ANALYZE LOCAL MARKET TRENDS** for ${location.city || location.country || "this region"}:
   - Consider the economic situation and purchasing power in this location
   - Adjust pricing based on local demand for this category of items
   - Factor in whether this is a high-cost or low-cost region
   - Consider local competition and marketplace saturation
3. Calculate a starting bid that's attractive to encourage bidding (typically 20-40% of market value)
4. Calculate a buy now price that represents fair market value for THIS location
5. Consider shipping costs based on size/weight and location

**Response Format (JSON only, no markdown):**
{
  "recommendedStartingBid": <number>,
  "recommendedBuyNowPrice": <number>,
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation including market trend insights for the location, max 120 words>",
  "priceBreakdown": {
    "baseValue": <estimated current value>,
    "conditionAdjustment": <percentage, e.g., -30 for 30% reduction>,
    "categoryFactor": <1.0 for normal, higher/lower for premium/common>,
    "sizeFactor": <shipping cost impact factor>,
    "locationFactor": <0.8-1.2 based on local market, 1.0 = average>
  }
}

Important:
- Starting bid should be lower than buy now price
- Minimum starting bid: €5
- Minimum buy now price: €10
- Consider ${form.condition === "new" ? "full value" : "depreciation based on condition"}
- Adjust prices based on local market conditions in ${location.city || location.country || "the region"}
- Be realistic with market prices for this specific location`;

    return prompt;
}


/**
 * Parse AI response to extract JSON
 */
function parseAIJsonResponse(text: string): AIPriceRecommendationOutput | null {
    try {
        // Try to extract JSON from response (handle markdown code blocks)
        let jsonStr = text.trim();

        // Remove markdown code blocks if present
        if (jsonStr.startsWith("```json")) {
            jsonStr = jsonStr.slice(7);
        } else if (jsonStr.startsWith("```")) {
            jsonStr = jsonStr.slice(3);
        }
        if (jsonStr.endsWith("```")) {
            jsonStr = jsonStr.slice(0, -3);
        }

        jsonStr = jsonStr.trim();

        const parsed = JSON.parse(jsonStr);

        // Validate basic structure
        if (
            typeof parsed.recommendedStartingBid !== "number" ||
            typeof parsed.recommendedBuyNowPrice !== "number"
        ) {
            console.error("Invalid AI response structure:", parsed);
            return null;
        }

        // Ensure starting bid < buy now price
        if (parsed.recommendedStartingBid >= parsed.recommendedBuyNowPrice) {
            parsed.recommendedStartingBid = Math.round(parsed.recommendedBuyNowPrice * 0.4);
        }

        // Apply min/max constraints
        parsed.recommendedStartingBid = Math.max(5, Math.min(50000, parsed.recommendedStartingBid));
        parsed.recommendedBuyNowPrice = Math.max(10, Math.min(50000, parsed.recommendedBuyNowPrice));
        parsed.confidence = Math.max(0, Math.min(1, parsed.confidence || 0.5));

        return parsed as AIPriceRecommendationOutput;
    } catch (error) {
        console.error("Failed to parse AI response:", error);
        return null;
    }
}

/**
 * Calculate fallback prices using deterministic logic
 * Used when AI is unavailable or fails
 */
function calculateFallbackPrices(input: AIPriceRecommendationInput): AIPriceRecommendationOutput {
    const { form, slip } = input;

    // Base value estimation
    let baseValue = 100; // Default

    // Use original price if available
    if (slip?.originalPrice && slip.originalPrice > 0) {
        baseValue = slip.originalPrice;
    }

    // Condition multipliers
    const conditionMultipliers: Record<string, number> = {
        new: 0.9,
        used_like_new: 0.7,
        used_good: 0.5,
        used_fair: 0.3,
    };
    const conditionMult = conditionMultipliers[form.condition] || 0.5;

    // Category base values (for when no original price)
    const categoryBaseValues: Record<string, number> = {
        electronics: 150,
        furniture: 200,
        clothing: 50,
        vehicles: 1000,
        others: 100,
    };

    if (!slip?.originalPrice) {
        baseValue = categoryBaseValues[form.category] || 100;
    }

    // Calculate estimated market value
    const marketValue = Math.round(baseValue * conditionMult);

    // Starting bid at 30% of market value
    const startingBid = Math.max(5, Math.round(marketValue * 0.3));

    // Buy now at market value + small margin
    const buyNowPrice = Math.max(10, marketValue);

    return {
        recommendedStartingBid: startingBid,
        recommendedBuyNowPrice: buyNowPrice,
        confidence: 0.6,
        reasoning: `Estimated based on ${form.condition.replace("_", " ")} condition${slip?.originalPrice ? ` and original price €${slip.originalPrice}` : ""}. Starting bid set at 30% of estimated value to encourage bidding.`,
        priceBreakdown: {
            baseValue,
            conditionAdjustment: Math.round((conditionMult - 1) * 100),
            categoryFactor: 1,
            sizeFactor: 1,
        },
    };
}

/**
 * Get AI-powered price recommendation using OpenAI
 */
export async function recommendPrice(
    input: AIPriceRecommendationInput
): Promise<AIPriceRecommendationOutput> {
    // Check if OpenAI is available
    if (!isOpenAIAvailable()) {
        console.log("OpenAI not available, using fallback pricing");
        return calculateFallbackPrices(input);
    }

    const client = getOpenAIClient();
    if (!client) {
        return calculateFallbackPrices(input);
    }

    try {
        const prompt = buildPriceRecommendationPrompt(input);

        // Build messages with optional images
        const messages: Array<{
            role: "user";
            content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
        }> = [];

        // If we have photos, use vision
        if (input.photos.length > 0) {
            const photoPromises = input.photos.slice(0, 2).map((url) => imageUrlToBase64DataUrl(url));
            const photos = await Promise.all(photoPromises);
            const validPhotos = photos.filter((p): p is string => p !== null);

            if (validPhotos.length > 0) {
                const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
                    { type: "text", text: prompt },
                    ...validPhotos.map((photo) => ({
                        type: "image_url" as const,
                        image_url: { url: photo },
                    })),
                ];
                messages.push({ role: "user", content });
            } else {
                messages.push({ role: "user", content: prompt });
            }
        } else {
            messages.push({ role: "user", content: prompt });
        }

        const response = await client.chat.completions.create({
            model: MODEL,
            messages,
            temperature: 0.3,
            max_tokens: 1024,
        });

        const text = response.choices[0]?.message?.content || "";
        const parsed = parseAIJsonResponse(text);

        if (parsed) {
            return parsed;
        }

        console.error("Failed to parse AI response, using fallback");
        return calculateFallbackPrices(input);
    } catch (error) {
        console.error("AI recommendation failed:", error);
        return calculateFallbackPrices(input);
    }
}

// ============================================
// Slip Processing (OCR)
// ============================================

/**
 * Build prompt for slip/receipt OCR
 */
function buildSlipProcessingPrompt(): string {
    return `You are an expert OCR and data extraction specialist.
Analyze this purchase receipt/slip/bank transfer image and extract the following information if visible:

1. **Dimensions**: Look for length, width, height measurements (in cm or m)
2. **Weight**: Look for weight in kg or g  
3. **Price**: Look for total price, unit price, or amount (IMPORTANT: detect the currency!)
4. **Description**: Product name or description

**CRITICAL - Universal Currency Detection & Conversion:**
- DETECT the currency based on functionality, symbols (€, $, £, ¥, Rp, etc.), ISO codes (EUR, USD, IDR, GBP, etc.), or the language/country context of the receipt.
- "Rp" or "RP" or numbers like "250.000" (dot thousands) usually indicate Indonesian Rupiah (IDR).
- "$" can be USD, CAD, AUD, etc. - assume USD unless context implies otherwise.
- IF the detected currency is not EUR:
  - CONVERT the amount to EUR (Euro) using current approximate market exchange rates.
  - YOU MUST perform this conversion. The output price must be in EUR.

**Logic Examples:**
- "Rp 250.000" detected → Identify as IDR (~17,500/EUR) → Convert: 250,000 / 17,500 ≈ 14.29 → Output: 14.29
- "$100" detected → Identify as USD (~1.08/EUR) → Convert: 100 / 1.08 ≈ 92.59 → Output: 92.59
- "€50" detected → Already EUR → Output: 50
- "¥10,000" detected → Identify as JPY (~165/EUR) → Convert: 10000 / 165 ≈ 60.60 → Output: 60.60

**Response Format (JSON only, no markdown):**
{
  "dimensions": {
    "length": <number in cm or null>,
    "width": <number in cm or null>,
    "height": <number in cm or null>
  },
  "weight": "<weight as string, e.g., '25-50' for range, or '10' for exact, or null>",
  "price": <CONVERTED TO EUR as number or null>,
  "originalPrice": "<original price with currency as seen on receipt, e.g., 'Rp 250.000' or '€50'>",
  "description": "<product description or null>",
  "confidence": <0.0-1.0>
}

**Rules:**
- Convert measurements to cm if they're in meters
- ALWAYS convert price to EUR if in another currency
- Be conservative - only extract clearly visible information
- If this is a bank transfer/slip without product info, focus on the amount transferred`;
}

/**
 * Parse slip OCR response
 */
function parseSlipResponse(text: string): ProcessSlipOutput | null {
    try {
        let jsonStr = text.trim();

        // Remove markdown code blocks
        if (jsonStr.startsWith("```json")) {
            jsonStr = jsonStr.slice(7);
        } else if (jsonStr.startsWith("```")) {
            jsonStr = jsonStr.slice(3);
        }
        if (jsonStr.endsWith("```")) {
            jsonStr = jsonStr.slice(0, -3);
        }

        jsonStr = jsonStr.trim();
        const parsed = JSON.parse(jsonStr);

        const result: ProcessSlipOutput = {
            confidence: parsed.confidence || 0.5,
        };

        // Extract dimensions if valid
        if (parsed.dimensions) {
            const { length, width, height } = parsed.dimensions;
            if (length && width && height && length > 0 && width > 0 && height > 0) {
                result.dimensions = { length, width, height };
            }
        }

        // Extract weight
        if (parsed.weight) {
            result.weight = String(parsed.weight);
        }

        // Extract price
        if (typeof parsed.price === "number" && parsed.price > 0) {
            result.price = parsed.price;
        }

        // Extract description
        if (parsed.description && typeof parsed.description === "string") {
            result.description = parsed.description;
        }

        return result;
    } catch (error) {
        console.error("Failed to parse slip response:", error);
        return null;
    }
}

/**
 * Process slip/receipt image with OCR using OpenAI Vision
 */
export async function processSlip(imageBase64: string): Promise<ProcessSlipOutput> {
    // Check if OpenAI is available
    if (!isOpenAIAvailable()) {
        console.log("OpenAI not available for slip processing");
        return { confidence: 0 };
    }

    const client = getOpenAIClient();
    if (!client) {
        return { confidence: 0 };
    }

    try {
        const prompt = buildSlipProcessingPrompt();

        // Determine mime type (assume jpeg if not specified)
        const mimeType = imageBase64.startsWith("/9j/") ? "image/jpeg" : "image/png";
        const dataUrl = `data:${mimeType};base64,${imageBase64}`;

        const response = await client.chat.completions.create({
            model: MODEL,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: { url: dataUrl } },
                    ],
                },
            ],
            temperature: 0.2,
            max_tokens: 1024,
        });

        const text = response.choices[0]?.message?.content || "";
        const parsed = parseSlipResponse(text);

        if (parsed) {
            return parsed;
        }

        return { confidence: 0 };
    } catch (error) {
        console.error("Slip processing failed:", error);
        return { confidence: 0 };
    }
}

// ============================================
// Export Service Object
// ============================================

export const AIService = {
    recommendPrice,
    processSlip,
    isAvailable: isOpenAIAvailable,
};
