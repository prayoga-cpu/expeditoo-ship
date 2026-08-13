# Specification: Listings Full-Text Search

## 1. Goal
Provide a robust, performant, and intelligent search experience for the Expeditoo marketplace using PostgreSQL's native Full-Text Search capabilities.

## 2. Expected Behavior

### 2.1 Search Coverage
The search must scan the following fields:
- `title` (Primary weight)
- `description` (Secondary weight)

### 2.2 Intelligence Features
- **Language Awareness**: Defaults to 'french' configuration (given primary market).
- **Stopwords**: Common words (like "the", "a", "le", "la") should be ignored to focus on keywords.
- **Stemming**: Searching for "voitures" should find "voiture".
- **Ranking**: Matches in the `title` should be ranked higher than matches in the `description`.

### 2.3 Query Syntax (`websearch_to_tsquery`)
Support modern search syntax:
- `vintage camera`: Logical AND (finds both).
- `"vintage camera"`: Phrase search.
- `-cheap`: Exclusion (excludes "cheap").
- `vintage OR antique`: Logical OR.

### 2.4 Performance
- Must use a **GIN (Generalized Inverted Index)**.
- Query execution time should be < 50ms for 100k records.

## 3. Data Integrity
- The search index must be kept in sync automatically via a **Generated Column** in the database.
- Historical data must be indexed immediately upon migration.

## 4. Error Scenarios
- **Empty Search**: Return all active listings (current behavior).
- **Special Characters**: Query must be sanitized to prevent SQL injection or search syntax crashes.
- **No Results**: Return empty array with `success: true`.

## 5. Metadata
- Standard API response format: `{ success: true, data: Listing[] }`.
