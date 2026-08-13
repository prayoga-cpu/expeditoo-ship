---
# ✅ **Rules.md - for AI and Developers**
---

# 0. Software Engineering Principles (Mandatory)

The entire EXPEDITOO codebase MUST follow modern engineering principles:

---

## **0.1 SOLID Principles**

### S — Single Responsibility Principle (SRP)

Each file must only do **one thing**.

- One DTO file = only schemas
- One service file = only business logic
- One DAL file = only database queries
- One UI component = single responsibility

### O — Open/Closed

System must be **open for extension**, **closed for modification**.

Add features by creating new modules, not modifying existing ones.

### L — Liskov Substitution

Replaceable behavior — a transporter must behave as a user in generic contexts.
Services must return consistent DTO outputs.

### I — Interface Segregation

DTOs must remain small and feature-specific.
No bloated or shared megaschemas.

### D — Dependency Inversion

High-level modules depend on abstractions, not concrete lower layers:

```
UI → Client API → REST Routes → Services → DAL → DB
```

---

## **0.2 KISS — Keep It Simple, Stupid**

- Prefer simple code over smart-but-confusing code
- Avoid nested logic
- Functions under **50 lines**
- Avoid unnecessary abstractions

---

## **0.3 YAGNI — You Aren’t Gonna Need It**

- Do NOT build features unless required by current spec
- No empty modules “for the future”
- Abstractions only after real duplication
- No premature optimization

---

## **0.4 Clean Code**

- Clear naming
- No magic values
- Early return patterns
- Pure functions whenever possible
- Comments explain **why**, not **what**
- ESLint + Prettier mandatory
- No `any`, no silent `catch`

---

# 1. High-Level Principles

## **1.1 Separation of Concerns**

- UI contains **zero** business logic
- API route = only:
  - validation
  - routing
  - calling service

- Service layer = all business logic
- DAL = database operations only
- DTO enforces strict I/O
- OpenAPI = contract for entire system

---

## **1.2 Type Safety Everywhere**

- All input validated with **Zod**
- DTO defines request + response shapes
- DAL uses Drizzle
- API responses validated before sending
- OpenAPI generated from DTO

---

## **1.3 Feature-Driven Architecture**

Each feature must contain:

```
UI
Hooks
Client API
DTO
Service
DAL
Schema
Tests
```

No cross-imports between features.

---

## **1.4 Layer Boundaries (STRICT)**

```
UI → hooks → client-api → REST API → service → DAL → DB
```

Mandatory:

- UI cannot call service or DAL
- API cannot call DAL directly
- DAL cannot import DTO

---

# 2. Project Structure (REST + OpenAPI)

```
src/
  app/
    api/
      users/
        route.ts
      shipments/
        route.ts
      quotes/
        route.ts
      webhooks/
        stripe/route.ts
      docs/
        openapi.json
        route.ts   # swagger UI

    (server components)

  server/
    db/
      schema.ts
      index.ts

    dto/
      users.dto.ts
      shipments.dto.ts
      quotes.dto.ts

    dal/
      users.dal.ts
      shipments.dal.ts
      quotes.dal.ts

    services/
      users.service.ts
      shipments.service.ts
      quotes.service.ts

    openapi/
      generator.ts
      registry.ts

  features/
    users/
      ui/
      hooks/
      api/
      index.ts

    shipments/
    quotes/

  lib/
    fetcher.ts
    openapi-client.ts
```

---

# 3. Layer Responsibilities

## 3.1 DTO (Zod Schemas)

Used for:

- Input validation
- Response types
- Service validation
- OpenAPI generation

---

## 3.2 DAL (Data Access Layer)

- Pure Drizzle
- No validation
- No business logic

```ts
export const createUserDal = (db, data) =>
  db.insert(users).values(data).returning();
```

---

## 3.3 Service Layer

- All business logic
- Receives validated inputs
- Calls DAL
- Calls integrations (Stripe, SMS, etc)

---

## 3.4 REST API Routes

- Validate request with DTO
- Call service
- Validate response
- Register endpoint in OpenAPI registry

---

## 3.5 Client API Layer (Frontend)

- Typed wrapper around REST
- Uses TanStack Query for data caching
- Never bypass the API

---

## 3.6 UI Layer

- Only presentation
- Uses hooks only
- No business logic
- No fetch inside components

---

# 4. OpenAPI Rules

## 4.1 Each API route MUST register itself

```ts
registerEndpoint({
  method: "POST",
  path: "/api/users",
  request: createUserInput,
  response: userOutput,
});
```

---

## 4.2 Auto-generate OpenAPI

```
pnpm openapi:generate
```

Produces:

```
/app/api/docs/openapi.json
```

---

## 4.3 Swagger UI must be available at:

```
/api/docs
```

---

# 5. Server Actions Rules

Server Actions allowed only for:

- Internal settings
- Simple side-effects
- User preference updates

NOT allowed for:

- Public API
- Stripe webhooks
- Authentication
- Integrations
- Multi-step workflows

---

# 6. TanStack Query Rules

### GET

- MUST use TanStack Query
- MUST use typed fetcher

### Mutations

- MUST invalidate queries
- MUST have error handling

---

# 7. Stripe Webhook Rules

```
/api/webhooks/stripe
```

Rules:

- Must use raw body
- Must validate event signature
- Must call service
- Must NOT access DB directly

---

# 8. Authentication (better-auth)

- API routes retrieve session server-side
- Services enforce permissions
- DAL does not access auth

---

# 9. File Rules

- One responsibility per file
- No deep imports
- Each feature must have an `index.ts`

---

# 10. Architecture Flow

## Frontend Flow

```
RSC (initial fetch)
    ↓
Feature Hooks (TanStack)
    ↓
Client API Wrapper
    ↓
REST API
```

## Backend Flow

```
API Route
    ↓
Service
    ↓
DAL
    ↓
DB
```

## Contract

```
DTO → OpenAPI → Autogenerated TS Client
```

---

# 11. Summary

This architecture enforces:

- REST API (public)
- Contract-first dev (OpenAPI)
- Full type safety
- Clean separation of concerns
- Stripe integration
- Feature-Driven Architecture
- Clean-code principles
- SOLID, KISS, YAGNI
- UI that is simple, reactive, cache-friendly
- Backend that is predictable, testable, extensible

**All AI-generated code MUST follow these rules.**

---
