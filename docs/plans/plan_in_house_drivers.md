# Plan — In-House Drivers

**Status:** Proposed
**Roadmap ref:** none — this is net-new scope. A repo-wide audit (this
session) found no prior grounding anywhere in ROADMAP.md, docs/specs/,
docs/plans/, or git history for Expeditoo employing its own drivers; every
existing document instead describes a marketplace of independent,
self-employed carriers. `ROADMAP.md` §2/§8 and `docs/specs/roles_spec.md`
would both need a line added once this ships.
**Date:** 2026-09-23

---

## 1. The ask, and what it actually changes

> Every user signs up as `user` (no role). `driver` is granted once someone
> submits an application and an admin approves it — unchanged. `shipper`
> becomes the marker for "transport from Expeditoo" — a driver employed by
> Expeditoo itself, not an independent third party.

Two changes are bundled here, and they have very different risk profiles:

1. **Default signup grants no role**, instead of the current auto-`shipper`
   (`assignDefaultRole`, `src/server/dal/users.dal.ts:400`, called from
   `handlePostSignup`, `src/server/services/auth.service.ts:24`). **Low
   risk** — confirmed by this session's audit: `shipper` gates nothing today
   (zero `assertRole(session, "shipper")` calls anywhere), and the UI already
   has a clean zero-role fallback (`NO_ROLE_LABEL = "user"`,
   `src/lib/primary-role.ts:31`, already rendered by
   `RoleManagementDialog.tsx`'s `t("noRoles")`).
2. **`shipper` starts meaning something** — "in-house driver" — where today
   it means nothing. **Real risk**, because `shipper` is not an unused word:
   it is a value in the `user_role` enum (the one this feature touches) *and*
   independently in `review_role` and `actor_role` (unrelated, unaffected,
   but sharing the vocabulary), and it is the literal role held by the
   synthetic Expedion system account (`expedion_system_shipper`,
   `src/scripts/seed-expedion-demo.ts:146`) that owns every escalated
   listing. That account is not a driver and must stop holding `shipper` once
   the word means one — see §5.

---

## 2. Design decisions (confirmed with the requester)

| Question | Decision |
|---|---|
| How does someone become in-house? | Admin creates/assigns directly — **not** the public KYC application flow. |
| Do they bid? | No — direct assignment only, same lane as the existing Expedion "assign from the pool" flow (`expedion-escalation.service.ts` `assignDirect`). |
| Do they still need a `carriers`/`vehicles` record? | Yes, but lighter — the full public-applicant rigor (self-service multi-step application, document upload) is not required; an admin can create the record and approve it directly. |
| Is `shipper` a replacement for `driver`, or held alongside it? | **Alongside.** An in-house driver holds both `shipper` and `driver`. `driver` still grants the same execution capability every approved driver has; `shipper` is the additional "employed by Expeditoo, direct-assign only" marker. |

## 3. Open questions this plan does NOT resolve

These need a business/legal call before ship, not a code guess:

- **`carriers.siret` is `NOT NULL`.** An employee does not necessarily hold
  their own SIRET the way a sole-trader carrier does. This plan does not
  change the column (see §6 — smallest viable schema footprint) — an admin
  enters a real SIRET value exactly as today. Where that value comes from
  for a genuine employee is a business decision, not one this plan makes.
- **Compensation.** `ROADMAP.md` §10's commission split is already undecided
  for every driver; whether an in-house driver is salaried (bypassing
  payouts/commission entirely) is a superset of that same open question, not
  a new one this feature needs to answer to ship.
- **Direct (non-Expedion) jobs.** The only existing "assign without bidding"
  mechanism is Expedion's post-payment fork. This plan does not add an
  equivalent for a directly-posted (`/create`) job — an in-house driver could
  still bid... except bidding is being turned off for them (§4). Net effect:
  v1 in-house drivers only do Expedion-escalated work. Flagged, not solved.

---

## 4. New permission: in-house drivers cannot bid

`offers.service.ts` `submitOffer` gates only on `carrier.status === "approved"`
(`src/server/services/offers.service.ts:133`) — role never enters into it
today. Add one check: if the acting user holds `shipper`, refuse with a new
`IN_HOUSE_DIRECT_ASSIGN_ONLY` (403), before the existing approval check. This
is the one functional gate `shipper` will actually have — everything else
about it stays informational (a label, a filter), matching how `carrier`/
`driver` already work (§ Data Model, CLAUDE.md).

---

## 5. The system account must stop holding `shipper`

`ensureSystemShipper()` (`src/scripts/seed-expedion-demo.ts:146`) grants the
literal role `shipper` to `expedion_system_shipper` purely as a non-empty
placeholder — nothing reads it for meaning. Once `shipper` means "in-house
driver", this placeholder would misrepresent a non-person system account as
an employee. Fix: stop granting it a role at all, matching the new
zero-role-by-default baseline (§1.1) — the account needs a `user` row to own
listings via `listings.shipper_id`, not a `user_roles` row to go with it,
since nothing has ever gated on that role for this account either.
`seed-expedion-demo.ts`'s own `assertTransportSchema()` schema check (which
queries `pg_enum` for the literal `'shipper'` label) is unaffected — the
*enum value* isn't going anywhere, only who is granted it and why.

---

## 6. Smallest viable schema footprint

No new column. `shipper` + `driver` held together *is* the "in-house" signal
(§2). This keeps the change to: one new admin-only creation path, one new
service-level bidding guard (§4), the role-management UI re-admitting
`shipper` as its own manageable chip (distinct from the merged "Driver"
chip — see `src/features/app/admin/lib/role-groups.ts`), and the demotion
path in `useAdminDrivers.ts` no longer re-granting `shipper` on removal
(today it does, as the old "harmless baseline" — `useAdminDrivers.ts:38`).

If a later need arises to tell an in-house driver's *vehicle fleet* apart
from an independent carrier's for reasons beyond role (billing, reporting),
that is new scope, not this plan — same reasoning `carriers_on_route_spec.md`
§4.5 already gave for declining a similar ask: no schema signal exists for
it today, and inventing one should be its own decision, not a side effect of
this feature.

---

## 7. New admin flow — "Add in-house driver"

Lives in `/admin/drivers` (existing driver-pool admin screen) or a new entry
point off it. One guided action, not a multi-step wizard, mirroring how thin
the public application already is (`carrier_kyc_spec.md` §3: documents,
banking and vehicles are already optional at submission and approval):

1. Admin picks an existing user account (search by email — the person signs
   up normally first, landing with no role per §1.1) — or this plan's UI
   allows entering a name/email to create the account inline, TBD at spec
   time depending on whether an invite-by-email flow already exists
   elsewhere (it does not, per this session's audit — out of scope to add
   one here; assume the account already exists).
2. Admin enters the minimum a `carriers` row requires today — `companyName`,
   `siret`, `contactPhone`, address — same fields `POST /api/carrier/application`
   already validates, just admin-entered instead of self-service.
3. Admin enters one vehicle — `type`, `maxWeightKg`, `plateNumber` — same
   fields `POST /api/carrier/vehicles` already validates.
4. On submit: create the `carriers` row with `status = "approved"` directly
   (skip `draft`/`submitted`/`under_review` — nothing meaningfully reviews an
   admin's own entry), create the vehicle, and grant `shipper` **and**
   `driver` in one transaction.

---

## 8. Files this touches (implementation phase, not this plan)

| File | Change |
|---|---|
| `src/server/services/offers.service.ts` | New `IN_HOUSE_DIRECT_ASSIGN_ONLY` guard in `submitOffer` |
| `src/scripts/seed-expedion-demo.ts` | `ensureSystemShipper()` stops granting a role |
| `src/server/dal/users.dal.ts`, `auth.service.ts` | Default signup grants no role |
| `src/features/app/admin/hooks/useAdminDrivers.ts` | Demotion no longer re-grants `shipper` |
| `src/features/app/admin/lib/role-groups.ts` | `shipper` re-admitted to `MANAGEABLE_ROLES`, gated on `driver` already held |
| New: admin "add in-house driver" route/service/UI | §7 |
| `docs/specs/roles_spec.md`, `ROADMAP.md` | Updated to describe the new baseline |
| `src/features/app/admin/expedion/ui/AssignDriverDialog.tsx` | Badge distinguishing in-house drivers in the assignment pool (cosmetic, not gating — the pool itself is unchanged, §6) |

Full behavior, validation and error codes for each of these belong in
`docs/specs/in_house_drivers_spec.md`, not here.
