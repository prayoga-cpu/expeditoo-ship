# Specification: Home Page Backend Integration

## Overview

This spec defines the exact behavior of the home page when integrated with backend APIs, including search, filters, sorting, and map display.

---

## API Specification

### GET `/api/listings/public`

**Purpose:** Fetch all active public listings with optional filters

**Query Parameters:**
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| search | string | No | Search in title and description | `?search=furniture` |
| category | string | No | Filter by category ID | `?category=electronics` |
| priceMin | number | No | Minimum price filter | `?priceMin=10` |
| priceMax | number | No | Maximum price filter | `?priceMax=500` |
| sortBy | string | No | Sort option: `ending_soon`, `newest`, `price_low`, `price_high` | `?sortBy=ending_soon` |
| sizes | string | No | Comma-separated sizes | `?sizes=S,M,L` |

**Example Requests:**

```http
GET /api/listings/public
GET /api/listings/public?search=chair&category=furniture
GET /api/listings/public?priceMin=20&priceMax=100&sortBy=price_low
GET /api/listings/public?sizes=M,L&sortBy=ending_soon
```

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "abc123",
      "title": "Vintage Armchair",
      "description": "Beautiful vintage armchair in good condition",
      "images": [{ "id": "img1", "url": "https://...", "order": 0 }],
      "category": {
        "id": "furniture",
        "name": "Furniture"
      },
      "condition": "used_good",
      "type": "auction",
      "status": "active",
      "startPrice": 50,
      "currentPrice": 65,
      "buyNowPrice": 120,
      "size": "L",
      "weight": "25-50",
      "lat": 48.8566,
      "lng": 2.3522,
      "city": "Paris",
      "address": "123 Rue Example",
      "endsAt": "2025-12-05T10:00:00Z",
      "createdAt": "2025-12-01T08:00:00Z",
      "seller": {
        "id": "user123",
        "name": "John Doe",
        "image": "https://..."
      }
    }
  ]
}
```

**Error Response (500):**

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to fetch listings"
  }
}
```

---

## Feature Behaviors

### 1. Initial Load

**When:** User navigates to `/home`

**Expected Behavior:**

1. Show loading skeleton for listings
2. Show loading spinner on map
3. Fetch listings with default filters: `sortBy=ending_soon`, no other filters
4. Once data loads:
   - Display listings in card list
   - Display markers on map at listing coordinates
   - Hide loading states

**Edge Cases:**

- If API fails: Show error message "Failed to load listings. Please try again."
- If no listings: Show empty state "No active auctions at the moment."
- If network is slow: Keep showing loading state until timeout (30s)

---

### 2. Search Functionality

**Trigger:** User types in search box and either:

- Clicks the search button
- Presses Enter key

**NOT Triggered:**

- On every keystroke (not realtime)

**Expected Behavior:**

1. When user types: Update local state only, no API call
2. When user clicks search button or presses Enter:
   - Show loading state
   - Call API with `?search={query}` parameter
   - Preserve existing filters
   - Update listings with results
   - Update map markers

**Example Flow:**

```
User types "chair" → No API call
User presses Enter → API call with ?search=chair
Results loaded → Display filtered listings
```

**Edge Cases:**

- Empty search: If user searches with empty string, fetch all listings (remove search param)
- Special characters: Properly encode search query in URL
- No results: Show "No results for 'chair'. Try different keywords."

---

### 3. Filter Functionality

**Trigger:** User opens filter sheet, makes selections, and clicks "Apply Filters"

**NOT Triggered:**

- When user changes filter selections (not realtime)
- When filter sheet is opened

**Expected Behavior:**

1. User opens filter sheet → Show current filter values
2. User changes filters (category, price range, size) → Update local state only
3. User clicks "Apply Filters":
   - Close filter sheet
   - Show loading state
   - Call API with filter parameters
   - Update listings and map

**Filter Parameters Mapping:**
| UI Filter | API Parameter |
|-----------|---------------|
| Category dropdown | `category={categoryId}` |
| Price range slider | `priceMin={min}&priceMax={max}` |
| Size checkboxes | `sizes=S,M,L` (comma-separated) |
| Sort dropdown | `sortBy={option}` |

**Example Flow:**

```
User selects Category="Furniture" → No API call
User sets price range 20-100 → No API call
User selects sizes S,M → No API call
User clicks "Apply Filters" → API call with ?category=furniture&priceMin=20&priceMax=100&sizes=S,M
Results loaded → Display filtered listings
```

**Clear Filters:**

- Button resets all filters to default
- Triggers new API call with no filter parameters
- Only sortBy remains (default: ending_soon)

**Edge Cases:**

- Invalid ranges: If priceMin > priceMax, swap them
- No category selected: Don't include category parameter
- All sizes selected: Don't include sizes parameter (same as no filter)

---

### 4. Sorting

**Options:**

- Ending Soon (default) - Sort by `endsAt` ASC
- Newest - Sort by `createdAt` DESC
- Price: Low to High - Sort by `currentPrice` ASC
- Price: High to Low - Sort by `currentPrice` DESC

**Trigger:** User selects sort option from dropdown

**Expected Behavior:**

1. Immediately trigger API call with `sortBy` parameter
2. Show loading state
3. Update listings in new order
4. Preserve search and filter parameters

**Example:**

```
Current state: ?search=chair&category=furniture
User selects "Price: Low to High"
API call: ?search=chair&category=furniture&sortBy=price_low
```

---

### 5. Map Display

**Expected Behavior:**

1. Display marker for each listing at its `lat`/`lng` coordinates
2. Marker click → Open listing detail popup with:
   - Image thumbnail
   - Title
   - Current price
   - "View Details" button → Navigate to `/listing/{id}`
3. Map should update whenever listings change (search, filter, initial load)

**Marker Clustering:**

- NOT implemented in initial version (future enhancement)
- Display all markers individually

**Edge Cases:**

- Missing coordinates: Don't display marker for that listing
- Same coordinates: Markers overlap (acceptable for now)
- Map bounds: Auto-fit to show all markers on initial load

---

### 6. Listing Card

**Display Fields:**
| Field | Source | Format |
|-------|--------|--------|
| Image | `images[0].url` | Thumbnail |
| Title | `title` | Text |
| Category | `category.name` | Badge |
| Current Bid | `currentPrice` | `€{price}` |
| Location | `city` | Text |
| Deadline | `endsAt` | "Ends in X hours" |
| Bids Count | (future) | "X bids" |
| Size | `size` | Badge |

**Interaction:**

- Click anywhere on card → Navigate to `/listing/{id}`

---

### 7. Loading States

**Scenarios:**

1. **Initial Load:**
   - Show skeleton cards (3-4 cards)
   - Show map loading spinner

2. **Search/Filter:**
   - Dim existing cards
   - Show loading spinner overlay

3. **Slow Network:**
   - Show loading for max 30 seconds
   - Then show error with retry button

---

### 8. Error States

**Scenarios:**

1. **API Failure:**
   - Display error message
   - Show "Retry" button
   - Keep previous data visible (if exists)

2. **Empty Results:**
   - "No auctions found matching your criteria"
   - Show "Clear Filters" button
   - Suggest: "Try adjusting your filters"

3. **Network Error:**
   - "Unable to connect. Check your internet connection."
   - Show "Retry" button

---

## Data Flow

```
User Action (Search/Filter)
    ↓
Update Local State
    ↓
User Clicks Search/Apply
    ↓
Build Query Parameters
    ↓
TanStack Query (useQuery)
    ↓
Client API (fetchPublicListings)
    ↓
HTTP GET /api/listings/public?{params}
    ↓
API Route Handler
    ↓
Validate Query Params (DTO)
    ↓
Listings Service (getPublicListings)
    ↓
Listings DAL (getAllPublic)
    ↓
Database Query (Drizzle ORM)
    ↓
Return Results
    ↓
Update UI (Listings + Map)
```

---

## Validation Rules

### Query Parameters (Backend)

```typescript
{
  search: z.string().optional(),
  category: z.string().optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  sortBy: z.enum(['ending_soon', 'newest', 'price_low', 'price_high']).optional(),
  sizes: z.string().optional(), // "S,M,L"
}
```

### Search Query

- Minimum length: None (empty search returns all)
- Maximum length: 100 characters
- Trim whitespace
- Case-insensitive matching

### Price Range

- Both must be >= 0
- If priceMin > priceMax, swap them
- Default: No filter (return all prices)

### Sizes

- Valid values: XS, S, M, L, XL, XXL
- Comma-separated string
- Invalid values ignored

---

## Performance Requirements

1. **Initial Load:** < 2 seconds (typical)
2. **Search/Filter:** < 1 second (typical)
3. **Map Render:** < 500ms after data load
4. **No API Call on Keystroke:** Must wait for button click/Enter

---

## Accessibility

1. Search button has clear label
2. Filter button has clear label
3. Loading states announce to screen readers
4. Error messages are focusable
5. Map markers have alt text

---

## Testing Checklist

### Functional Tests

- [ ] Initial load displays listings from database
- [ ] Search triggers only on button/Enter
- [ ] Filters trigger only on Apply button
- [ ] All filter combinations work correctly
- [ ] Sorting changes order correctly
- [ ] Map displays all markers
- [ ] Marker click shows correct listing
- [ ] Card click navigates to detail page

### Edge Case Tests

- [ ] Empty search query
- [ ] No results found
- [ ] API returns error
- [ ] Network timeout
- [ ] Invalid price range
- [ ] Missing coordinates
- [ ] Large dataset (100+ listings)

### Integration Tests

- [ ] Search + Category filter
- [ ] Search + Price range + Sort
- [ ] All filters + Search
- [ ] Clear filters resets everything

---

## Future Enhancements (Not in Scope)

- Pagination
- Infinite scroll
- Marker clustering
- Distance filter
- Saved searches
- Real-time updates (WebSocket)
- Bid count from database

---

## Success Criteria

✅ All listings come from database (no mock data)  
✅ Search is non-realtime (button/Enter only)  
✅ Filters are non-realtime (Apply button only)  
✅ TanStack Query properly configured  
✅ Map shows correct coordinates  
✅ All filter combinations work  
✅ Loading/error/empty states implemented  
✅ Clean architecture maintained  
✅ TypeScript strict (no `any`)  
✅ Zod validation on all inputs
