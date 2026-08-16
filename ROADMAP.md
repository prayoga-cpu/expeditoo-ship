# EXPEDITOO — Roadmap

**Reverse-bidding transport marketplace**
Version 2.0 · 04/08/2026 · PRIONATION.io for Atout Global Services

---

## 1. What this product is

Expedion escalates paid transport jobs that no driver in its own pool has taken.
Approved drivers on Expeditoo bid with price, ETA and vehicle. An operator
compares the bids and picks a carrier. Stripe holds and releases payment.

Shippers do not post jobs here — Expedion is the only inlet. There are no goods
auctions either; the only auction is the **reverse auction on transport**,
drivers competing downward on price.

| | |
|---|---|
| Market | France, road transport, any category |
| Model | Driver-side marketplace on escalated demand, competitive bidding |
| Revenue | Commission on each completed delivery — split undecided, see §10 |
| Selection | **An operator selects** the driver from submitted bids |
| Demand | Escalated jobs from Expedion when no driver is available |

---

## 2. Roles

| Role | Can do |
|---|---|
| **Driver** | Register with KYC, browse escalated jobs, submit offers, chat, update status, deliver, get paid |
| **Operator** | Compare bids and award, monitor the Expedion bridge, review driver applications, force-escalate |
| **Admin** | Everything an operator can, plus users, roles, payments, refunds and statistics |

`shipper` remains in the role enum but is held only by the Expedion system
account that owns escalated listings. Nobody signs in as one.

---

## 3. Core flow

```
Expedion client accepts a quote and pays
   ↓  escalateAfter set to now + 48h
No driver assigned inside the window
   ↓  cron sweep auto-escalates
Job goes live on Expeditoo
   ↓  matching drivers notified
Drivers submit bids
   ↓  price + ETA + vehicle + message
An operator compares and accepts one
   ↓  Stripe payment authorised
Pickup → In transit → Delivered
   ↓  status writes back to Expedion at each stage
Payout to driver, two-way review
```

**The escalation inlet is the product.** A job arriving from Expedion enters at
"Job goes live" carrying `origin='expedion'` and `external_ref`. When a driver is
selected, the status writes back so the Expedion client sees "retrait en cours"
without leaving their app.

---

## 4. Screens

| Group | Screens |
|---|---|
| **Public** | Splash, landing, pricing, FAQ, terms, privacy |
| **Auth** | Login, register, forgot password, reset password, verify email |
| **Driver** | Dashboard (`/home`), job board (`/expedion`), job details, submit offer, my offers, my application, deliveries, active delivery, proof of delivery, chat, profile, settings, notifications |
| **Operator / Admin** | Award queue, Expedion bridge, driver applications, users, listings, shipments, payments, support, reports, statistics |

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

Goods auctions of any kind · a shipper-facing posting flow · native iOS build ·
carrier tracking API integrations (quoted per carrier) · multi-country expansion
beyond France.

---

## 10. Open decisions

1. **Commission split when a job originates from Expedion.** `budgetCents` is
   what the client already paid Expedion; the driver bids below it and the
   difference is the margin. Nothing names how that splits. Payouts cannot go
   live until it does — this is the blocking one.
2. **Who calls `/api/expedion/quotes/:id/paid`.** The endpoint exists and starts
   the escalation clock, but nothing on the Expedion side posts to it, so
   auto-escalation is inert on real data.
3. **Whether person-level driver applications survive French licensing.** KBIS is
   no longer required, but SIRET and a transport licence still are for anything
   at or above 7.5 t. If regulation pushes back, the company layer returns.
4. Auto-escalation window duration (currently 48 h)
5. Insurance partner selection
6. KYC vendor selection
