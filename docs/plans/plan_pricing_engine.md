# Plan: Pricing Engine Implementation

**Date**: 2025-12-13
**Status**: ✅ COMPLETED
**Priority**: High

---

## Objective

Implement an automated pricing engine for shipment cost calculation, based on French logistics market rates. The system should be easily configurable for future adjustments.

---

## Dependencies

- Shipments schema (✅ exists)
- Listings schema (✅ exists - has dimensions/weight)
- Geolocation fields (✅ exists - lat/lng in listings)

---

## Implementation Steps

### Phase 1: Pricing Configuration ✅

1. ✅ Create `src/lib/pricing/config.ts`
   - Define all pricing constants with documentation
   - Make rates easily adjustable
   - Include French market-based defaults

2. ✅ Create `src/lib/pricing/types.ts`
   - Define TypeScript interfaces for pricing

### Phase 2: Pricing Service ✅

3. ✅ Create `src/server/services/pricing.service.ts`
   - Implement distance calculation (Haversine formula)
   - Implement volume calculation
   - Implement weight-based pricing
   - Implement time-based pricing (express, scheduled)
   - Implement dynamic pricing (optional, future)

### Phase 3: API Integration ✅

4. ✅ Create `src/app/api/pricing/calculate/route.ts`
   - POST endpoint to calculate shipping price
   - GET endpoint to retrieve config
   - Validate input with Zod DTO

5. ✅ Create `src/server/dto/pricing.dto.ts`
   - Input/output validation schemas

### Phase 4: Client Integration ✅

6. ✅ Create `src/features/app/common/api/pricing.api.ts`
   - Client API wrapper with typed fetch functions
   - Query keys for TanStack Query

7. ✅ Create `src/features/app/common/hooks/usePricing.ts`
   - usePricing() - Full pricing hook
   - usePricingConfig() - Config only hook
   - useCalculatePrice() - Calculate mutation hook

### Phase 5: UI Integration ✅

8. ✅ Update checkout page to show estimated shipping price (`ShippingEstimate` component)
9. ✅ Update driver proposal form with reference price (`ProposalForm` with pricing)
10. [ ] Update shipment creation to use pricing engine (optional, not needed for MVP)

---

## Files Created

| Status | File |
|--------|------|
| ✅ | `src/lib/pricing/config.ts` |
| ✅ | `src/lib/pricing/types.ts` |
| ✅ | `src/lib/pricing/index.ts` |
| ✅ | `src/server/services/pricing.service.ts` |
| ✅ | `src/server/dto/pricing.dto.ts` |
| ✅ | `src/app/api/pricing/calculate/route.ts` |
| ✅ | `src/features/app/common/api/pricing.api.ts` |
| ✅ | `src/features/app/common/api/index.ts` |
| ✅ | `src/features/app/common/hooks/usePricing.ts` |
| ✅ | `src/features/app/checkout/ui/ShippingEstimate.tsx` |
| ✅ | `src/features/app/driver/ui/ProposalForm.tsx` (updated) |
| ✅ | `src/features/app/driver/ui/ShipmentActions.tsx` (updated) |
| ✅ | `docs/specs/pricing_engine_spec.md` |
| ✅ | `docs/roadmap.md` (updated) |

---

## Testing Checklist

- [ ] Calculate price for short distance (< 10km)
- [ ] Calculate price for medium distance (10-50km)
- [ ] Calculate price for long distance (> 100km)
- [ ] Calculate price with different package sizes
- [ ] Calculate price with express delivery
- [ ] Calculate price with scheduled delivery
- [ ] API endpoint returns correct response format

---

## Architecture Compliance

| Rule | Status |
|------|--------|
| Zod Validation | ✅ pricing.dto.ts |
| Service Layer | ✅ pricing.service.ts |
| API Route | ✅ /api/pricing/calculate |
| Client API | ✅ pricing.api.ts |
| Hooks | ✅ usePricing.ts |
| Layer Separation | ✅ UI → hooks → client-api → REST API → service |
| No `any` | ✅ All types explicit |
| SOLID | ✅ Single responsibility per file |
| KISS | ✅ Simple, well-documented code |
