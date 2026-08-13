# Specification: Pricing Engine

**Version**: 1.0.0
**Date**: 2025-12-13
**Status**: Approved

---

## 1. Overview

The Pricing Engine calculates shipping costs for the EXPEDITOO platform based on:
- Distance between origin and destination
- Package dimensions and weight
- Delivery speed (standard, express, scheduled)
- Base operational costs

All pricing is based on **French logistics market rates** and designed to be easily configurable.

---

## 2. Pricing Formula

```
Total Price = Base Rate
            + (Distance × Per-km Rate)
            + (Weight × Per-kg Rate)
            + (Volume × Per-m³ Rate)
            + Speed Surcharge
            + Service Fee
```

### 2.1 Minimum Price

The system enforces a **minimum price** to ensure profitability:
- Minimum: **€8.00**

---

## 3. Pricing Constants (French Market Rates)

### 3.1 Base Rates

| Constant | Value | Description |
|----------|-------|-------------|
| BASE_RATE | €4.50 | Fixed base cost for any delivery |
| SERVICE_FEE_PERCENT | 10% | Platform service fee |
| MIN_PRICE | €8.00 | Minimum total price |

### 3.2 Distance Rates

| Distance Range | Rate per km | Description |
|----------------|-------------|-------------|
| 0-20 km | €0.45/km | Urban/local deliveries |
| 20-50 km | €0.38/km | Suburban deliveries |
| 50-100 km | €0.32/km | Regional deliveries |
| 100+ km | €0.28/km | Long-distance deliveries |

### 3.3 Weight Rates

| Weight Range | Rate per kg | Description |
|--------------|-------------|-------------|
| 0-5 kg | €0.00/kg | Light packages (included in base) |
| 5-15 kg | €0.35/kg | Medium packages |
| 15-30 kg | €0.55/kg | Heavy packages |
| 30+ kg | €0.80/kg | Very heavy packages |

### 3.4 Volume Rates

| Volume | Rate per m³ | Description |
|--------|-------------|-------------|
| Any | €18.00/m³ | Volumetric pricing |

Note: Final dimensional weight = MAX(actual weight, volumetric weight)
Volumetric weight formula: (L × W × H in cm) / 5000

### 3.5 Speed Surcharges

| Speed | Surcharge | Description |
|-------|-----------|-------------|
| STANDARD | €0.00 | 3-5 business days |
| EXPRESS | €8.50 | Next-day delivery |
| SAME_DAY | €15.00 | Same-day delivery |
| SCHEDULED | €2.50 | Customer picks date/time |

---

## 4. API Specification

### 4.1 Calculate Price

**Endpoint**: `POST /api/pricing/calculate`

**Request Body**:
```json
{
  "origin": {
    "lat": 48.8566,
    "lng": 2.3522
  },
  "destination": {
    "lat": 48.8847,
    "lng": 2.3425
  },
  "package": {
    "length": 30,
    "width": 20,
    "height": 15,
    "weight": 5
  },
  "speed": "STANDARD"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "data": {
    "breakdown": {
      "baseRate": 4.50,
      "distanceCost": 2.70,
      "weightCost": 0.00,
      "volumeCost": 1.62,
      "speedSurcharge": 0.00,
      "subtotal": 8.82,
      "serviceFee": 0.88,
      "total": 9.70
    },
    "distance": {
      "km": 6.0,
      "tier": "urban"
    },
    "weight": {
      "actual": 5,
      "volumetric": 1.8,
      "billable": 5,
      "tier": "light"
    },
    "volume": {
      "m3": 0.009,
      "liters": 9
    },
    "speed": "STANDARD",
    "estimatedDelivery": "3-5 business days",
    "currency": "EUR"
  }
}
```

**Response (Error)**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid coordinates",
    "details": {
      "origin.lat": "Latitude must be between -90 and 90"
    }
  }
}
```

---

## 5. Distance Calculation

Use **Haversine formula** for calculating distance between two coordinates:

```typescript
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

---

## 6. Edge Cases

### 6.1 Same Location
If origin and destination are the same (distance < 0.5 km):
- Return error: "Origin and destination must be different locations"

### 6.2 Zero/Negative Dimensions
If any dimension is 0 or negative:
- Return error: "Package dimensions must be positive numbers"

### 6.3 Excessive Weight
If weight > 100 kg:
- Return error: "Weight exceeds maximum limit (100 kg). Please contact support."

### 6.4 Very Long Distance
If distance > 1000 km:
- Return error: "Distance exceeds service area. Please use a freight service."

---

## 7. Future Enhancements (Out of Scope)

- [ ] Dynamic pricing based on demand
- [ ] Peak hour surcharges
- [ ] Fuel price adjustments
- [ ] Multi-stop deliveries
- [ ] B2B volume discounts
- [ ] Promotional discounts/coupons
