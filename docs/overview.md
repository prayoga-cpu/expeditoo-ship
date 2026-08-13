# **EXPEDITOO Project Overview**

**Version: 2025 — 1.0.0**

---

# 1. **General Objective**

EXPEDITOO is a unified digital platform combining:

- **Auction operations** (listing, bidding, purchasing)
- **Direct online sales**
- **Peer-to-peer and operator-based logistics (Cocolis-like)**
- **Secure payments via Stripe**
- **Real-time messaging between buyers and sellers**
- **Document and photo exchange**
- **Geolocation-based item discovery via map**
- **Automated notifications via WhatsApp or SMS** *(Deferred to V2 - using Email for V1)*

This document defines the **final high-level architecture** using:

- **Next.js (Frontend + Backend)**
- **REST API** (100% implemented - 105+ endpoints)
- **React Server Components (RSC)** for SSR
- **Client Components + TanStack Query** (Integrated for data fetching with caching)
- **Feature-driven architecture (React Bulletproof)**
- **Service Layer + DAL + DTO** (Clean Architecture implemented)
- **Drizzle ORM + PostgreSQL** (14+ schemas implemented)
- **Better-auth** (Authentication integrated)
- **Stripe Integration** (Checkout elements, Payment Intents, Webhooks, and Refunds fully implemented)
- **Ably Realtime** (Chat & Notifications implemented)
- **Map provider integration (MapLibre + OSM)** (UI integrated with CartoCDN tiles, Nominatim geocoding, OSRM routing)

Microservices are intentionally avoided. Everything lives in a **single scalable Next.js monorepo**.

---

# 2. **Two Main User-Facing Surfaces**

## **2.1 Marketing Website (Landing Page)**

Public-facing site for:

- Conversion & SEO
- Explaining services
- Pricing
- Contact form
- CTA to Login/Register

Lives under `app/(marketing)/`.

---

## **2.2 Main Web Application (Authenticated App)**

The core application for everyday operations:

- User dashboard with **real-time data from database**
- Auction management with search & filters
- Item uploads with **AI-powered slip processing**
- Map-based item browsing with **real coordinates**
- Public user profiles (`/user/[id]`)
- Chat & messaging with sellers
- Shipment tracking (Incoming & Outgoing)
- Transporter dashboard
- Payment history
- File & document uploads
- Profile & settings (with Help & Support link)
- Help & Support page

Lives under `app/(app)/`.

---

# 3. **High-Level System Architecture**

```
┌────────────────────────────────────────────────────────────────────┐
│                            Next.js App                             │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                        Frontend Layer                        │  │
│  │  - Landing Page (Marketing)                                  │  │
│  │  - Main App (Dashboard, Auctions, Shipping, Chat)            │  │
│  │  - React Server Components (SSR)                             │  │
│  │  - Client Components (forms, maps, bidding, messaging)       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                         API Layer                            │  │
│  │  Next.js Route Handlers                                      │  │
│  │  - Auth                                                       │  │
│  │  - Auctions                                                   │  │
│  │  - Items                                                      │  │
│  │  - Messages / Chat                                            │  │
│  │  - Shipments                                                  │  │
│  │  - Payments (Stripe)                                          │  │
│  │  - Files Upload                                               │  │
│  │  - Geolocation / Map                                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                Services (Business Logic Layer)                │  │
│  │  - Pricing logic                                              │  │
│  │  - Auction lifecycle                                          │  │
│  │  - Shipment status rules                                      │  │
│  │  - Chat & messaging workflows                                 │  │
│  │  - Notifications                                              │  │
│  │  - Document & file workflows                                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Data Access Layer (DAL)                    │  │
│  │                 Drizzle ORM + PostgreSQL                     │  │
│  │  - Users                                                     │  │
│  │  - Auctions                                                  │  │
│  │  - Items                                                     │  │
│  │  - Messages                                                  │  │
│  │  - Shipments                                                 │  │
│  │  - Payments                                                  │  │
│  │  - Files                                                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

External Integrations:
- Stripe (payments)
- Cloudflare R2 / S3 (file storage)
- WhatsApp or Twilio SMS
- Map provider (Mapbox / Leaflet)
- Ably (Real-time messaging & notifications)
```

---

# 4. **Core Functional Modules**

## **4.1 Auction & Sales Module**

Supports:

- Creating listings & items
- **AI-powered purchase slip processor** (auto-extracts dimensions, weight, price)
- Multi-step listing form with interactive map picker
- Automated size estimation based on dimensions
- Setting auction times
- **Bidding system** (fully functional with API)
  - Place bids with minimum €5 increment
  - Self-bidding prevention
  - Real-time bid history with TanStack Query (10s auto-refresh)
- **Auction status handling** (active, sold, ended, cancelled)
- Public profile pages for users (`/user/[id]`)
- User listing browsing on public profiles
- Auto assignment to shipping workflow after purchase
- Automated auction closing & winner determination (Cron-based)
- Auctioneer tools
- **My Auctions management** (fully functional)
  - View active/past auctions with TanStack Query caching
  - End auction (with confirmation dialog)
  - Delete auction (with confirmation dialog)
  - Repost auction (clone with new duration)
  - Edit auction (full form with data pre-fill)
- **My Bids management** (fully functional)
  - View active/ended bids with TanStack Query
  - Real-time bid status (winning, outbid, won, lost)
  - Premium card UI with status indicators
  - Auto-refresh for near-real-time updates

User Types:

- Buyers
- Sellers
- Auctioneers
- Admin

---

## **4.2 Logistics Module (Cocolis-like)**

Shipping workflow includes:

- Creating shipment requests
- Selecting items from map
- Auto-calculating dimensions/volume
- Scheduling (windows & blackout dates)
- Pricing engine (dynamic)
- Assigning transporters
- Tracking lifecycle:

```
PENDING → PRICE_PROPOSED → AWAITING_PAYMENT → PAID → ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED
```

---

## **4.3 Map-Based Item Discovery**

Users can:

- Browse all items on a map with real coordinates from database
- Filter by category, price range, size, and sort options
- Search by title or description (non-realtime)
- Click an item → open details → bid or request shipping
- Transporters can view open shipments on map

**Current Implementation:**

- ✅ Map displays listings with lat/lng from database
- ✅ Search API with title/description filtering
- ✅ Filter API (category, price, size)
- ✅ Sort API (ending soon, newest, price high/low)
- ✅ TanStack Query for data fetching
- ✅ Non-realtime search and filters (button-triggered)
- ✅ Dynamic z-index for overlapping map pins
- ✅ Mobile filter sheet with bottom nav padding
- ✅ Listing cards with Place Bid button

Backend features:

- Reverse geocoding
- Address normalization
- Spatial queries

---

## **4.4 Payments (Stripe)**

Includes:

- Checkout Sessions
- Payment Intents
- Billing & invoices
- Refund portal
- Webhooks to update shipment status

---

## **4.5 Notifications (Twilio or WhatsApp API)**

Used for:

- Order confirmation
- Payment reminders
- Delivery updates
- Driver–customer communication link

Recommended: **WhatsApp Business API** (cheaper & preferred by users).

---

## **4.6 Chat & Messaging Module**

Real-time messaging system for buyer-seller communication.

**Current Status:**

- ✅ Complete UI/UX implementation
- ✅ Message list with search and filtering (all/inbox/unread)
- ✅ Chat interface with message bubbles
- ✅ TypeScript types and interfaces defined
- ✅ Clean architecture foundation ready

**Features Implemented (Frontend):**

- Conversation list view (`/messages`)
- Individual chat view (`/messages/[id]`)
- Search by contact name or listing
- Tab filtering (all, inbox, unread with badge counts)
- Message composition with text input
- Responsive mobile-first design
- Context-aware messaging (linked to specific listings)

**Backend Implementation Status:**

- ✅ Database schema for conversations and messages
- ✅ REST API endpoints (`/api/messages`)
- ✅ Service layer for message workflows
- ✅ Message persistence and history loading
- ✅ Read receipts
- ✅ Real-time communication via Ably (Event-driven)
- ❌ File/image attachment support
- ❌ Typing indicators
- ✅ Integration with notification system (via Ably)

**Use Cases:**

- Buyers can message sellers about listed items
- Negotiate prices and shipping details
- Ask questions about item condition
- Coordinate pickup/delivery schedules
- All conversations linked to specific listings for context
- Driver proposals and negotiations
- All conversations linked to specific listings for context

---

## **4.8 User Verification & Trust**

**Objective**: Increase platform usage confidence by verifying user identities.

**Features:**

- **Verified Badge**: Visual indicator (blue tick) for verified users across the platform (Profile, Listings, Reviews).
- **Verification Process**: Admin-managed verification status.
- **Trust Metrics**: Publicly visible rating (stars) and review counts on user profiles.

---

## **4.7 Driver Workflow & Onboarding**

**Objective**: Enable users to apply as drivers and participate in the logistics marketplace.

**Workflow:**

1.  **Application**: User applies via Profile -> "Apply as Driver" (submits vehicle/license info).
2.  **Review**: Admin reviews application in Admin Dashboard -> "Driver Applications".
3.  **Approval**: Admin approves application -> User role updates to `DRIVER`.
4.  **Driver Panel**: Approved driver gains access to `/driver` dashboard.
5.  **Proposals**:
    - Driver views available shipments.
    - Driver submits **Proposal** (price/time) for a shipment.
    - Admin/Operator selects the best proposal.
    - Shipment assigned to Driver.
6.  **Driver Dashboard**:
    - **Active Shipments**: Overview of ongoing deliveries.
    - **My Shipments**: History with status filters (Waiting, Approved, Active, Done).
    - **Available Shipments**: List of open shipments to bid on.
    - **Messages**: Communicate directly with users regarding shipments.

---

# 5. **Internal Architecture (Clean Modular Structure)**

```
/src
  /app
    /(marketing)
    /(app)
      /messages              # Chat UI pages (existing)
        /[id]                # Individual chat view
    /api
      /shipments
      /auctions
      /messages              # Chat API endpoints (future)
      /payments
      /uploads
      /users
      /map

  /features
    /app
      /messages              # Chat feature module (existing)
        /hooks               # useMessages, useMessageDetail
        /ui                  # Messages, MessageDetail, ChatBubble
        /types.ts            # Message interfaces
    /shipping
    /auction
    /items
    /payment
    /user
    /map

  /db
    /schemas
      messages.ts            # Messages & conversations schema (future)
    /migrations

    /lib
    /stripe
    /auth
    /ably-server           # Real-time messaging service
    /openapi (optional)
    /geo
    /utils
```

---

# 6. **Workflow Examples**

## **6.1 Shipment Request Flow**

```
Client Form → TanStack Mutation → API Route Handler
  → Controller → Service → DAL → PostgreSQL
  → Response → RSC Refresh
```

---

## **6.2 Stripe Payment Flow**

```
User Checkout → Stripe → Webhook → Next.js Handler
  → Service → DAL → Update Shipment Status
  → Send Notification
```

---

## **6.3 File Upload Workflow**

```
Client → Get Presigned URL → Upload to R2/S3 → Save DB metadata
```

---

## **6.4 Auction Lifecycle Flow**

```
cron-job.org (Every Minute) → API Route (/api/cron/close-auctions)
  → Service (processExpiredAuctions) → DAL (Find Expired Active Listings)
  → Determine Winner (Highest Bidder) → Update Listing Status (Ended) & WinnerId
```

---

## **6.5 Chat Message Flow**

**Current (Frontend Only):**

```
User Types Message → Local State Update → UI Re-render
```

**Implemented (Full Implementation):**

```
User Types Message → TanStack Mutation → API Route Handler
  → Service → DAL → Save to PostgreSQL
  → Start Parallel Process (Fire-and-Forget)
  → Ably Server Publish → Ably Cloud
  → Client Receives Event via WebSocket
```

**Message History Loading:**

```
Client Opens Chat → RSC Fetches History → API Route Handler
  → Service → DAL → PostgreSQL → Return Messages
  → WebSocket Connection Established
```

---

# 7. **User Roles Summary**

| Role            | Capabilities                             |
| --------------- | ---------------------------------------- |
| **Buyer**       | Browse items, bid, buy, request shipping |
| **Seller**      | Create listings, upload items            |
| **Auctioneer**  | Manage auctions, approve items           |
| **Transporter** | Accept jobs, track deliveries            |
| **Admin**       | Full platform management                 |

---

# 8. **Summary**

EXPEDITOO is built as a unified Next.js monolith with:

- Clean domain-driven structure
- Strong separation between UI → API → Service → DAL
- Full integration with Stripe, maps, WhatsApp/SMS, and real-time messaging
- Support for auctions, logistics, payments, chat, and operators
- Feature-complete UI with progressive backend implementation
- A scalable foundation that can evolve into microservices in the future.

This architecture is production-ready and supports fast MVP delivery while maintaining long-term scalability. The chat feature demonstrates our approach: build complete, production-quality UI first, then progressively enhance with backend services as needed.

---
