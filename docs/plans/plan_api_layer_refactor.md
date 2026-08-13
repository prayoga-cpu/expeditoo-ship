---
description: Refactor fetch calls from UI to proper Client API layer
---

# Plan: Client API Layer Refactor

## Objective

Refactor all direct `fetch()` calls from UI components to dedicated `api/` folders within each feature, following the architecture defined in `rules.md`:

```
UI → hooks → client-api → REST API → service → DAL → DB
```

**Current Violation:** Some UI files call `fetch()` directly instead of going through a typed Client API wrapper.

---

## Scope

### Features Needing `api/` Folder Creation

| Feature | Status | Files with Direct Fetch |
|---------|--------|------------------------|
| `profile` | ❌ Missing | `MyAuctions.tsx`, `DriverApplicationForm.tsx`, `AddressManagement.tsx`, `AddressForm.tsx`, `CreateAddressForm.tsx`, `PublicProfile.tsx` |
| `auction` | ❌ Missing | `AuctionDetail.tsx` |
| `checkout` | ❌ Missing | `Checkout.tsx`, `WonCheckout.tsx` |
| `admin` | ❌ Missing | `DriverApplicationsList.tsx`, `DriverApplicationDetail.tsx` |
| `driver` | ❌ Missing | `ProposalForm.tsx` |
| `create` | ⚠️ Partial | `PhotoDropzone.tsx`, `PurchaseSlipUploader.tsx`, `useCreateForm.tsx` |

### Additional Fix

- Fix `any` type usage in `src/server/dal/listings.dal.ts` line 140

---

## Implementation Steps

### Step 1: Create `profile/api/` Layer

**Files to create:**
- `src/features/app/profile/api/index.ts`
- `src/features/app/profile/api/auctions.api.ts`
- `src/features/app/profile/api/addresses.api.ts`
- `src/features/app/profile/api/driver.api.ts`

**Functions to extract from `MyAuctions.tsx`:**
```typescript
// auctions.api.ts
export async function fetchMyAuctions(): Promise<Auction[]>
export async function endAuction(id: string): Promise<void>
export async function deleteAuction(id: string): Promise<void>
export async function repostAuction(id: string, duration: string): Promise<void>
```

**Functions to extract from `AddressManagement.tsx` & `AddressForm.tsx`:**
```typescript
// addresses.api.ts
export async function fetchAddresses(): Promise<Address[]>
export async function fetchAddressById(id: string): Promise<Address>
export async function createAddress(data: CreateAddressInput): Promise<Address>
export async function updateAddress(id: string, data: UpdateAddressInput): Promise<Address>
export async function deleteAddress(id: string): Promise<void>
export async function setDefaultAddress(id: string): Promise<void>
```

**Functions to extract from `DriverApplicationForm.tsx`:**
```typescript
// driver.api.ts
export async function submitDriverApplication(data: DriverApplicationInput): Promise<void>
```

---

### Step 2: Create `auction/api/` Layer

**Files to create:**
- `src/features/app/auction/api/index.ts`
- `src/features/app/auction/api/messages.api.ts`

**Functions to extract from `AuctionDetail.tsx`:**
```typescript
// messages.api.ts (or reuse from messages feature)
export async function initConversation(recipientId: string, listingId: string): Promise<{ conversationId: string }>
```

---

### Step 3: Create `checkout/api/` Layer

**Files to create:**
- `src/features/app/checkout/api/index.ts`
- `src/features/app/checkout/api/addresses.api.ts`

**Note:** This can likely reuse the `profile/api/addresses.api.ts` via re-export or shared `common/api/`.

---

### Step 4: Create `admin/api/` Layer

**Files to create:**
- `src/features/app/admin/api/index.ts`
- `src/features/app/admin/api/drivers.api.ts`

**Functions to extract:**
```typescript
// drivers.api.ts
export async function fetchDriverApplications(): Promise<DriverApplication[]>
export async function fetchDriverApplicationById(id: string): Promise<DriverApplication>
export async function approveDriverApplication(id: string): Promise<void>
export async function rejectDriverApplication(id: string): Promise<void>
```

---

### Step 5: Create `driver/api/` Layer

**Files to create:**
- `src/features/app/driver/api/index.ts`
- `src/features/app/driver/api/proposals.api.ts`

**Functions to extract from `ProposalForm.tsx`:**
```typescript
// proposals.api.ts
export async function submitProposal(shipmentId: string, data: ProposalInput): Promise<Proposal>
```

---

### Step 6: Complete `create/api/` Layer

**Files to create/update:**
- `src/features/app/create/api/index.ts`
- `src/features/app/create/api/upload.api.ts`
- `src/features/app/create/api/ai.api.ts`
- `src/features/app/create/api/listings.api.ts`

**Functions to extract:**
```typescript
// upload.api.ts
export async function uploadImage(file: File): Promise<{ url: string }>

// ai.api.ts
export async function processSlip(imageUrl: string): Promise<SlipData>

// listings.api.ts
export async function fetchListingById(id: string): Promise<Listing>
```

---

### Step 7: Fix `any` Type in DAL

**File:** `src/server/dal/listings.dal.ts`
**Line:** 140

**Before:**
```typescript
const updateData: any = { status, updatedAt: new Date() };
```

**After:**
```typescript
const updateData: { status: typeof status; updatedAt: Date; endsAt?: Date } = { 
  status, 
  updatedAt: new Date() 
};
```

---

## Verification Checklist

After refactoring, verify:

- [ ] No `await fetch(` in any `.tsx` file inside `features/app/*/ui/`
- [ ] All features have `api/index.ts` exporting typed functions
- [ ] All API functions return typed responses
- [ ] All mutations still work (test manually)
- [ ] No TypeScript errors
- [ ] No `any` types in `src/server/`

---

## Priority Order

1. **High:** `profile/api/` (most fetch calls)
2. **Medium:** `admin/api/`, `driver/api/`
3. **Low:** `auction/api/`, `checkout/api/`, `create/api/` (fewer calls)

---

## Notes

- Consider creating shared API utilities in `common/api/` for repeated patterns
- Use consistent error handling pattern across all API files
- Each API file should have proper TypeScript interfaces for request/response
