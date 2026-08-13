# AI Price Recommendation Specification

## Overview

This feature provides intelligent price recommendations for auction listings by analyzing:
1. **Slip/Receipt Data** (OCR extracted) - Original purchase price, dimensions, weight
2. **Form Data** - User-entered item details, category, condition, photos
3. **Visual Analysis** - Product photos for quality assessment

The AI outputs two price recommendations:
- **Recommended Starting Bid**: Attractive entry price to encourage bidding
- **Recommended Buy Now Price**: Fair market value for immediate purchase

---

## User Flow

### Step 1: Item Details
User fills in:
- Photos (required, max 5)
- Purchase slip (optional) → OCR extracts: dimensions, weight, original price
- Title/Designation
- Category
- Condition (new, used_like_new, used_good, used_fair)
- Weight range
- Dimensions (L×W×H)

### Step 2: Pickup/Logistics
User provides:
- Pickup location (via map or manual input)
- City, Postal Code, Country

### Step 3: Pricing & Summary
- **On entering this step**: AI recommendation is triggered automatically
- **While loading**: Show skeleton/shimmer animation
- **On success**: Display AI recommendation card with suggested prices
- **User can accept or modify** the recommended prices

---

## AI Input Schema

```typescript
interface AIPriceRecommendationInput {
  // From Slip (OCR) - optional
  slip?: {
    originalPrice?: number;      // €
    purchaseDate?: string;       // ISO date if extractable
    extractedDimensions?: {
      length: number;
      width: number;
      height: number;
    };
    extractedWeight?: string;
    extractedDescription?: string;
  };

  // From Form - required
  form: {
    title: string;
    category: string;            // electronics, furniture, clothing, vehicles, others
    condition: string;           // new, used_like_new, used_good, used_fair
    weight: string;              // "0-5", "5-10", "10-25", "25-50", "50+"
    dimensions: {
      length: number;            // cm
      width: number;             // cm
      height: number;            // cm
    };
    quantity: number;
    description?: string;        // Additional info
  };

  // Location
  location: {
    city: string;
    country: string;
  };

  // Photos - URLs
  photos: string[];              // Max 5, will send first 2 to AI for cost efficiency
}
```

---

## AI Output Schema

```typescript
interface AIPriceRecommendationOutput {
  recommendedStartingBid: number;   // € - suggested starting price
  recommendedBuyNowPrice: number;   // € - suggested buy now price
  confidence: number;               // 0-1 score
  reasoning: string;                // Human-readable explanation
  priceBreakdown?: {
    baseValue: number;              // Estimated base value
    conditionAdjustment: number;    // % adjustment for condition
    categoryFactor: number;         // Category multiplier
    sizeFactor: number;             // Size/shipping impact
  };
}
```

---

## API Endpoint

### POST `/api/ai/recommend-price`

**Request:**
```json
{
  "slip": {
    "originalPrice": 400,
    "extractedDimensions": { "length": 160, "width": 78, "height": 48 }
  },
  "form": {
    "title": "IKEA MALM Dresser",
    "category": "furniture",
    "condition": "used_good",
    "weight": "25-50",
    "dimensions": { "length": 160, "width": 78, "height": 48 },
    "quantity": 1,
    "description": "White oak, minor scratches"
  },
  "location": {
    "city": "Paris",
    "country": "France"
  },
  "photos": ["https://r2.example.com/photo1.jpg", "https://r2.example.com/photo2.jpg"]
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "recommendedStartingBid": 120,
    "recommendedBuyNowPrice": 220,
    "confidence": 0.85,
    "reasoning": "Based on original price €400, used-good condition typically retains 45-55% value. IKEA MALM dressers have stable resale demand. Starting bid set at 30% to encourage competitive bidding."
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": {
    "code": "AI_PROCESSING_FAILED",
    "message": "Unable to generate recommendation"
  }
}
```

---

## UI/UX Specification

### Step 3: Pricing Page Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  [←] Create Auction                                                 │
│  ════════════════════════════════════════════════════════════════   │
│  ● Item ──────● Logistics ──────● Summary                           │
│                                      ↑ (current)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ✨ AI Price Recommendation                                  │   │
│  │  ─────────────────────────────────────────────────────────   │   │
│  │                                                             │   │
│  │  ┌──────────────────┐    ┌──────────────────┐              │   │
│  │  │  Starting Bid    │    │  Buy Now Price   │              │   │
│  │  │    €120          │    │    €220          │              │   │
│  │  │  [Use This ✓]    │    │  [Use This ✓]    │              │   │
│  │  └──────────────────┘    └──────────────────┘              │   │
│  │                                                             │   │
│  │  💡 "Based on IKEA MALM furniture in good condition,        │   │
│  │      we recommend starting at 30% of estimated value..."    │   │
│  │                                                             │   │
│  │  Confidence: ████████░░ 85%                                 │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Starting Price *                         Buy Now Price (optional)  │
│  ┌─────────────────────────┐              ┌─────────────────────┐   │
│  │ € 120                   │              │ € 220               │   │
│  └─────────────────────────┘              └─────────────────────┘   │
│  AI Recommended: €120                      AI Recommended: €220     │
│                                                                     │
│  Auction Duration                                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 7 days                                                  [▼] │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Additional Information                                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │ White oak veneer dresser with 6 drawers...                  │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  [        Create Auction        ]                                   │
│  [           ← Back             ]                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### AI Recommendation Card States

#### 1. Loading State
```
┌─────────────────────────────────────────────────────────────────┐
│  ✨ AI Price Recommendation                                      │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│  [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]              │
│  Analyzing your item...                                          │
│                                                                  │
│  We're looking at:                                               │
│  • Product photos ✓                                              │
│  • Item details ✓                                                │
│  • Market trends...                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 2. Success State
```
┌───────────────────────────────────────────────────────────────────┐
│  ✨ AI Price Recommendation                            [Refresh ↻]│
│  ─────────────────────────────────────────────────────────────────│
│                                                                   │
│  ┌─────────────────────────┐   ┌─────────────────────────┐       │
│  │  💰 Starting Bid        │   │  🏷️ Buy Now Price       │       │
│  │                         │   │                         │       │
│  │      €120               │   │      €220               │       │
│  │                         │   │                         │       │
│  │  ┌─────────────────┐   │   │  ┌─────────────────┐   │       │
│  │  │   Use This ✓    │   │   │  │   Use This ✓    │   │       │
│  │  └─────────────────┘   │   │  └─────────────────┘   │       │
│  └─────────────────────────┘   └─────────────────────────┘       │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ 💡 Based on original price €400 and good condition, IKEA    │ │
│  │    MALM furniture typically retains 45-55% resale value.    │ │
│  │    Starting bid set at 30% to encourage competitive bidding.│ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Confidence: ████████░░ 85%                                       │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

#### 3. Error/Fallback State
```
┌─────────────────────────────────────────────────────────────────┐
│  ✨ AI Price Recommendation                                      │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│  ⚠️ Unable to generate recommendation                            │
│                                                                  │
│  Please enter your prices manually below.                        │
│                                                                  │
│  [Try Again]                                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 4. No Slip Uploaded State
```
┌─────────────────────────────────────────────────────────────────┐
│  ✨ AI Price Recommendation                                      │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│  📋 Get smarter pricing!                                         │
│                                                                  │
│  Upload a purchase receipt in Step 1 for more accurate          │
│  AI-powered price recommendations based on original cost.        │
│                                                                  │
│  [Get Recommendation Anyway]                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Interaction Behavior

### "Use This" Button
- Clicking "Use This ✓" on Starting Bid → Fills the Starting Price input below
- Clicking "Use This ✓" on Buy Now Price → Fills the Buy Now Price input below
- Button changes to "Applied ✓" with checkmark after clicking
- User can still manually edit the input after applying

### Input Fields
- Show hint text below input: "AI Recommended: €120"
- If user changes value from AI recommendation, hint remains visible
- Green checkmark if value matches AI recommendation

### Refresh Button
- Allows user to regenerate recommendation
- Useful if user updated item details and went back/forward

---

## Performance Requirements

| Metric | Target |
|--------|--------|
| API Response Time | < 3 seconds |
| Timeout | 10 seconds |
| Fallback | Show manual entry if timeout |
| Caching | Cache by hash of input for 1 hour |

---

## Edge Cases

1. **No slip uploaded**: AI still works, but may be less accurate
2. **Missing form fields**: Use available data, lower confidence
3. **API timeout**: Show fallback UI, allow manual entry
4. **Invalid photos**: Skip visual analysis, use text data only
5. **Very high/low recommendations**: Cap at reasonable min/max (€1 - €50,000)

---

## Security Considerations

1. Rate limit: Max 10 requests per user per hour
2. Validate image URLs belong to our R2 bucket
3. Sanitize all text inputs before sending to AI
4. Log requests for abuse monitoring

---

## Analytics Events

| Event | When |
|-------|------|
| `ai_recommendation_requested` | User enters Step 3 |
| `ai_recommendation_success` | API returns successfully |
| `ai_recommendation_failed` | API error or timeout |
| `ai_recommendation_applied` | User clicks "Use This" |
| `ai_recommendation_ignored` | User submits with different price |

---

## Localization Keys

```json
{
  "create": {
    "ai": {
      "title": "AI Price Recommendation",
      "loading": "Analyzing your item...",
      "analyzing": "We're looking at:",
      "analyzePhotos": "Product photos",
      "analyzeDetails": "Item details", 
      "analyzeMarket": "Market trends",
      "startingBid": "Starting Bid",
      "buyNowPrice": "Buy Now Price",
      "useThis": "Use This",
      "applied": "Applied",
      "confidence": "Confidence",
      "refresh": "Refresh",
      "error": "Unable to generate recommendation",
      "errorRetry": "Try Again",
      "manualEntry": "Please enter your prices manually below.",
      "noSlipTitle": "Get smarter pricing!",
      "noSlipDesc": "Upload a purchase receipt in Step 1 for more accurate AI-powered price recommendations.",
      "getAnyway": "Get Recommendation Anyway",
      "recommended": "AI Recommended"
    }
  }
}
```
