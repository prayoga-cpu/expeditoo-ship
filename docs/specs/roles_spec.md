# Spec — Roles & Permissions

**Roadmap ref:** `ROADMAP.md` §8 Phase A "Role expansion 5 → 7 user types"
**Plan:** `docs/plans/plan_phase_a_bidding_core.md` WP1

`ROADMAP.md` §2 names only Shipper, Carrier and Admin, while Phase A calls for
"5 → 7 user types" without enumerating them. Resolved by client decision on
2026-08-13: **seven roles**, splitting the carrier company from its drivers and
splitting back-office duties out of `admin`.

---

## 1. The seven roles

```ts
user_role = 'shipper' | 'carrier' | 'driver' | 'operator'
          | 'support' | 'finance' | 'admin'
```

| Role | Who | Core capability |
|---|---|---|
| `shipper` | Posts transport jobs | Create/edit/cancel listings, read all offers on own listings, accept one, pay, track, review |
| `carrier` | KYC-approved transport company | Browse jobs, submit/withdraw offers, manage vehicles and drivers, receive payouts, review |
| `driver` | Employee of a carrier | Execute assigned shipments, update status, upload proof of delivery. **Cannot bid or see money** |
| `operator` | Dispatch desk | Read all listings/offers/shipments, force-escalate jobs (Phase B), reassign drivers |
| `support` | Support desk | Read users and shipments, act in support conversations, no money actions |
| `finance` | Back office | Payments, payouts, refunds, invoices. No user moderation |
| `admin` | Full access | Everything, including role assignment and carrier approval |

Roles migrate from today's `buyer, seller, auctioneer, transporter, operator, admin`.
`buyer` and `seller` collapse into `shipper`; `auctioneer` disappears with the
goods auctions; `transporter` becomes `carrier`.

---

## 2. Assignment

Roles live in the existing many-to-many `user_roles` table — a user may hold
several (a carrier who also ships is normal, and must be supported).

| Role | Granted by |
|---|---|
| `shipper` | Automatically at registration. Every user is a shipper |
| `carrier` | By `admin` on KYC approval only (`carrier_kyc_spec.md`). Never self-granted |
| `driver` | By a `carrier` inviting the user, or by `admin` |
| `operator` `support` `finance` `admin` | By `admin` only |

Revoking `carrier` does not cancel live offers — see `offers_engine_spec.md`
edge case 3.

---

## 3. Permission matrix

`✓` allowed · `own` own records only · `—` denied

| Action | shipper | carrier | driver | operator | support | finance | admin |
|---|---|---|---|---|---|---|---|
| Create listing | ✓ | ✓ | — | — | — | — | ✓ |
| Edit / cancel listing | own | own | — | — | — | — | ✓ |
| Browse open listings | ✓ | ✓ | — | ✓ | ✓ | — | ✓ |
| Submit / withdraw offer | — | ✓ | — | — | — | — | — |
| Read all offers on a listing | own | — | — | ✓ | ✓ | — | ✓ |
| Accept an offer | own | — | — | — | — | — | — |
| Manage vehicles | — | own | — | — | — | — | ✓ |
| Invite / manage drivers | — | own | — | ✓ | — | — | ✓ |
| Update shipment status | — | own | assigned | ✓ | — | — | ✓ |
| Upload proof of delivery | — | own | assigned | — | — | — | ✓ |
| View own earnings | — | ✓ | — | — | — | — | ✓ |
| Issue refund | — | — | — | — | — | ✓ | ✓ |
| Approve carrier KYC | — | — | — | — | — | — | ✓ |
| Ban a user | — | — | — | — | — | — | ✓ |
| Assign roles | — | — | — | — | — | — | ✓ |
| Force-escalate a job *(Phase B)* | — | — | — | ✓ | — | — | ✓ |

`driver` never sees prices, offers or payouts. A driver's shipment view shows the
addresses, the goods and the schedule — no money.

---

## 4. Enforcement

Per `docs/rules.md` §8, **services enforce permissions**; routes only resolve the
session and pass it down; the DAL is permission-blind.

```ts
// src/server/services/auth.service.ts
assertRole(session, "carrier")            // throws ForbiddenError
assertAnyRole(session, ["admin", "finance"])
assertOwns(session, listing.shipperId)
```

Route handlers must never inline a role check with a raw `if`. A permission bug in
a service is fixed once; the same bug spread across 96 route files is not.

### Failure codes

| Situation | Status | Code |
|---|---|---|
| No session | 401 | `UNAUTHENTICATED` |
| Session lacks the role | 403 | `FORBIDDEN_ROLE` |
| Has the role, wrong owner | 403 | `FORBIDDEN_NOT_OWNER` |
| Carrier role held but not approved | 403 | `CARRIER_NOT_APPROVED` |

---

## 5. Route groups

| Group | Required role |
|---|---|
| `/(app)/(main)/*` | any authenticated |
| `/(app)/carrier/*` | `carrier` (approved) |
| `/(app)/driver/*` | `driver` |
| `/(app)/admin/*` | `operator` `support` `finance` or `admin`, each seeing only its permitted tabs (§5.1) |

The existing `/(app)/driver/*` tree is today's transporter area. It splits: bidding
and earnings move to `/(app)/carrier/*`; execution stays under `/(app)/driver/*`.

### 5.1 The back office, page by role (2.95.0)

Until 2.95.0 `src/proxy.ts` admitted `admin` alone while `active-access.ts`
offered Admin mode to all four staff roles: an operator, support or finance
account was shown the switch and then bounced to `/home`.

**One table, `src/lib/admin-access.ts` (`ADMIN_PAGES`).** The proxy, the
sidebar (`AdminLayout`), the phone bar (`AdminBottomNav`), the mode switcher
(`active-access.ts`) and `MainLayout`'s bounce all read it. It is a
*navigation* table, never a permission: every read and write behind a page is
still authorised by its own service (§4).

`✓` may open · `—` sent to the role's own landing

| Page | admin | operator | support | finance | Why (what the page's reads accept today) |
|---|---|---|---|---|---|
| `/admin/expedion` (Supervision) | ✓ | — | — | — | `GET /api/admin/expedion/report` and every quote action (`requireExpedionAdmin`) are admin-only |
| `/admin/bordereaux` | ✓ | ✓ | — | — | `listBordereaux` / `exportBordereauxCsv`: admin, operator |
| `/admin/awards` | ✓ | ✓ | — | — | reads the board; `acceptOffer` awards for admin, operator |
| `/admin/listings` | ✓ | ✓ | — | — | `listingsService.adminList`: admin, operator |
| `/admin/shipments` | ✓ | ✓ | — | — | `shipmentService.adminOverview`: admin, operator |
| `/admin/users` | ✓ | — | — | — | `getUsers` (`verifyAdminPermission`): admin |
| `/admin/users/[id]/activity` | ✓ | — | ✓ | — | `ACTIVITY_READER_ROLES`: admin, support. Read-only |
| `/admin/expedion-clients` | ✓ | — | — | — | `expedionClientsService` (`requireAdmin`): admin |
| `/admin/drivers` | ✓ | ✓ | — | — | applications and in-house drivers: admin, operator. The « list » tab reads `getUsers` and is shown to admin only |
| `/admin/applications` (redirect → Drivers) | ✓ | ✓ | — | — | as Drivers |
| `/admin/payments` | ✓ | — | — | — | `/api/admin/payments` and `/refunds`: admin |
| `/admin/withdrawals` | ✓ | ✓ | — | ✓ | `withdrawalsService` (`requireOperator`): admin, operator, finance |
| `/admin/incidents` | ✓ | ✓ | — | — | `shipmentIncidentsService`: admin, operator |
| `/admin/feedback` | ✓ | ✓ | — | — | `feedbackService`: admin, operator |
| `/admin/support` | ✓ | — | ✓ | — | `/api/admin/support-chats`: admin, support |
| `/admin/support/[id]` | ✓ | — | ✓ | — | `messagesService` admits `admin` and `support` to a support thread it is not a participant of (2.95.0) |
| `/admin/settings` | ✓ | — | — | ✓ | platform settings, Stripe check, cron status, company identity: admin, finance |
| `/admin/profile` (redirect → Settings) | ✓ | — | — | ✓ | as Settings |
| `/admin`, `/admin/dashboard` (redirect → Supervision) | ✓ | — | — | — | as Supervision; the others go straight to their landing |
| any other `/admin/*` path | ✓ | — | — | — | **fail closed**: an unlisted page is admin-only |

Rules:

- `admin` opens everything. A multi-role account gets the union.
- **Matching** is longest-prefix on whole path segments, `[id]` standing for
  any one segment: `/admin/users/u1/activity` is the activity page,
  `/admin/users/u1` falls back to the user list, and
  `/admin/expedion-clients` is not under `/admin/expedion`.
- **Landing** (`adminLandingFor`) is the first sidebar entry the roles may
  open, in sidebar order: admin → `/admin/expedion`, operator →
  `/admin/bordereaux`, support → `/admin/support`, finance →
  `/admin/withdrawals`.
- **Proxy.** A staff member opening a page they may not see is redirected to
  their landing (query dropped); a non-staff account to `/home`, as before.
  Roles are read from the database on every request (§6 case 5). If they
  cannot be read, everyone goes to `/home`.
- **Admin mode** is offered exactly when `adminLandingFor` is not null, and
  the switcher and `MainLayout` land on it.
- **Navigation** shows only permitted entries, and no heading over an empty
  group. The badge counts (`/api/admin/nav-counts`, admin and operator only)
  are not requested for support or finance.
- **A new admin page is closed until classified.**
  `src/lib/__tests__/admin-access.test.ts` walks `src/app/(app)/admin` and
  fails on a `page.tsx` with no row.
- **Destructive acts stay admin-only in their services** — impersonation,
  role assignment and removal, account deletion, suspension, sign-out
  everywhere, password reset — whatever page a role can reach
  (`staff-destructive.test.ts`).
- A borrowed (impersonated) session carries the target's roles, so it sees the
  target's back office and nothing more.

### 5.2 Where §3 and the services disagree

The table above follows the services, so that no role is shown a page whose
reads all answer 403. Each line below is a gap between §3 and the code, left
for a decision — widening a service is not a navigation change.

| §1 / §3 says | The code today | Effect on §5.1 |
|---|---|---|
| operator force-escalates a job and works the dispatch desk | the Expedion report route and `requireExpedionAdmin` (admin, assign, escalate, requote…) accept `admin` only | Supervision is admin-only; an operator lands on Slips |
| support acts in support conversations | resolved in 2.95.0: `messagesService` now admits `support` as it does `admin` | none — support opens and answers a thread |
| support reads users and shipments | `getUsers` is admin-only; `adminOverview` is admin/operator | support has no Users or Shipments entry; only the per-account activity page, by link |
| support browses listings and reads offers | `listing-view.ts` `STAFF_ROLES` and `adminList` are admin/operator | no Listings or Awards entry for support |
| finance: payments, refunds, invoices | `/api/admin/payments` and `/api/admin/refunds` check `admin` only | Payments is admin-only; finance has Withdrawals and Settings |
| carrier KYC approval is admin-only | true, but `approve` / `reject` / `suspend` are refused in the **route** (`viewer.isAdmin`), not in `carrierService` — against §4 | none; an operator on Drivers sees applications and gets a 403 on those three buttons |
| withdrawals are a finance matter | `requireOperator` also accepts `operator` | operator has a Withdrawals entry |

---

## 6. Edge cases

| # | Case | Behaviour |
|---|---|---|
| 1 | User holds `shipper` + `carrier` and bids on own listing | Blocked — `CANNOT_BID_OWN_LISTING` (`offers_engine_spec.md` §3) |
| 2 | Carrier's last driver is removed mid-shipment | Blocked while the driver has an active shipment |
| 3 | `admin` demotes themselves | Blocked — the system must retain ≥ 1 admin |
| 4 | Driver's carrier is suspended | Driver keeps access to already-assigned shipments so deliveries complete; receives no new ones |
| 5 | Role revoked mid-session | Checked per request from the DB, not from a cached JWT claim |

---

## 7. Test coverage required

`src/server/services/__tests__/auth.service.test.ts`:

- Every cell of the §3 matrix, allowed and denied.
- Multi-role users resolve to the union of their permissions.
- Edge cases 1–5.
- Revocation takes effect on the next request (edge case 5).
