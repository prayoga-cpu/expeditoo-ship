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
| `/(app)/admin/*` | `operator` `support` `finance` or `admin`, each seeing only its permitted tabs |

The existing `/(app)/driver/*` tree is today's transporter area. It splits: bidding
and earnings move to `/(app)/carrier/*`; execution stays under `/(app)/driver/*`.

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
