# Plan — Transport-Only Refinement

**Status:** Proposed
**Roadmap ref:** `ROADMAP.md` §1, §9 · **Supersedes nothing** — this completes `plan_phase_a_bidding_core.md`
**Date:** 2026-08-13

---

## 1. The direction, confirmed

> No goods marketplace. The only auction is the **reverse auction on a delivery
> order**, run between the people who will carry it.

This is already the direction the pivot has taken. The goods-auction engine,
its bids, orders and won-auction checkout were deleted in WP2, and `listings`
now models a transport job rather than an item. Nothing in the plan below
changes course — it finishes the job.

**What already matches the direction**

| Area | State |
|---|---|
| Schema | `listings` = transport job, `offers` = competing bid, no `bids`/`orders` |
| Offers engine | Submit / withdraw / accept, atomic award, concurrency-safe |
| Money | Held on acceptance, captured on delivery, commission at source, payout recorded |
| Carrier KYC | Application, documents, fleet, admin approval, expiry suspension |
| Shipper UI | Job form (what/where/when/budget), job detail with offer comparison |
| Carrier UI | Bid form, my offers |
| Expedion bridge | Inbound escalation and outbound write-back, both wired |
| Gates | `tsc` 0 errors · `lint` 0 errors · 117 tests · production build passes |

---

## 2. One open product question

`ROADMAP.md` §2 names three roles, and we settled on seven (`docs/specs/roles_spec.md`).
The phrase "auction between drivers" cuts across that split, so it is worth
being explicit:

| Model | Who bids | Implication |
|---|---|---|
| **A — Carrier company bids** *(built)* | `carrier` holds SIRET, IBAN, fleet, KYC. `driver` is an employee who executes and never sees money | A sole trader is simply a carrier whose only driver is themselves. Supports both cases |
| **B — Individual driver bids** | The person driving bids directly; no company layer | Simpler, but drops fleet management, and French road transport needs SIRET + transport licence anyway |

**Recommendation: keep A.** It already supports the sole-trader case, and
French regulation requires the company identifiers regardless, so B would not
actually remove the KYC burden — only the ability to grow past one van.

**Decision needed** before WP11 (carrier onboarding UI) hardens the wording.

---

## 3. Audited residue

Counts are files under `src/` still carrying goods-marketplace vocabulary.

| Residue | Where | Size |
|---|---|---|
| `seller` / `buyer` naming | across features, hooks, types | 35 / 40 files |
| Goods checkout | `features/app/checkout/` — `useWonCheckout`, `Checkout`, `ShippingEstimate` | 1 feature, 11 files |
| Browse on the auction shape | `features/app/home/types.ts` — `currentBid`, `bids`, `imageUrl` | 1 feature, 13 files |
| Seller/buyer analytics | `profile/ui/analytics/` — `SellerAnalytics`, `BuyerPurchaseHistory` | 3 components |
| Goods categories | `db/seed.ts` — Electronics, Furniture, Clothing | 1 seed |
| Marketing copy | landing, FAQ, terms, pricing still say "marketplace / auctions / buy" | 5 pages |
| i18n | `checkout` namespace; `profile.analytics` speaks of sales and top-selling items | 2 namespaces |
| Navigation | `BottomNav` is shipper-shaped for every role | 1 component |
| Admin | `/admin/drivers`, `/admin/applications` still driver-application era | 2 pages |

None of this breaks the build — it is vocabulary and dead surface, not broken
code. That is why it survived the pivot.

---

## 4. Work packages

Ordered by what unblocks the exit criteria first.

### WP8 — Transport categories *(small)*

Replace the goods seed with categories a shipper actually picks from:

```
furniture_moving · appliances · pallets_freight · construction_materials
vehicles · machinery · fragile_artwork · documents_parcels
refrigerated · bulk_goods · animals · other
```

`listings.categoryId` is already required, so this is a seed change plus the
category picker copy. **Files:** `db/seed.ts`, create form.

### WP9 — Browse jobs *(replaces goods browse)*

`features/app/home/` currently renders an auction card (`currentBid`, `bids`).
Rebuild as a job board:

- `JobCard` — route (city → city), weight, pickup window, budget, offer count,
  and `hasBid` so a carrier sees at a glance where they already stand
- Filters per `transport_listing_spec.md` §3: category, radius from a point,
  budget band, pickup window, max weight
- Map view keeps MapLibre, plotting pickup points rather than item locations

**Depends on:** nothing. **Blocks:** carrier discovery, so this is the highest
-value remaining UI.

### WP10 — Delete the goods checkout

There is no cart and no purchase. Payment is authorised inside offer
acceptance and captured on delivery — both already implemented server-side.

- Delete `features/app/checkout/` and its three pages
- Move payment-method management to `profile/payment-methods` (already exists)
- Add the one genuinely missing surface: an **authorisation prompt** when a
  shipper accepts an offer without a saved card (`PAYMENT_METHOD_REQUIRED`)

### WP11 — Carrier onboarding and fleet UI

The service and REST layer are done; the screens are not.

- `/carrier/application` — company details, document upload with per-document
  status, banking, and a submit gate that renders **every** gap at once, which
  is the behaviour the API already returns
- `/carrier/fleet` — vehicle list, add/edit, deactivate rather than delete when
  a live offer references it
- `/carrier/dashboard` — open jobs matching the fleet, live offers, won work

### WP12 — Admin carrier review

- `/admin/carriers` — review queue, document viewer through the presigned URL,
  approve / reject with reason / suspend
- Retire `/admin/drivers` and `/admin/applications`

### WP13 — Rename the domain vocabulary

Mechanical but wide: `seller` → `shipper`, `buyer` → `shipper`, `driver` →
`carrier` where the bidder is meant. Includes `profile/ui/analytics`, which
becomes **shipper spend** and **carrier earnings** rather than sales analytics.

Do this **after** WP9–WP12 so it renames the surfaces that survive, not the
ones about to be deleted.

### WP14 — Marketing and i18n truth pass

Landing, FAQ, terms, pricing and the `checkout` i18n namespace still describe a
marketplace. Rewrite around: post a job → carriers bid → you choose → pay on
delivery. FR/EN parity is currently exact and must stay that way.

### WP15 — Role-aware navigation

One bottom bar cannot serve a shipper, a carrier and a driver:

| Role | Bar |
|---|---|
| Shipper | Home · My jobs · **Post** · Messages · Account |
| Carrier | Jobs · My offers · Deliveries · Messages · Account |
| Driver | Today · Deliveries · Messages · Account |

### WP16 — Exit-criteria E2E

`testing/scripts/e2e-post-bid-accept.spec.ts`: shipper posts a job, three
carriers bid, shipper accepts one, payment authorises, shipment appears. This
is the roadmap's Phase A exit criterion and nothing currently proves it
end to end.

---

## 5. Sequencing

```
WP8  categories ─┐
WP9  browse jobs ─┼─► WP16 E2E exit criteria
WP10 kill checkout┤
WP11 carrier UI ──┤
WP12 admin review ┘
                  └─► WP13 rename ─► WP14 marketing/i18n ─► WP15 nav
```

WP8–WP12 are functional and unblock the exit criteria. WP13–WP15 are
presentation and should follow, so the rename lands on final surfaces.

---

## 6. Explicitly out of scope

Unchanged from `ROADMAP.md` §9: goods auctions of any kind, native iOS,
carrier tracking API integrations, and any market beyond France.

Also deferred, and deliberately: route publishing and matching stay in Phase D.
Bidding is the product; routes make it more efficient later.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| WP13's rename touches ~75 files | Runs after deletions, and `tsc` is the gate rather than review |
| Deleting checkout removes a working Stripe path | The path that matters now lives in `payments.service.ts` and is tested; the deleted one served won-auctions |
| Marketing rewrite needs client sign-off on positioning | Draft in EN, confirm, then mirror to FR to keep parity exact |
| Category list is a product decision, not a technical one | WP8 proposes 12; treat as a first cut for the client to edit |
