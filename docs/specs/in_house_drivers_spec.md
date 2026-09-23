# Spec — In-House Drivers

**Plan:** `docs/plans/plan_in_house_drivers.md`
**Status:** Proposed — not implemented. Written before any code changes, per
`CLAUDE.md`'s spec-driven-development rule; see the plan for why this order
matters here specifically (`shipper` is a live enum value in three tables and
the identity of a system account, not a blank slate).

---

## 1. What "in-house driver" means

An in-house driver is a real person, holding a real `user` account, who
drives for Expeditoo directly rather than bidding as an independent carrier.
They hold **both** `shipper` and `driver` in `user_roles`:

- `driver` grants exactly what it grants any approved driver today — nothing
  new. Shipment execution, status updates, proof-of-delivery upload are
  unchanged and unconditional on `shipper`.
- `shipper` is the new marker. Its only behavioral effect is §4 (cannot
  bid). Everywhere else it is informational: a badge, a filter, a way for an
  admin to tell "our own driver" from "independent approved carrier" at a
  glance.

They also have an **approved** `carriers` row and at least one `vehicles`
row, same as any driver who can be assigned a shipment — `offers.service.ts`
already requires a vehicle to accept/execute work (`assertVehicleFitsJob`),
and that requirement is not waived here.

---

## 2. Default signup

`assignDefaultRole` (`src/server/dal/users.dal.ts:400`) stops being called
with `"shipper"` from `handlePostSignup` (`src/server/services/auth.service.ts:24`).
A new signup holds **zero** rows in `user_roles`.

- Displays as `"user"` everywhere `primaryRole()` is read — already built
  (`src/lib/primary-role.ts:31`, `NO_ROLE_LABEL`).
- `POST /api/listings` is unaffected — it already checks only for a session,
  never a role (`src/app/api/listings/route.ts:32`).
- `RoleManagementDialog.tsx` already renders `t("noRoles")` for
  `held.length === 0` — no UI change needed for this half.
- `UsersTable.tsx`'s inline `RoleBadges` has **no** equivalent "no roles"
  label today (it just renders an empty chip row) — add one, matching the
  dialog, so a zero-role account reads as a deliberate state, not a rendering
  gap. Small, contained fix; flagged as a gap by this session's audit.

### 2.1 Edge case — accounts that already hold `shipper` today

Every existing account holds `shipper` under the old "harmless default"
meaning. This spec does **not** retroactively strip it — a migration that
revokes `shipper` from every account that isn't meant to be in-house would
also need to distinguish "genuinely in-house" from "just never repurposed",
which nothing today can do. Existing accounts keep whatever roles they have;
only the *default for new signups* changes. `shipper` becoming meaningful
going forward is therefore **only enforced going forward** — see §4's guard,
which is what actually matters (an old `shipper`-holding account attempting
to bid would hit it too, correctly or not, until an admin either removes the
stale role or the account is confirmed genuinely in-house).

**Operator follow-up required at ship time:** audit existing
`shipper`-holding accounts and remove the role from any that are not
genuinely in-house employees, so §4's guard doesn't block a real independent
driver who happens to still carry the old default. This is a data cleanup
task, not a code path — tracked in `STATUS.md`'s Operator to-do when this
ships, not solved by this spec.

---

## 3. The system account

`ensureSystemShipper()` (`src/scripts/seed-expedion-demo.ts:146`) stops
granting `shipper` to `expedion_system_shipper`. That account keeps its `user`
row (still needed — it owns every escalated listing via `listings.shipper_id`)
and simply holds zero roles, same as any other new account under §2. Nothing
reads a role off this account today (confirmed by this session's audit), so
this is a pure subtraction with no follow-on behavior change.

`assertTransportSchema()`'s check that the `user_role` enum still contains the
label `'shipper'` (a `pg_enum` query, not a grant) is unaffected — the enum
value still exists and is still valid; only this one account stops being
granted it.

---

## 4. Bidding guard

`offers.service.ts` `submitOffer`, immediately before its existing
`carrier.status !== "approved"` check (line 133):

```ts
if (callerRoles.includes("shipper")) {
  throw err("IN_HOUSE_DIRECT_ASSIGN_ONLY", 403);
}
```

| Situation | Status | Code |
|---|---|---|
| Acting user holds `shipper` | 403 | `IN_HOUSE_DIRECT_ASSIGN_ONLY` |

The service needs the caller's roles at this call site — confirm the current
`Viewer`/session shape passed into `submitOffer` carries them, or thread them
through the same way `assertRole`/`assertAnyRole` already do elsewhere in
this service (`auth.service.ts`'s role-check pattern, not a new one).

No equivalent guard is needed on the *assignment* side
(`expedionEscalationService.assignDirect`) — direct assignment already
requires no bid, so there is nothing for an in-house driver to be blocked
from there. §5 covers making that lane show, not restrict, who's in-house.

**Out of scope for v1 (see plan §3):** a directly-posted (`/create`) job has
no "assign without bidding" mechanism at all today. An in-house driver is
therefore unable to be booked on a direct job through any existing path once
this guard ships — they can only be given Expedion-escalated work via
`assignDirect`. This is a real gap, not a silent one: flagged here and in the
plan, not solved by this spec.

---

## 5. Assignment pool — cosmetic distinction only

`GET /api/admin/carriers` (`src/app/api/admin/carriers/route.ts:22`) keeps
returning every `status = "approved"` carrier, in-house and independent
alike — no filtering change. `AssignDriverDialog.tsx`'s dropdown adds a
badge (reads the assignee's roles, already available from the same query
path) so an operator can tell them apart, but every approved carrier remains
assignable exactly as today. Restricting the pool to in-house-only, or
splitting it into two lists, is explicitly not part of this spec — the
"assign from the pool" lane pre-dates this feature and serves a broader
purpose (fast direct assignment of *any* approved carrier) that this spec
does not narrow.

---

## 6. Admin-created carrier record

New endpoint, admin/operator only: creates a `carriers` row and one
`vehicles` row for an existing user account, sets `carriers.status =
"approved"` directly, and grants `shipper` + `driver` in one transaction —
partial failure must not leave the account with only some of the four writes
(carrier row, vehicle row, `shipper` grant, `driver` grant).

| Field | Rule | Source |
|---|---|---|
| `companyName` | 2–200 chars | same as `POST /api/carrier/application` |
| `siret` | exactly 14 digits | same — **no schema change**; see plan §"Open questions" for where a real value comes from for a genuine employee |
| `contactPhone` | valid French number | same |
| `addressLine`, `city`, `postalCode` | required, `postalCode` 5 digits | same |
| vehicle `type` | one of `VEHICLE_TYPES` (`src/lib/carrier-constants.ts`) | same |
| vehicle `maxWeightKg` | > 0 | same |
| vehicle `plateNumber` | `/^[A-Z]{2}-\d{3}-[A-Z]{2}$/`, unique per carrier | same |

Documents are **not required** — consistent with the public flow, where they
are already optional at both submission and approval
(`carrier_kyc_spec.md` §3). No new document kind is introduced for this
path.

| Failure | Status | Code |
|---|---|---|
| No session / not admin or operator | 401 / 403 | `UNAUTHENTICATED` / `FORBIDDEN_ROLE` |
| Target user already holds `driver` | 409 | `ALREADY_DRIVER` — use the existing role-management UI to add just `shipper` instead (§7) |
| Any field fails its rule above | 400 | same codes the public application endpoints already use (`INVALID_SIRET`, etc.) — no new validation vocabulary |

---

## 7. Role-management UI

`src/features/app/admin/lib/role-groups.ts`:

- `MANAGEABLE_ROLES` re-admits `"shipper"`, as its **own** chip — not folded
  into the merged `"driver"` chip the way `carrier`/`driver` are (those two
  are still one person, one concept; `shipper` is now a distinct marker on
  top of an existing driver, not a synonym for one).
- Assigning `shipper` is refused (client-disabled, server-enforced) unless
  the target already holds `driver` — an in-house marker on an account with
  no execution capability is a meaningless state. Error code:
  `SHIPPER_REQUIRES_DRIVER` (400) if attempted directly against
  `POST /api/user/roles`.
- Removing `shipper` alone is always allowed once granted (it never needs to
  be a user's *last* role by the time it's grantable, since `driver` is a
  prerequisite) — no new guard beyond the existing "last role" check.

`useAdminDrivers.ts`'s `handleRemoveDriver` (`:38`) currently demotes with
`{ role: "shipper", replace: true }`. That stops being correct once
`shipper` has its own meaning — a demoted driver should not become "in-house"
as a side effect of being removed from the driver pool. Change it to
`{ role: "driver", replace: false }` with removal (i.e. drop `driver` and
`carrier`, matching how `role-groups.ts`'s `dbRolesFor("driver")` already
pairs them for the admin dialog) rather than replacing with a role that no
longer means "harmless baseline". A demoted driver lands with whatever roles
remain — `shipper` only if they were already in-house and are being demoted
from *execution*, not from being an employee; `"user"` (zero roles) if they
held nothing else, matching §2's new baseline.

---

## 8. Test coverage required

- `offers.service.test.ts`: `submitOffer` refuses with
  `IN_HOUSE_DIRECT_ASSIGN_ONLY` for a `shipper`-holding caller, and succeeds
  unchanged for a `driver`-only caller — the existing approved-carrier tests
  must not regress.
- `users.dal.test.ts` / `auth.service.test.ts`: signup grants zero roles,
  not `shipper` — update the assertions this session's audit flagged as
  currently expecting the old default.
- New: an admin-create-in-house-driver service test covering the §6 table
  and its transactional all-or-nothing behavior.
- `role-groups.test.ts`: `shipper` appears in `MANAGEABLE_ROLES`, is
  refused without `driver` held, and is not folded into the `driver` chip.
- `seed-expedion-demo.ts`'s own schema assertions: confirm they still pass
  with the system account holding zero roles.
