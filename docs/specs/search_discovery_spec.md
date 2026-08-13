# Specification: Advanced Search & Discovery

## 1. Overview

The Search & Discovery system allows users to find listings efficiently using text-based queries, proximity/distance-based filters, and seller reputation metrics. It leverages PostgreSQL Full-Text Search (FTS) and PostGIS for high-performance spatial queries.

## 2. Full-Text Search (FTS)

The platform has moved away from basic `LIKE` queries to a robust FTS implementation.

### 2.1 Search Engine Details
*   **Vectorization**: Fields `title` and `description` are combined into a `tsvector`.
*   **Indexing**: A GIN (Generalized Inverted Index) `listing_search_idx` is used for sub-second responses.
*   **Ranking**: Results are ordered by `ts_rank`, where matches in the `title` are weighted higher than `description`.
*   **Language Support**: Uses the `french` dictionary for proper stemming and stop-word removal (customizable for multi-language).

### 2.2 Query Behavior
*   **Supports**: Boolean operators (`AND`, `OR`, `NOT`).
*   **Phrase Search**: Accurate phrase matching using `websearch_to_tsquery`.

## 3. Geometric & Spatial Filters

Spatial search allows buyers to find items near them to reduce shipping costs.

### 3.1 Proximity Search
*   **PostGIS Integration**: Uses `ST_DWithin` on `geography` types for accurate distance filtering over the Earth's surface.
*   **Logic**: 
    1. User provides `lat`, `lng`, and `radiusKm`.
    2. API calculates distance between `user_point` and `listing_point`.
    3. Results are filtered if `distance > radiusKm * 1000`.
*   **Sorting**: Supports `sortBy: "distance"` to show nearest items first.

## 4. Advanced Filters

Beyond text and location, users can filter by:

### 4.1 Seller Reputation
*   **Min Rating**: Filter by seller's average star rating (1-5).
*   **Min Reputation**: Filter by specialized reputation score (custom platform metric).

### 4.2 Item Attributes
*   **Price Range**: Multi-selection or slider-based price range (stored in Cents).
*   **Size**: Filter by package size categories (XS, S, M, L, XL, XXL).
*   **Condition**: Used, New, Refurbished, etc.

## 5. API Endpoints

### GET `/api/listings/public`
Primary endpoint for search and filtering.
*   **Query Params**:
    *   `search`: Query string.
    *   `lat` / `lng`: User coordinates.
    *   `radius`: Distance in KM.
    *   `minRating`: Minimal seller rating.
    *   `sortBy`: `newest` | `price_low` | `price_high` | `ending_soon` | `distance`.

## 6. Performance Considerations

*   **Pagination**: Uses `limit` and `offset` to prevent large payloads (Current limit: 100 results).
*   **Search Vector Pre-calculation**: (Future) Storing `tsvector` in a generated column `search_vector` for even faster indexing.
