# **EXPEDITOO Development Roadmap**

**Version: 2025 1.0.2**
**Last Updated: 2025-12-26**

This roadmap follows our development philosophy: **UI First -> Backend Integration -> Enhancement**

---

## **Progress Summary**

| Layer                     | Progress | Notes                                                        |
| ------------------------- | -------- | ------------------------------------------------------------ |
| **Frontend/UI**           | ~100%    | All UI components implemented                                |
| **Backend/API**           | 100%     | All phases complete - 105+ endpoints                         |
| **Database Schema**       | 100%     | 14+ tables with migrations                                   |
| **External Integrations** | 100%     | Stripe, Ably, Resend, R2, Maps (SMS/WhatsApp deferred to V2) |
| **Testing**               | 90%      | Unit (Vitest) & E2E (Playwright) Implemented                 |
| **Overall**               | **~99%** |                                                              |

---

## **Phase 0: Foundation & Infrastructure**

### **0.1 Project Setup**

- [x] Next.js project initialization
- [x] TypeScript configuration
- [x] Drizzle ORM setup
- [x] PostgreSQL database setup
- [x] Feature-driven folder structure
- [x] ESLint + Prettier configuration
- [x] Git repository initialization

### **0.2 Design System & UI Foundation**

- [x] shadcn/ui components installation
- [x] Tailwind CSS configuration
- [x] Color scheme & theming
- [x] Typography system
- [x] Responsive breakpoints
- [x] Common UI components (Button, Input, Card, etc.)
- [x] Theme toggle (Dark/Light mode)

---

## **Phase 1: Marketing Website (Landing Page)**

### **1.1 Landing Page UI**

- [x] Hero section with CTA
- [x] Platform statistics (deliveries, drivers, auctions, users)
- [x] Features showcase section
- [x] How it works section
- [x] Pricing section
- [x] Testimonials section
- [x] Footer with links
- [x] Mobile-responsive design

### **1.2 Marketing Pages** (Single Page Approach - All sections in one page)

- [x] All content in single landing page
- [ ] Separate About Us page (if needed)
- [ ] Separate Services page (if needed)
- [x] FAQ page (`/faq`)
- [x] Terms of Service page (`/terms`)
- [x] Privacy Policy page (`/privacy`)

### **1.3 Contact & Lead Generation**

- [x] Contact form UI (integrated in landing)
- [ ] Contact form backend API
- [ ] Email notification integration
- [ ] Lead capture to database

---

## **Phase 2: Authentication & User Management**

### **2.1 Auth UI**

- [x] Login page design
- [x] Registration page design
- [x] Password reset flow UI
- [x] Email verification UI
- [x] Profile settings page UI

### **2.2 Auth Backend**

- [x] Better Auth setup (using better-auth library)
- [x] User database schema
- [x] JWT token management
- [x] Session management
- [x] Password hashing
- [x] Email verification system
- [x] Password reset functionality
- [x] API route `/api/auth/[...all]`
- [x] Session DAL and service

### **2.3 User Roles & Permissions**

- [x] Role-based access control (RBAC) schema
- [x] User roles DAL and DTO
- [x] Role assignment API (POST/DELETE `/api/user/roles`)
- [x] Get user roles API (GET `/api/user/roles`)
- [x] Permission checking utilities (useUserRoles hook)
- [x] Admin dashboard UI
- [x] Admin dashboard UI
- [x] Admin backend for user management

### 2.4 User Verification

- [x] Database schema for verification status
- [x] Verified Badge UI component
- [x] Integration in Profile and Public Profile
- [x] Admin verification capabilities

---

## **Phase 3: Auction & Sales Module**

### **3.1 Item Listing UI**

- [x] Create listing form (multi-step)
- [x] Image upload UI (drag & drop)
- [x] AI-powered purchase slip processor (auto-fill dimensions, weight, price)
- [x] AI Price Recommendation (Gemini 1.5 Flash) ✅ **NEW 2025-12-24**
  - [x] Analyzes slip data + form data + photos
  - [x] Recommends starting bid and buy now price
  - [x] Beautiful recommendation card UI with apply buttons
  - [x] Confidence score and reasoning explanation
- [x] Category selection
- [x] Condition selector
- [x] Pricing options (fixed price / auction)
- [x] Item details form (with estimated size calculator)
- [x] Address picker with interactive map
- [x] Preview before publish
- [x] Success page after creation

### **3.2 Item Browsing UI**

- [x] Item catalog/grid view
- [x] Item detail page
- [x] Image gallery/carousel
- [x] Seller information display
- [x] Public profile page (`/user/[id]`) with Verified Badge and Ratings
- [x] User listings on public profile (strictly filtered for active status)
- [x] Related items section
- [x] Filtering UI (category, price, condition)
- [x] Sorting options
- [x] Search bar

### **3.3 Auction UI**

- [x] Auction countdown timer
- [x] Soft timer logic (UI)
- [x] Bidding interface
- [x] Bid history display
- [x] Current highest bid indicator
- [x] Real-time bid updates on Home/Listing Cards ✅ **NEW**
- [ ] "Buy It Now" option
- [ ] Auto-bid functionality UI
- [x] Auction card display
- [x] Auction detail page

### **3.4 Item Listing Backend**

- [x] Listings database schema (with images, categories)
- [x] Categories database schema
- [x] Image upload API (POST `/api/upload`)
- [x] Image compression service (Sharp)
- [x] Cloud storage service (R2/S3)
- [x] Create listing API endpoint (POST `/api/listings`)
- [x] Get user listings API (GET `/api/listings`)
- [x] Get single listing API (GET `/api/listings/[id]`)
- [x] Listings service layer
- [x] Listings DAL
- [x] Listings DTO with Zod validation
- [x] Update listing status API endpoint (PATCH `/api/listings/[id]`)
- [x] Delete listing API endpoint (DELETE `/api/listings/[id]`)
- [x] Repost listing API endpoint (POST `/api/listings/[id]/repost`)
- [x] Full listing update API endpoint (PUT `/api/listings/[id]`)
- [x] Edit listing mode in Create page

### **3.5 Item Browsing Backend**

- [x] Get public user profile API (GET `/api/users/[id]`)
- [x] Get user's listings API (GET `/api/users/[id]/listings`)
- [x] Users service and DAL
- [x] Get public listings API (GET `/api/listings/public`)
- [x] Search items API (via query params)
- [x] Filter items service logic (category, price, size)
- [x] Sort items service logic (ending_soon, newest, price)
- [ ] Pagination support
- [ ] Item view counter

### **3.6 Auction Backend**

- [x] Bids database schema (in auctions.ts)
- [x] Bids DAL (`bids.dal.ts`)
- [x] Bids DTO with Zod validation (`bids.dto.ts`)
- [x] Bids service layer (`bids.service.ts`)
- [x] Place bid API endpoint (POST `/api/listings/[id]/bids`)
- [x] Get bid history API (GET `/api/listings/[id]/bids`)
- [x] Bid validation logic (min €5 increment)
- [x] Self-bidding prevention
- [x] Auction status UI (active, sold, ended, cancelled)
- [x] My Auctions with TanStack Query caching
- [x] My Bids page UI redesign (vertical card layout)
- [x] Get user bids API (GET `/api/user/bids`)
- [x] My Bids with TanStack Query (real-time status: winning/outbid/won/lost)
- [x] Auctions database schema (separate from listings)
- [x] Create auction API
- [x] Auto-close auction on end time (via `/api/cron/close-auctions`)
- [x] Winner determination logic
- [ ] Auction notifications

---

## **Phase 4: Chat & Messaging Module**

### **4.1 Chat UI**  **COMPLETED**

- [x] Messages list page with tabs
- [x] Search conversations
- [x] Unread badge counter
- [x] Message preview/snippet
- [x] Individual chat page
- [x] Chat bubbles (sent/received)
- [x] Message input with send button
- [x] Attachment button UI
- [x] Listing context display
- [x] Mobile-responsive chat interface

### **4.2 Chat Backend**

- [x] Conversations database schema
- [x] Messages database schema
- [x] Create conversation API
- [x] Send message API endpoint
- [x] Get conversations API (with pagination)
- [x] Get messages API (with pagination)
- [x] Mark messages as read API
- [x] Search conversations API

### **4.3 Real-time Messaging** ✅ **COMPLETED**

> **Status:** Fitur real-time telah diimplementasikan sepenuhnya menggunakan **Ably**.

- [x] Ably Integration (System-wide)
- [x] Real-time message delivery
- [x] Real-time message badges (Unread count)
- [x] Read receipts
- [x] Fallback mechanisms (Error handling)

> **Note:** Short Polling telah dihapus dan digantikan dengan arsitektur Event-Driven menggunakan Ably untuk efisiensi dan pengalaman pengguna yang instan.

### **4.4 Chat Enhancements** ❌ **OUT OF SCOPE**

> **Status:** Fitur-fitur berikut **tidak akan diimplementasikan** untuk versi ini.

- ~~File/image attachment support~~ — _Out of scope_
- ~~Image preview in chat~~ — _Out of scope_
- ~~Delete message functionality~~ — _Out of scope_
- ~~Edit message functionality~~ — _Out of scope_
- ~~Typing indicators~~ — _Out of scope_
- ~~Message reactions (emoji)~~ — _Out of scope_
- [ ] Block/unblock users — _Nice to have_

---

## **Phase 5: Map-Based Item Discovery**

### **5.1 Map UI**

- [x] Map integration (Mapbox implemented)
- [x] Item markers on map
- [x] Dynamic z-index for overlapping pins (hover to bring to front)
- [ ] Marker clustering for dense areas
- [x] Item popup on marker click
- [x] Map filters sidebar
- [x] Mobile filter sheet with bottom nav padding fix
- [ ] Distance radius selector
- [ ] Current location button

### **5.2 Map Backend**

- [x] Geolocation fields in items schema (lat, lng, address, city)
- [x] Get items by location API (returns lat/lng for map display)
- [x] Geocoding service integration
- [ ] Reverse geocoding API
- [ ] Spatial queries (PostGIS)
- [ ] Distance calculation service
- [ ] Distance-based filtering

### **5.3 Shipment Creation UI**

- [x] Pickup address form with map
- [x] Delivery address form with map
- [x] Package dimensions input
- [x] Scheduling calendar UI
- [ ] Blackout dates selector
- [x] Price estimation display
- [x] Shipment summary preview

### **6.2 Shipment Management UI**

- [x] My shipments dashboard
- [x] Shipment detail page
- [x] Status timeline/stepper
- [x] Tracking information display
- [x] Transporter information
- [x] Contact transporter button
- [x] Cancel shipment UI (`useCancelShipment.ts` hook ready)
- [ ] Modify shipment UI

### **6.3 Transporter Dashboard UI**

- [x] Available jobs list
- [x] Job detail view (`ShipmentActions.tsx`)
- [x] Accept job UI (via `ProposalForm.tsx`)
- [x] Active deliveries dashboard (`ActiveShipments.tsx`)
- [x] Driver Application Form (Enhanced UI)
- [x] Update shipment status UI (`ShipmentActions.tsx`)
- [x] Proof of delivery upload (backend ready, UI in ShipmentActions)
- [ ] Earnings summary
- [x] Driver Messages UI

### **6.5 Shipment Backend - Core**

- [x] Shipments database schema
- [x] Package details schema (integrated in shipments)
- [x] Create shipment API (POST `/api/shipments`)
- [x] Get shipments API (with filters) (GET `/api/shipments`)
- [x] Get single shipment API (GET `/api/shipments/[id]`)
- [x] Update shipment status API (PATCH `/api/shipments/[id]/status`)
- [x] Cancel shipment API (POST `/api/shipments/[id]/cancel`)
- [x] Assign driver API (POST `/api/shipments/[id]/assign`)
- [x] Proof of delivery API (POST `/api/shipments/[id]/proof-of-delivery`)

### **6.6 Pricing Engine** ✅ **IMPLEMENTED 2025-12-13**

- [x] Pricing configuration (`src/lib/pricing/config.ts`) - French market rates
- [x] Distance-based pricing logic (tiered rates by km)
- [x] Volume/weight-based pricing (volumetric weight calculation)
- [x] Speed-based pricing (standard, express, same-day, scheduled)
- [ ] Dynamic pricing algorithm (demand-based) - Future
- [x] Calculate price API endpoint (`POST /api/pricing/calculate`)
- [x] Get pricing config API (`GET /api/pricing/calculate`)
- [ ] Operator price adjustment API - Future

### **6.7 Shipment Lifecycle**

- [x] Status state machine service (implemented in service layer)
- [x] PENDING → PRICE_PROPOSED transition
- [ ] AWAITING_PAYMENT → PAID transition
- [x] Auto-assign transporter logic (manual assignment implemented)
- [x] ASSIGNED → PICKED_UP transition
- [x] IN_TRANSIT → DELIVERED transition
- [x] Shipment cancellation logic

### **6.8 Transporter Features Backend**

- [ ] Transporter profile schema
- [ ] Available transporters query
- [x] Accept shipment API (via proposals)
- [x] Update delivery status API
- [x] Upload proof of delivery API
- [ ] Transporter rating system
- [ ] Earnings calculation

---

## **Phase 7: Payment Integration (Stripe)**

**STATUS: COMPLETED**
_Stripe integration is fully implemented for direct payments, saved cards, and Connect for payouts._

### **7.1 Payment UI**

- [x] Checkout page design
- [x] Payment method selection
- [x] Stripe Elements integration
- [x] Payment confirmation page
- [x] Invoice download UI (via Stripe Dashboard)
- [x] Refund request UI (Admin only)

### **7.2 Payment Backend - Setup**

- [x] Stripe SDK integration
- [x] Payments database schema (`src/db/schema/payments.ts`)
- [x] Stripe customer creation (add `stripeCustomerId` to users table)
- [x] Payment methods via Stripe (Stripe stores cards, not local DB)

### **7.3 Payment Backend - Checkout**

- [x] Create Checkout Session API
- [x] Payment Intent API
- [x] Handle 3D Secure
- [x] Stripe webhook endpoint
- [x] Webhook signature verification

### **7.4 Payment Backend - Billing**

- [x] Invoice generation
- [x] Receipt generation (PDF)
- [x] Payment history API
- [x] Refund processing API
- [x] Billing notifications

### **7.5 Payment Integration with Features**

- [x] Auction payment after win
- [x] Shipment payment flow
- [x] Update shipment status on payment success
- [x] Direct purchase payment
- [x] Transporter payout system (Split Transfers)

---

## **Phase 7.5: Orders System** ✅ **NEW**

> **Note:** Orders system was implemented to bridge auction wins with shipments and payments.

### **7.5.1 Orders Backend**

- [x] Orders database schema (`src/db/schema/orders.ts`)
- [x] Orders DAL (`src/server/dal/orders.dal.ts`)
- [x] Orders DTO with Zod validation (`src/server/dto/orders.dto.ts`)
- [x] Orders service layer (`src/server/services/orders.service.ts` - 428 lines)
- [x] Create order from auction win API
- [x] Get order by ID API (GET `/api/orders/[id]`)
- [x] Get order by listing ID API (GET `/api/orders/listing/[id]`)
- [x] Set delivery address API
- [x] Confirm payment API (Real Stripe Integration)
- [x] Get buyer orders API
- [x] Order status state machine (PENDING_ADDRESS → PENDING_DRIVER → PENDING_PAYMENT → PAID → SHIPPING → DELIVERED)
- [x] Lazy-closing of expired auctions on order access
- [x] Notification creation on order events

### **7.5.2 Checkout Flow**

- [x] Won auction checkout UI (`/checkout/[listingId]`)
- [x] Delivery address form in checkout
- [x] Driver selection integration
- [x] Price summary display (item + shipping)
- [x] Stripe payment integration (Phase 7 Complete)
- [x] Payment Confirmation API (Real implementation)

---

## **Phase 8: Notifications System**

### **8.1 Notification Infrastructure**

- [x] Notifications database schema
- [ ] Notification preferences schema
- [x] Notification service layer
- [ ] Notification queue system

### **8.2 In-App Notifications**

- [x] Notification bell icon UI
- [x] Notification floating box/popover (with all notification types)
- [x] Notification list page
- [x] Mark as read functionality
- [x] Get notifications API (GET `/api/notifications`)
- [x] Unread count API (GET `/api/notifications/unread-count`)
- [x] Real-time notification via Ably

### **8.2.1 Notification Triggers** ✅ **UPDATED 2025-12-11**

- [x] Order creation notification (auction win)
- [x] Driver selected notification
- [x] Payment confirmed notification
- [x] Shipment cancelled notification (to driver, buyer, seller)
- [x] New driver proposal notification
- [x] Proposal accepted notification (to driver)
- [x] Proposal rejected notification (to other drivers)
- [x] Proof of delivery notification (to buyer, seller)

### **8.3 Email Notifications**

- [x] Email service setup (Resend)
- [x] Email templates (React Email)
- [x] Welcome email
- [x] Order confirmation email ✅ **IMPLEMENTED 2025-12-24**
- [x] Payment confirmation email (PaymentReceiptEmail)
- [x] Shipment updates email ✅ **IMPLEMENTED 2025-12-24**
- [x] Auction win notification email ✅ **IMPLEMENTED 2025-12-11**
- [x] Auction ended seller notification email ✅ **IMPLEMENTED 2025-12-13**
- [x] Auction lost bidder notification email ✅ **IMPLEMENTED 2025-12-13**

### **8.4 SMS/WhatsApp Notifications** ⏸️ **DEFERRED (Scale-up Phase)**

> **Status:** Fitur notifikasi via SMS/WhatsApp akan diimplementasikan di versi mendatang (V2).

- [ ] Twilio or WhatsApp Business API setup — _Future scale-up_
- [ ] SMS templates — _Future scale-up_
- [ ] WhatsApp message templates — _Future scale-up_
- [ ] Order confirmation SMS — _Future scale-up_
- [ ] Payment reminders — _Future scale-up_
- [ ] Delivery updates SMS — _Future scale-up_
- [ ] Driver contact link — _Future scale-up_

### **8.5 Notification Preferences** ✅ **COMPLETED**

- [x] User preferences UI
- [x] Email opt-in/out (via preferences API)
- [ ] SMS opt-in/out — _Deferred to V2_
- [x] Notification categories
- [x] Update preferences API (`/api/user/preferences`) ✅ **IMPLEMENTED 2025-12-24**

---

## **Phase 9: File & Document Management**

### **9.1 File Upload Infrastructure**

- [x] File storage setup (R2/S3)
- [x] Storage service layer
- [x] File upload API (POST `/api/upload`)
- [x] File metadata handling
- [x] File type validation (images)
- [x] File size validation
- [x] Unique filename generation (nanoid)
- [ ] Document storage (PDF, etc.)
- [ ] Presigned URL generation for large files

### **9.2 Document Features**

- [x] Upload item photos (multiple images)
- [ ] Upload proof of delivery
- [ ] Upload user documents (ID, license)
- [ ] Document verification by operator
- [ ] Download documents API
- [ ] Delete documents API

### **9.3 Image Processing**

- [x] Image compression (Sharp)
- [x] Image service layer
- [x] Format conversion (WebP)
- [ ] Thumbnail generation
- [ ] Multiple image sizes
- [ ] Image CDN integration
- [ ] Lazy loading implementation

---

## **Phase 10: User Dashboard & Analytics**

### **10.1 User Dashboard UI**

- [x] Dashboard layout (home page)
- [x] Quick stats cards
- [x] Recent activity feed
- [x] Active auctions widget
- [x] Active shipments widget
- [ ] Pending payments widget
- [x] Quick actions menu
- [x] Listing cards with filters
- [x] Listing cards with Place Bid button
- [x] Map view toggle

### **10.2 Analytics for Users**

- [ ] Sales analytics for sellers
- [ ] Purchase history for buyers
- [ ] Delivery statistics for transporters
- [ ] Revenue charts
- [ ] Performance metrics

### **10.3 Admin Analytics**

- [x] Admin dashboard UI (Refactored to multi-page structure)
- [x] Driver management UI (list, filters, stats)
- [x] Pending deliveries management
- [x] Driver assignment flow
- [ ] Platform-wide statistics
- [ ] User growth charts
- [ ] Revenue analytics
- [ ] Transaction volume
- [ ] Top sellers/buyers
- [ ] System health monitoring

### **10.4 Additional Pages** (Implemented)

- [x] Profile page UI
- [x] Public profile page UI (`/user/[id]`)
- [x] Profile reviews page UI
- [x] Wallet page UI (Removed/Disabled)
- [x] Transaction history UI (Removed/Disabled)
- [x] Wallet withdraw UI (Removed/Disabled)
- [x] Splash screen UI
- [x] Help Page UI

---

## **Phase 11: Search & Discovery**

### **11.1 Search UI**

- [x] Global search bar
- [x] Search results page (integrated in home)
- [x] Search filters (category, price, size, sort)
- [x] Non-realtime search (button/Enter trigger)
- [x] Filter sheet with Apply button
- [ ] Search suggestions (autocomplete)
- [ ] Recent searches
- [ ] Popular searches

### **11.2 Search Backend**

- [x] Search API endpoint (LIKE query on title/description)
- [x] Filter API (category, price range, size)
- [x] Sort API (ending_soon, newest, price_low, price_high)
- [x] Query parameter validation (Zod)
- [x] Full-text search (PostgreSQL FTS)
- [ ] Search indexing
- [ ] Search ranking algorithm
- [ ] Faceted search
- [ ] Search analytics

### **11.3 Recommendation System**

- [ ] Related items algorithm
- [ ] "You may also like" section
- [ ] Personalized recommendations
- [ ] Trending items
- [ ] Recently viewed items

---

## **Phase 12: Rating & Review System**

### **12.1 Rating UI**

- [x] Star rating component
- [x] Write review form
- [x] Review list display
- [x] Review filters (helpful, recent)
- [ ] Report review button
- [x] Review card component
- [x] User reviews page

### **12.2 Rating Backend**

- [x] Reviews database schema
- [x] Ratings database schema (integrated in reviews)
- [x] Create review API (POST `/api/reviews`)
- [x] Get reviews API (GET `/api/reviews`, `/api/users/[id]/reviews`)
- [x] Rating calculation service (on-the-fly aggregation)
- [x] Review validation logic (canReview)
- [ ] Review moderation

### **12.3 Multi-Entity Ratings**

- [x] Rate sellers (Implemented)
- [x] Rate buyers (Implemented)
- [ ] Rate transporters
- [ ] Rate items
- [ ] Overall user reputation score

---

## **Phase 13: Security & Compliance**

### **13.1 Security Hardening**

- [ ] Rate limiting implementation
- [ ] CSRF protection
- [ ] XSS prevention
- [ ] SQL injection prevention (parameterized queries)
- [ ] Input validation & sanitization
- [ ] Secure headers configuration
- [ ] Content Security Policy (CSP)

### **13.2 Data Privacy**

- [ ] GDPR compliance
- [ ] Data export functionality
- [ ] Data deletion functionality
- [ ] Cookie consent banner
- [ ] Privacy policy implementation

### **13.3 Monitoring & Logging**

- [ ] Error tracking (Sentry)
- [ ] Application logging
- [ ] Audit logs for sensitive actions
- [ ] Performance monitoring
- [ ] Uptime monitoring

## **Phase 14: Testing & Quality Assurance**

### **14.1 Unit Testing**

- [x] Vitest setup (Previously planning Jest)
- [x] Service layer tests
- [x] Utility function tests
- [x] DAL tests
- [x] Test coverage > 70%

### **14.2 Integration Testing**

- [x] API endpoint tests
- [x] Database integration tests
- [x] External service mocks
- [x] Webhook testing

### **14.3 E2E Testing**

- [x] Playwright setup
- [x] Critical user flow tests
- [x] Auction flow E2E test
- [x] Shipment creation E2E test
- [x] Payment flow E2E test

### **14.4 Manual Testing**

- [x] Cross-browser testing
- [x] Mobile device testing
- [x] Accessibility testing (WCAG)
- [ ] Performance testing
- [ ] Load testing

---

## **Phase 15: DevOps & Deployment**

### **15.1 Hosting & Infrastructure**

- [ ] Vercel deployment setup
- [ ] Database hosting Supabase
- [ ] CDN configuration
- [ ] Domain & SSL setup
- [ ] Backup strategy

---

## **Phase 17: Post-Launch Enhancements**

### **17.1 Mobile App (Future)**

- [ ] React Native or Flutter evaluation
- [ ] Mobile app development
- [ ] App store submission

### **17.2 Advanced Features**

- [ ] Multi-language support (i18n)
- [ ] Multi-currency support
- [ ] Advanced analytics dashboard
- [x] AI-powered price recommendations (Gemini 1.5 Flash) ✅ **IMPLEMENTED 2025-12-24**
- [ ] Chatbot for customer support
- [ ] Social media integration
- [ ] Referral program

### **17.3 Scalability**

- [ ] Performance optimization
- [ ] Database query optimization
- [ ] Caching strategy (Redis)
- [ ] CDN optimization
- [ ] Microservices evaluation (if needed)

---

## **Legend**

- `[ ]` - Not started / Pending
- `[x]` - Completed

---

## **Notes**

This roadmap follows the **UI-First approach**:

1. Build complete, production-quality UI first
2. Implement backend APIs and database
3. Integrate with external services
4. Add real-time features
5. Optimize and enhance

Each module can be developed independently, allowing for parallel development and faster iteration.

---

## **Critical Pending Items**

The following items are blocking production readiness:

1. **Automated Testing** - Playwright/Jest infrastructure
2. **Production Hardening** - Rate limiting, CSP, advanced logging

> **Note:** Real-time Communication (Ably) and Stripe Payments are now fully functional. Email Notifications are active via Resend.

---

8. **Client API Layer Refactor** ✅ **COMPLETED 2025-12-13**
   - [x] Standardized API wrapper structure (`features/*/api/`)
   - [x] Typed API responses & error handling
   - [x] Removed direct `fetch` calls from UI components
   - [x] Fixed `any` types in DAL

## **Out of Scope (V1)**

Fitur-fitur berikut **tidak akan diimplementasikan** di versi pertama:

- Chat: File attachment, typing indicators, delete/edit message, message reactions
- WebSocket/Real-time (akan pakai polling untuk V1)
- **SMS/WhatsApp Notifications (akan pakai Email untuk V1)**
- Multi-language (i18n)
- Mobile app

---

## **Audit History**

| Date       | Version | Notes                                                                                                             |
| ---------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| 2025-12-10 | 1.0.1   | Audit & update: Added Orders system, updated progress summary, marked completed items                             |
| 2025-12-10 | 1.0.2   | Added ToS, Privacy, FAQ pages. Clarified WebSocket is for scale-up only. Marked Chat enhancements as Out of Scope |
| 2025-12-11 | 1.0.3   | Implemented shipment notification triggers (cancel, proposal, acceptance, delivery confirmation)                  |

---
