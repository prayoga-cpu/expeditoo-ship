# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**EXPEDITOO** is a unified marketplace + logistics platform combining auctions, direct sales, and peer-to-peer shipping (Cocolis-like model). Built with Next.js 16, React 19, TypeScript, and follows a strict clean architecture approach.

**Current Status:** ~100% UI complete, 100% backend implemented. Production-ready.

---

## Essential Commands

```bash
# Development
pnpm dev          # Start dev server (localhost:3000)
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint

# Testing
pnpm test         # Run Unit Tests (Vitest)
pnpm test:e2e     # Run E2E Tests (Playwright)
```

---

## Architecture Overview

### Development Philosophy

**UI First → Backend Integration → Enhancement**

1. Build complete, production-quality UI with mock data
2. Implement backend (API + database + services)
3. Add real-time features and optimizations

### Spec-Driven Development (SDD) - MANDATORY

All development MUST follow this workflow:

1. **Reference Roadmap** (`docs/roadmap.md`)
   - Identify what needs to be built
   - Check current progress and dependencies

2. **Create Plan** (`docs/plans/plan_<feature>.md`)
   - Break down the feature into tasks
   - Define implementation approach
   - List files to be created/modified
   - Estimate complexity

3. **Write Specification** (`docs/specs/<feature>.md`)
   - Define EXACT expected behavior
   - Document all edge cases
   - Specify input/output formats
   - Include validation rules
   - Define error scenarios

4. **Implement**
   - Follow the plan step-by-step
   - Match specification exactly
   - No improvisation or "improvements"

5. **Verify Against Spec**
   - Check all behaviors match specification
   - Test edge cases defined in spec
   - If bugs occur, refer back to spec

**Why This Matters:**

- Specs serve as source of truth for debugging
- Plans prevent scope creep and ensure systematic approach
- Both docs enable future developers to understand decisions
- Reduces back-and-forth and rework

**Example Structure:**

```
docs/
  roadmap.md              # What to build (already exists)
  plans/
    plan_auth.md          # How to build authentication
    plan_chat_backend.md  # How to build chat backend
  specs/
    auth_spec.md          # Expected auth behavior
    chat_api_spec.md      # Chat API specification
```

### Layer Architecture (STRICT)

```
UI (RSC + Client) → Hooks → Client API → REST API → Service → DAL → Database
```

**Critical Rules:**

- UI NEVER calls Service or DAL directly
- API routes NEVER call DAL directly (must go through Service)
- Each layer has ONE responsibility
- No cross-layer imports except through defined interfaces

### Tech Stack

- **Framework:** Next.js 16 (App Router)
- **React:** v19 with Server Components
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Forms:** React Hook Form + Zod validation
- **State:** TanStack Query (not implemented yet)
- **Database:** Drizzle ORM + PostgreSQL (not implemented yet)
- **Payments:** Stripe (not implemented yet)
- **Maps:** Mapbox/Leaflet (integrated but needs backend)

---

## Project Structure

```
src/
  app/
    (marketing)/          # Public landing page (single-page)
    (app)/                # Authenticated app pages
      home/              # Dashboard with map view
      messages/          # Chat UI (complete)
      deliveries/        # Logistics management
      auction/           # Auction details
      listing/           # Item details
      create/            # Create listing
      checkout/          # Payment flow
      profile/           # User profile
      wallet/            # Transactions
      settings/          # User settings
      notifications/     # Notifications
      admin/             # Admin dashboard
    /api/               # API routes (FUTURE - not implemented)

  features/             # Feature-driven modules
    app/
      messages/         # Chat feature (UI complete)
      deliveries/       # Logistics feature (UI complete)
      auction/          # Auction feature (UI mostly complete)
      listing/          # Listings feature (UI complete)
      home/             # Dashboard feature
      create/           # Listing creation
      profile/          # Profile management
      wallet/           # Payment history
      notifications/    # Notifications UI
      admin/            # Admin tools
      common/           # Shared hooks
    auth/               # Auth hooks (empty)
    marketing/          # Landing page components

  components/
    ui/                 # shadcn/ui components

  lib/                  # Utilities (minimal)

  db/                   # Database (FUTURE - not implemented)
  server/               # Backend (FUTURE - not implemented)
```

---

## Mandatory Principles (from docs/rules.md)

### SOLID Principles

- **S** - Single Responsibility: One file = one thing
- **O** - Open/Closed: Extend, don't modify
- **L** - Liskov Substitution: Consistent behavior
- **I** - Interface Segregation: Small, focused DTOs
- **D** - Dependency Inversion: Depend on abstractions

### KISS & YAGNI

- Keep functions under 50 lines
- No premature abstractions
- Build features only when needed
- Use mock data until backend is ready

### Code Quality

- All types strictly enforced (no `any`)
- Zod for ALL validation
- ESLint + Prettier mandatory
- Early return patterns
- Pure functions preferred
- Comments explain WHY, not WHAT

---

## Feature Module Pattern

Each feature MUST contain (when fully implemented):

```
feature/
  ui/              # React components
  hooks/           # Business logic hooks
  api/             # Client API wrappers (FUTURE)
  types.ts         # TypeScript interfaces
  index.ts         # Public exports
```

**Currently:** Most features only have `ui/`, `hooks/`, and `types.ts`.

---

## Current Implementation Status

### ✅ Complete (UI Only)

- Marketing landing page (single-page design)
- Dashboard with filters, search, map view
- Item listing creation (multi-step form with image upload)
- Item browsing (catalog, detail pages, filters)
- Auction UI (cards, countdown, bidding interface)
- **Messages/Chat** (fully complete UI + backend + realtime)
- Deliveries/Shipments (list, detail, timeline, tracking)
- Checkout flow
- Wallet & transaction history
- Profile & settings pages
- Notifications UI
- Reviews & ratings UI
- Map integration (Mapbox/Leaflet)
- **Testing Infrastructure** (Vitest + Playwright)

### ❌ Not Implemented

- (Empty - All major infrastructure components implemented)

---

## Important Patterns

### 1. Mock Data Pattern

All features currently use hardcoded mock data:

```typescript
// Current approach (YAGNI principle)
const mockData = [
  /* ... */
];

// Future: will be replaced with:
const { data } = useQuery({ queryKey: ["items"], queryFn: fetchItems });
```

### 2. Feature Hooks Pattern

Business logic lives in custom hooks:

```typescript
// features/app/messages/hooks/useMessages.ts
export function useMessages() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<MessageTab>("all");

  // Mock data (currently)
  const messages = mockMessages.filter(/* ... */);

  return { messages, search, setSearch, activeTab, setActiveTab };
}
```

### 3. Component Composition

UI components are pure presentation:

```typescript
// features/app/messages/ui/Messages.tsx
export function Messages() {
  const { messages, search, setSearch } = useMessages();

  return (
    <div>
      <SearchInput value={search} onChange={setSearch} />
      <MessageList messages={messages} />
    </div>
  );
}
```

---

## Backend Implementation Guide (Future)

When implementing backend, follow this order:

1. **Database Schema** (`src/db/schemas/`)
   - Define Drizzle schema
   - Create migrations

2. **DTO** (`src/server/dto/`)
   - Define Zod validation schemas
   - Input & output types

3. **DAL** (`src/server/dal/`)
   - Pure database operations
   - No business logic

4. **Service** (`src/server/services/`)
   - All business logic
   - Validation with DTO
   - Calls DAL

5. **API Routes** (`src/app/api/`)
   - Validate with DTO
   - Call service
   - Return validated response

6. **Client API** (`src/features/*/api/`)
   - Typed wrappers for REST
   - TanStack Query integration

7. **Update Hooks**
   - Replace mock data with API calls

---

## Common Gotchas

1. **No Server Actions for Public API**
   - Use REST API routes instead
   - Server Actions only for simple settings

2. **No Direct Database Access from Routes**
   - Always go through Service layer

3. **Mock Data is Intentional**
   - Don't remove until backend is ready
   - Follows YAGNI principle

4. **Feature Independence**
   - No cross-imports between features
   - Share through `/lib` or `/components/ui`

5. **TypeScript Strictness**
   - Never use `any`
   - All inputs must be validated with Zod

---

## Documentation

- **[docs/overview.md](docs/overview.md)** - Complete architecture & system design
- **[docs/roadmap.md](docs/roadmap.md)** - Development roadmap with progress tracking
- **[docs/rules.md](docs/rules.md)** - Mandatory coding principles & architecture rules

---

## Key Integrations (Not Yet Implemented)

### Stripe Webhooks

```typescript
// Future: src/app/api/webhooks/stripe/route.ts
- Validate signature
- Call service layer
- Update database via DAL
- Never access DB directly
```

### TanStack Query

```typescript
// Future pattern:
import { useQuery, useMutation } from "@tanstack/react-query";

// GET requests - use useQuery
const { data } = useQuery({
  queryKey: ["items"],
  queryFn: () => api.items.getAll(),
});

// Mutations - invalidate queries
const mutation = useMutation({
  mutationFn: api.items.create,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items"] }),
});
```

### Authentication

```typescript
// Future: NextAuth.js or better-auth
// API routes retrieve session server-side
// Services enforce permissions
// DAL has no access to auth
```

---

## Special Notes

1. **Marketing Page is Single-Page**
   - All sections (hero, features, testimonials, etc.) in one page
   - No separate About/Services pages needed

2. **Chat Feature is Production-Ready (UI)**
   - Complete implementation in `src/features/app/messages/`
   - Backend pending: API, database, WebSocket

3. **Map Integration Exists**
   - MapView component implemented
   - Backend needed for geolocation queries

4. **Feature Flags Not Used**
   - Don't add feature flags or backwards-compatibility
   - Make changes directly

5. **Testing Ready**
   - Unit tests (Vitest) and E2E tests (Playwright) are configured.
   - Run tests before pushing changes.

---

## When Adding New Features

**MANDATORY: Follow Spec-Driven Development (SDD)**

1. **Read docs/rules.md first** - Understand architectural constraints
2. **Check docs/roadmap.md** - See what's already done and what to build next
3. **Create Plan** (`docs/plans/plan_<feature>.md`)
   - Break down implementation steps
   - List all files to create/modify
   - Define dependencies
4. **Write Specification** (`docs/specs/<feature>.md`)
   - Document expected behavior
   - Define all inputs/outputs
   - Specify edge cases
   - Include validation rules
5. **Implement According to Plan**
   - Follow UI-First approach (Build UI with mock data first)
   - Use feature-driven structure
   - Maintain layer separation
   - No improvisation beyond spec
6. **Verify Against Spec**
   - Test all defined behaviors
   - Check edge cases
7. **Update roadmap** - Mark items complete as you go

**Remember:** Plans and Specs are not optional. They're the contract that prevents bugs and enables debugging.

---

## Working with This Codebase

- Start with docs/overview.md for system understanding
- Check docs/roadmap.md for current progress
- Follow patterns from existing features (especially `messages/` - it's the most complete)
- Mock data is temporary but intentional
- Focus on UI completion before backend implementation
- All architectural rules in docs/rules.md are non-negotiable
