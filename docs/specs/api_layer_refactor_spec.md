# Client API Layer Refactor Specification

## Overview

This specification defines the expected behavior and structure for the Client API layer refactor. The goal is to ensure all UI components access backend APIs through typed wrapper functions rather than direct `fetch()` calls.

---

## Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                     UI Component (.tsx)                      │
│         Only renders, uses hooks, NO fetch()                │
└──────────────────────────┬──────────────────────────────────┘
                           │ calls
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Custom Hook (useXxx.ts)                   │
│       TanStack Query, state management, business logic      │
└──────────────────────────┬──────────────────────────────────┘
                           │ calls
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Client API (xxx.api.ts)                    │
│      Typed fetch wrappers, URL building, error handling     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP request
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    REST API (/api/xxx)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## API File Structure

Each feature's `api/` folder should contain:

```
features/app/{feature}/api/
├── index.ts           # Re-exports all API functions
├── {resource}.api.ts  # API functions for a specific resource
└── types.ts           # (Optional) API-specific types if not in main types.ts
```

---

## API Function Pattern

All API functions must follow this pattern:

```typescript
// Standard API Response type (reuse from common)
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Example function
export async function fetchResource(id: string): Promise<Resource> {
  const response = await fetch(`/api/resources/${id}`);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const result: ApiResponse<Resource> = await response.json();
  
  if (!result.success || !result.data) {
    throw new Error(result.error?.message || "Failed to fetch resource");
  }
  
  return result.data;
}
```

---

## Feature-Specific Requirements

### 1. Profile Feature (`profile/api/`)

**auctions.api.ts:**
| Function | HTTP Method | Endpoint | Returns |
|----------|-------------|----------|---------|
| `fetchMyAuctions()` | GET | `/api/listings` | `Auction[]` |
| `endAuction(id)` | PATCH | `/api/listings/{id}` | `void` |
| `deleteAuction(id)` | DELETE | `/api/listings/{id}` | `void` |
| `repostAuction(id, duration)` | POST | `/api/listings/{id}/repost` | `Auction` |

**addresses.api.ts:**
| Function | HTTP Method | Endpoint | Returns |
|----------|-------------|----------|---------|
| `fetchAddresses()` | GET | `/api/user/addresses` | `Address[]` |
| `fetchAddressById(id)` | GET | `/api/user/addresses/{id}` | `Address` |
| `createAddress(data)` | POST | `/api/user/addresses` | `Address` |
| `updateAddress(id, data)` | PUT | `/api/user/addresses/{id}` | `Address` |
| `deleteAddress(id)` | DELETE | `/api/user/addresses/{id}` | `void` |
| `setDefaultAddress(id)` | POST | `/api/user/addresses/{id}/set-default` | `void` |

**driver.api.ts:**
| Function | HTTP Method | Endpoint | Returns |
|----------|-------------|----------|---------|
| `submitDriverApplication(data)` | POST | `/api/driver/apply` | `void` |

---

### 2. Admin Feature (`admin/api/`)

**drivers.api.ts:**
| Function | HTTP Method | Endpoint | Returns |
|----------|-------------|----------|---------|
| `fetchDriverApplications()` | GET | `/api/admin/driver-applications` | `DriverApplication[]` |
| `fetchDriverApplicationById(id)` | GET | `/api/admin/driver-applications/{id}` | `DriverApplication` |
| `approveDriverApplication(id)` | POST | `/api/admin/driver-applications/{id}/approve` | `void` |
| `rejectDriverApplication(id)` | POST | `/api/admin/driver-applications/{id}/reject` | `void` |

---

### 3. Driver Feature (`driver/api/`)

**proposals.api.ts:**
| Function | HTTP Method | Endpoint | Returns |
|----------|-------------|----------|---------|
| `submitProposal(shipmentId, data)` | POST | `/api/shipments/{id}/proposals` | `Proposal` |
| `fetchReferencePrice(params)` | POST | `/api/pricing/calculate` | `PriceEstimate` |

---

### 4. Create Feature (`create/api/`)

**upload.api.ts:**
| Function | HTTP Method | Endpoint | Returns |
|----------|-------------|----------|---------|
| `uploadImage(file)` | POST | `/api/upload` | `{ url: string }` |

**ai.api.ts:**
| Function | HTTP Method | Endpoint | Returns |
|----------|-------------|----------|---------|
| `processSlip(imageUrl)` | POST | `/api/ai/process-slip` | `SlipData` |

**listings.api.ts:**
| Function | HTTP Method | Endpoint | Returns |
|----------|-------------|----------|---------|
| `fetchListingById(id)` | GET | `/api/listings/{id}` | `Listing` |

---

## Error Handling

All API functions must:

1. Check `response.ok` before parsing JSON
2. Validate `result.success` from API response
3. Throw descriptive errors with the server's error message when available
4. Never swallow errors silently

---

## Type Safety

1. All API functions must have explicit return types
2. All request body types must be defined
3. Response types must match the backend DTO
4. No `any` types allowed

---

## Verification

After implementation, run:
```bash
# Check for direct fetch in UI
grep -r "await fetch(" src/features/app/*/ui/ --include="*.tsx"
# Should return 0 results

# Check for any types
grep -r ": any" src/server/ --include="*.ts"
# Should return 0 results (except legitimate uses like JSON.parse)
```
