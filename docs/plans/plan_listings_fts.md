# Plan: PostgreSQL Full-Text Search Implementation

## Overview
Implement specialized search capabilities for item listings using PostgreSQL Full-Text Search (FTS). This replaces the current inefficient `LIKE` queries with a performant, language-aware search system.

## Proposed Changes

### 1. Database Schema (`src/db/schema/listings.ts`)
- Add a `tsv` column of type `tsvector`.
- Use a generated column approach to automatically combine `title` and `description`.
- Add a `GIN` index on the `tsv` column for fast retrieval.

### 2. Data Access Layer (`src/server/dal/listings.dal.ts`)
- Update `getAllPublic` method.
- Remove `like` conditions for search.
- Implement FTS query using `websearch_to_tsquery` for better user experience.
- Add "relevancy ranking" so the best matches appear at the top.

### 3. Service Layer (`src/server/services/listings.service.ts`)
- No major changes required (maintains abstraction), ensuring the interface remains consistent.

## Implementation Steps

1. **Research & Verify**: Confirm Drizzle ORM syntax for `tsvector` generated columns.
2. **Schema Update**: Add the column and index to the schema file.
3. **Migration**: Generate and run the migration.
4. **DAL Refactor**: Replace `like` with FTS logic.
5. **Verification**: Test with various search terms (partial matches, language specific).

## Principles Checklist
- **SOLID**: DAL handles the "how" of data retrieval, Service handles "what".
- **KISS**: Using Postgres built-in FTS instead of external search engines (Elasticsearch/Algolia) for V1.
- **YAGNI**: Start with a simple GIN index and generated column; don't add complex weighted ranking unless requested.
- **DRY**: Use centralized FTS logic in DAL.
- **Standard Production**: Use GIN indexes and `websearch_to_tsquery` for robustness.
