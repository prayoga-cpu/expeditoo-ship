# Plan: Home Page Backend Integration

## Objective

Integrate the home page (`/home`) with real database data, removing all mock data and implementing TanStack Query for data fetching with proper filter and search functionality.

## Requirements

1. ✅ Replace mock data with real API calls
2. ✅ Implement search (non-realtime, triggers on button click)
3. ✅ Implement filters (non-realtime, triggers on apply button)
4. ✅ Use TanStack Query for data fetching
5. ✅ Display listings on map with real coordinates
6. ✅ Show listings in card list view
7. ✅ Support sorting (ending soon, newest, price)
8. ✅ Support category filtering
9. ✅ Support price range filtering
10. ✅ Support size filtering

## Implementation Steps

### 1. Backend API Layer

#### 1.1 Update Listings DTO

**File:** `src/server/dto/listings.dto.ts`

- Add query parameters schema for listing filters
- Add response schema for public listing data

#### 1.2 Update Listings DAL

**File:** `src/server/dal/listings.dal.ts`

- Add `getAllPublic()` method with filters
- Support search query (title, description)
- Support category filter
- Support price range filter
- Support size filter
- Support sorting options
- Include pagination (optional for future)

#### 1.3 Update Listings Service

**File:** `src/server/services/listings.service.ts`

- Add `getPublicListings()` method
- Implement business logic for filtering
- Return listings with images and category info

#### 1.4 Create/Update API Route

**File:** `src/app/api/listings/public/route.ts` (NEW)

- GET endpoint for public listings
- Accept query parameters: search, category, priceMin, priceMax, sortBy, sizes
- Validate with DTO
- Call service layer
- Return validated response

### 2. Frontend Client API Layer

#### 2.1 Setup TanStack Query

**File:** `src/lib/query-client.ts` (NEW)

- Create and export QueryClient instance
- Configure default options (staleTime, cacheTime, refetchOnWindowFocus)

#### 2.2 Add Query Provider

**File:** `src/app/(app)/(main)/layout.tsx`

- Wrap children with QueryClientProvider
- Import QueryClient from lib

#### 2.3 Create Client API

**File:** `src/features/app/home/api/listings.api.ts` (NEW)

- Create typed fetch wrapper for GET `/api/listings/public`
- Export `fetchPublicListings` function
- Handle query parameters properly

### 3. Frontend Hook Layer

#### 3.1 Update useHome Hook

**File:** `src/features/app/home/hooks/useHome.ts`

- Remove mock data
- Use TanStack Query `useQuery` for data fetching
- Manage filter state locally
- Only call API when filters are applied (not realtime)
- Add `applyFilters` function
- Add `applySearch` function
- Remove client-side filtering logic (server-side now)

### 4. Frontend UI Layer

#### 4.1 Update SearchBar Component

**File:** Update `src/features/app/home/ui/SearchBar.tsx`

- Add search button
- Trigger search only on button click or Enter key
- Don't trigger on every keystroke

#### 4.2 Update FilterSheet Component

**File:** Update `src/features/app/home/ui/FilterSheet.tsx`

- Add "Apply Filters" button
- Only trigger API call when Apply is clicked
- Add "Clear Filters" button

#### 4.3 Update Home Page

**File:** `src/app/(app)/(main)/home/page.tsx`

- Add loading states
- Add empty states
- Add error states
- Handle TanStack Query states (isLoading, isError, data)

### 5. Type Updates

#### 5.1 Update Listing Type

**File:** `src/features/app/home/types.ts`

- Match backend response structure
- Ensure compatibility with database schema

## Files to Create/Modify

### New Files

- `src/app/api/listings/public/route.ts` ← Public listings API
- `src/features/app/home/api/listings.api.ts` ← Client API wrapper
- `src/lib/query-client.ts` ← TanStack Query client

### Modified Files

- `src/server/dto/listings.dto.ts` ← Add query/response schemas
- `src/server/dal/listings.dal.ts` ← Add getAllPublic method
- `src/server/services/listings.service.ts` ← Add getPublicListings
- `src/features/app/home/hooks/useHome.ts` ← Use TanStack Query
- `src/features/app/home/ui/SearchBar.tsx` ← Add search button
- `src/features/app/home/ui/FilterSheet.tsx` ← Add apply button
- `src/app/(app)/(main)/home/page.tsx` ← Handle loading/error states
- `src/app/(app)/(main)/layout.tsx` ← Add QueryClientProvider

## Dependencies to Install

```bash
pnpm add @tanstack/react-query
```

## Testing Plan

1. Verify listings load from database
2. Test search functionality (button click triggers API)
3. Test filter functionality (apply button triggers API)
4. Test sorting options
5. Verify map displays correct coordinates
6. Test empty states (no listings)
7. Test error states (API failure)
8. Test loading states

## Success Criteria

- ✅ No mock data in useHome hook
- ✅ All listings come from database
- ✅ Search only triggers on button click/Enter
- ✅ Filters only trigger on Apply button
- ✅ TanStack Query properly configured
- ✅ Map shows real coordinates
- ✅ Proper loading/error/empty states
- ✅ Clean architecture maintained (UI → Hooks → API → Service → DAL → DB)

## Notes

- Keep existing UI exactly the same, only change data source
- Maintain KISS principle (simple, no over-engineering)
- Follow SOLID principles (separation of concerns)
- Use Zod for all validation
- TypeScript strict mode (no `any`)
