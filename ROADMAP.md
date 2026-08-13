# EXPEDITOO — Roadmap

**Reverse-bidding transport marketplace**
Version 2.0 · 04/08/2026 · PRIONATION.io for Atout Global Services

---

## 1. What this product is

Shippers post transport jobs. Carriers bid with price, ETA and vehicle. The shipper compares offers and picks a carrier. Stripe holds and releases payment.

There are no goods auctions in Expeditoo. The only auction here is the **reverse auction on transport**, carriers competing downward on price.

| | |
|---|---|
| Market | France, road transport, any category |
| Model | Two-sided marketplace, competitive bidding |
| Revenue | 10% commission on each completed delivery |
| Selection | **The client selects** the carrier from submitted bids |
| Upstream feed | Escalated jobs from Expedion when no driver is available |

---

## 2. Roles

| Role | Can do |
|---|---|
| **Shipper** | Register, create and edit listings, receive offers, chat, select carrier, pay, track, review |
| **Carrier** | Register with KYC, browse listings, submit offers, chat, manage schedule, update status, deliver, get paid |
| **Admin** | Manage users, moderate listings, approve carrier applications, handle payments and refunds, view statistics, force-escalate jobs |

---

## 3. Core flow

```
Shipper posts a job
   ↓  what / where / when / price expectation
Job goes live on the marketplace
   ↓  matching carriers notified
Carriers submit bids
   ↓  price + ETA + vehicle + message
Shipper compares and accepts one
   ↓  Stripe payment authorised
Pickup → In transit → Delivered
   ↓  status updates at each stage
Payout to carrier, two-way review
```

**Escalation inlet.** A job arriving from Expedion enters at "Job goes live" with a flag marking its origin. Everything downstream is identical. When a carrier is selected, the status writes back so the Expedion client sees "retrait en cours" without leaving their app.

---

## 4. Screens

| Group | Screens |
|---|---|
| **Public** | Splash, landing, pricing, FAQ, terms, privacy |
| **Auth** | Login, register, forgot password, reset password, verify email |
| **Shipper** | Home + map, search and filters, create listing (multi-step), listing details, my listings, offers received, chat, checkout, deliveries, tracking, wallet, payments, profile, settings, notifications |
| **Carrier** | Dashboard, browse jobs, job details, submit offer, my jobs, schedule, active delivery, proof of delivery, earnings, chat, profile |
| **Admin** | Dashboard, users, carrier applications, listings, shipments, payments, support, reports, statistics |

---

## 5. Data entities

`users` · `profiles` · `carriers` · `vehicles` · `listings` · `photos` · `offers` · `conversations` · `messages` · `shipments` · `payments` · `payouts` · `categories` · `reviews` · `notifications`

Two fields carry the cross-product bridge:

| Field | Purpose |
|---|---|
| `listings.origin` | `direct` or `expedion` |
| `listings.external_ref` | Expedion quote ID, for status write-back |

---

## 6. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16, React 19, TypeScript 5 |
| Styling | Tailwind CSS v4 + shadcn/ui + Radix |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Better Auth |
| Realtime | Ably (chat, bids, notifications) |
| Payments | Stripe Checkout + Connect |
| Storage | Cloudflare R2 + Sharp |
| Email | Resend + React Email |
| Maps | MapLibre GL, OSM, Nominatim, OSRM |
| AI | GPT-4.1 Vision (document extraction, price suggestion) |
| i18n | next-intl, FR + EN |
| Mobile | next-pwa + Capacitor (Android) |
| Testing | Vitest + Playwright |

Architecture rule, unchanged: **UI → Hooks → Client API → REST → Service → DAL → DB.** No shortcuts, no `any`, Zod at every boundary.

---

## 7. Design system

This is the canonical source. Expedion mirrors it exactly.

### Colour tokens

| Token | Light | Dark |
|---|---|---|
| `primary` | `#076BE3` | `#076BE3` |
| `primary-foreground` | `#FFFFFF` | `#FFFFFF` |
| `background` | `#FCFCFC` | `#010408` |
| `foreground` | `#050C13` | `#E5F0FC` |
| `card` | `#FFFFFF` | `#0B121A` |
| `muted` | `#D3D8DE` | `#333C45` |
| `muted-foreground` | `#606A74` | `#86909B` |
| `border` | `#EAEFF5` | `#212A33` |
| `input` | `#F4F9FF` | `#141B24` |
| `success` | `#3FB171` | `#3FB171` |
| `warning` | `#D18500` | `#D18500` |
| `accent-orange` | `#F6722B` | `#F6722B` |
| `destructive` | `#ED3151` | `#ED3151` |

Source of truth is `oklch` in `globals.css`. The hex column exists so Flutter can match.

### Typography

| Use | Font | Weight |
|---|---|---|
| UI and body | Plus Jakarta Sans | 400 / 500 / 600 |
| Code and numerals | Geist Mono | 400 |

### Shape and spacing

| Token | Value |
|---|---|
| `radius` base | `0.5rem` (8px) |
| `radius-sm` | 6px |
| `radius-lg` | 12px |
| `radius-xl` | 16px |
| Card padding | 16–20px |
| Section gap | 24px |
| Transition | 200ms ease-in-out on colour, border, fill |

### Component conventions

- 64 shadcn/ui primitives in `src/components/ui`
- Status pills use `success` / `warning` / `destructive` tints with matching darker text
- Empty states go through `centered-empty-state.tsx`, never ad-hoc
- Page transitions go through `page-wrapper.tsx` and `page-loader.tsx`
- Both light and dark mode are mandatory for every new surface

---

## 8. Delivery phases

### Phase A — Bidding core *(current)*

| Item | Notes |
|---|---|
| Strip goods-auction modules | Auctions, bids-on-items, won-auction checkout, related crons |
| Offers engine | Carriers submit price + ETA + vehicle, shipper accepts one |
| Listing form rebuild | What / where / when / pricing, categories, 13 location types |
| Carrier KYC | CNI, licence, vehicle, IBAN/BIC, RIB, admin approval |
| Role expansion | 5 → 7 user types |

**Exit criteria:** a shipper can post a job, three carriers can bid, the shipper accepts one and pays.

### Phase B — Escalation bridge

| Item | Notes |
|---|---|
| `origin` + `external_ref` on listings | Marks Expedion-sourced jobs |
| Inbound escalation endpoint | Expedion pushes a quote, becomes a live listing |
| Status write-back | Carrier selection and delivery status return to Expedion |
| Auto-escalate timer | Fires after the configured window with no driver accepted |
| Shared carrier pool | One `carriers` table serving both apps |

**Exit criteria:** a quote with no available driver appears in Expeditoo automatically, and the selected carrier shows in Expedion without a manual step.

### Phase C — Trust, payments, polish

| Item | Notes |
|---|---|
| Stripe Connect payouts | Split transfers, commission held at source |
| Ad valorem insurance | Coverage choice at checkout |
| Reviews both ways | Shipper ↔ carrier |
| Notifications | Ably in-app + Resend email, push via Capacitor |
| Mobile navigation | 5-button bottom bar |
| i18n audit | Full FR/EN parity |

**Exit criteria:** money moves end to end, both parties can rate, and the Android build ships.

### Phase D — Optimisation *(post-launch)*

Route publishing and matching, carrier tracking APIs, featured listings, premium carrier subscriptions.

Route matching is deliberately **after** bidding. Bidding is the product; routes make it more efficient later.

---

## 9. Out of scope

Goods auctions of any kind · native iOS build · carrier tracking API integrations (quoted per carrier) · multi-country expansion beyond France.

---

## 10. Open decisions

1. Auto-escalation window duration
2. Commission split when a job originates from Expedion
3. Insurance partner selection
4. KYC vendor selection
