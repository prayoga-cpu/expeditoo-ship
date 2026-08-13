# Implementation Plan: AI Price Recommendation

**Related Spec:** `docs/specs/ai_price_recommendation_spec.md`
**Estimated Time:** 4-6 hours
**Priority:** High
**Status:** ✅ **COMPLETED** (2025-12-24)

---

## Overview

Implement AI-powered price recommendations for auction listings using Gemini 1.5 Flash. The feature combines slip OCR data with form inputs to suggest optimal starting bid and buy now prices.

---

## Phase 1: Infrastructure Setup (30 min)

### Task 1.1: Environment Configuration
**File:** `.env.example`
```
GOOGLE_AI_API_KEY=your_gemini_api_key
```

### Task 1.2: Install Gemini SDK
**Command:**
```bash
pnpm add @google/generative-ai
```

### Task 1.3: Create Gemini Client
**File:** `src/lib/ai/gemini.ts`
- Initialize Gemini client with API key
- Configure model (gemini-1.5-flash)
- Setup safety settings
- Export reusable client

### Task 1.4: Create AI DTO Schemas
**File:** `src/server/dto/ai.dto.ts`
- `AIPriceRecommendationInputDTO` - Zod schema for request validation
- `AIPriceRecommendationOutputDTO` - Zod schema for response validation
- Type exports

---

## Phase 2: Backend Implementation (1.5 hours)

### Task 2.1: Create AI Service
**File:** `src/server/services/ai.service.ts`

```typescript
export const AIService = {
  async recommendPrice(input: AIPriceRecommendationInput): Promise<AIPriceRecommendationOutput>
}
```

Functions:
- `buildPrompt(input)` - Construct optimized prompt
- `parseResponse(text)` - Parse JSON from AI response
- `validateOutput(data)` - Validate against schema
- `calculateFallback(input)` - Deterministic fallback if AI fails

### Task 2.2: Create API Route
**File:** `src/app/api/ai/recommend-price/route.ts`

- POST handler
- Validate input with DTO
- Call AI service
- Return structured response
- Error handling with proper codes

### Task 2.3: Update Slip Processing Route
**File:** `src/app/api/ai/process-slip/route.ts`

- Replace mock with real Gemini Vision
- Extract dimensions, weight, price from receipt image
- Return structured data

---

## Phase 3: Frontend - Hook & State (1 hour)

### Task 3.1: Create Price Recommendation Hook
**File:** `src/features/app/create/hooks/useAIPriceRecommendation.ts`

```typescript
export function useAIPriceRecommendation() {
  return {
    recommendation: AIPriceRecommendationOutput | null,
    isLoading: boolean,
    error: string | null,
    fetchRecommendation: (input) => Promise<void>,
    applyStartingBid: () => void,
    applyBuyNowPrice: () => void,
    appliedFields: { startingBid: boolean, buyNowPrice: boolean },
    refresh: () => void,
  }
}
```

### Task 3.2: Create API Client
**File:** `src/features/app/create/api/price-recommendation.api.ts`

```typescript
export async function fetchPriceRecommendation(input): Promise<AIPriceRecommendationOutput>
```

### Task 3.3: Update useCreateForm Hook
**File:** `src/features/app/create/hooks/useCreateForm.tsx`

- Add state for slip data (to pass to AI)
- Expose slip data in return object
- Add callback for slip processing result

---

## Phase 4: Frontend - UI Components (1.5 hours)

### Task 4.1: Create AI Recommendation Card Component
**File:** `src/features/app/create/ui/AIPriceRecommendationCard.tsx`

States to implement:
- Loading (skeleton + progress indicators)
- Success (two price cards + reasoning + confidence)
- Error (error message + retry button)
- No Slip (prompt to upload or continue anyway)

Props:
```typescript
interface AIPriceRecommendationCardProps {
  recommendation: AIPriceRecommendationOutput | null;
  isLoading: boolean;
  error: string | null;
  hasSlip: boolean;
  onApplyStartingBid: () => void;
  onApplyBuyNowPrice: () => void;
  onRefresh: () => void;
  onGetAnyway: () => void;
  appliedFields: { startingBid: boolean; buyNowPrice: boolean };
}
```

### Task 4.2: Update Create.tsx - Step 3
**File:** `src/features/app/create/ui/Create.tsx`

- Add AIPriceRecommendationCard above price inputs
- Trigger recommendation fetch on step change
- Wire up apply functions to form.setValue
- Show "AI Recommended: €X" hint under inputs
- Add visual indicator when value matches recommendation

### Task 4.3: Update PurchaseSlipUploader Integration
**File:** `src/features/app/create/ui/Create.tsx`

- Store slip data in parent state
- Pass slip data to AI recommendation hook
- Ensure slip OCR runs with real AI

---

## Phase 5: Translations (30 min)

### Task 5.1: Add Translation Keys
**Files:**
- `messages/en.json`
- `messages/fr.json`
- `messages/es.json`

Add all keys from spec under `create.ai.*`

---

## Phase 6: Testing & Polish (1 hour)

### Task 6.1: Manual Testing Checklist
- [ ] Upload slip → data extracted correctly
- [ ] Fill form → enter Step 3 → recommendation loads
- [ ] Click "Use This" → price input filled
- [ ] Verify AI timeout fallback works
- [ ] Test error state and retry
- [ ] Test without slip upload
- [ ] Verify translations work
- [ ] Mobile responsiveness

### Task 6.2: Edge Cases
- [ ] Empty photos array
- [ ] Very large dimensions
- [ ] Missing category
- [ ] API rate limit hit
- [ ] Network error

### Task 6.3: Performance Optimization
- [ ] Ensure images are compressed before upload
- [ ] Only send first 2 photos to AI
- [ ] Add request timeout (10s)
- [ ] Implement simple caching

---

## Dependencies Between Tasks

```
1.1 ─┬─→ 1.3 ─→ 2.1 ─→ 2.2 ─→ 3.1 ─→ 4.1 ─→ 4.2
1.2 ─┘                              ↓
                               3.2 ─┘
                                    ↓
                               4.3 ─→ 5.1 ─→ 6.x
```

---

## Files to Create

| File | Type |
|------|------|
| `src/lib/ai/gemini.ts` | Utility |
| `src/server/dto/ai.dto.ts` | DTO |
| `src/server/services/ai.service.ts` | Service |
| `src/app/api/ai/recommend-price/route.ts` | API Route |
| `src/features/app/create/hooks/useAIPriceRecommendation.ts` | Hook |
| `src/features/app/create/api/price-recommendation.api.ts` | Client API |
| `src/features/app/create/ui/AIPriceRecommendationCard.tsx` | Component |

---

## Files to Modify

| File | Changes |
|------|---------|
| `.env.example` | Add GOOGLE_AI_API_KEY |
| `src/app/api/ai/process-slip/route.ts` | Real implementation |
| `src/features/app/create/ui/Create.tsx` | Add AI card, wire up |
| `src/features/app/create/hooks/useCreateForm.tsx` | Add slip state |
| `src/features/app/create/hooks/index.ts` | Export new hook |
| `messages/en.json` | Add translations |
| `messages/fr.json` | Add translations |
| `messages/es.json` | Add translations |

---

## Rollback Plan

If issues arise:
1. Set `GOOGLE_AI_API_KEY` to empty → falls back to deterministic pricing
2. Feature gracefully degrades to manual input only
3. No database changes required for rollback

---

## Success Criteria

1. ✅ User can upload slip and see extracted data
2. ✅ AI recommendation appears on Step 3
3. ✅ User can apply recommendations with one click
4. ✅ Manual override still works
5. ✅ Error states handled gracefully
6. ✅ Works without API key (fallback)
7. ✅ All translations present
8. ✅ Build passes, no lint errors
