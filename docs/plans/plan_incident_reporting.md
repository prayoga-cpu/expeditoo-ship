# Plan — Incident Reporting

Spec: `docs/specs/incident_reporting_spec.md`.

One button on both parties' shipment screens for "something has gone wrong",
recorded as a first-class row and routed to operators. No coupling to money or
shipment status.

## Order of work

Bottom of the stack up, so every layer compiles against a real one below it.

| # | Step | Files |
|---|---|---|
| 1 | Enums + `shipment_incidents` table + relations | `src/db/schema/shipments.ts` |
| 2 | Migration + journal entry | `src/db/migrations/0016_shipment_incidents.sql`, `meta/_journal.json` |
| 3 | DTO — zod in, view out, enums **derived** | `src/server/dto/shipment-incident.dto.ts` |
| 4 | DAL — permission-blind queries | `src/server/dal/shipment-incidents.dal.ts` |
| 5 | Service — authorise, write, then three isolated side effects | `src/server/services/shipment-incidents.service.ts` |
| 6 | Routes | `src/app/api/shipments/[id]/incidents/route.ts`, `src/app/api/admin/incidents/route.ts`, `src/app/api/admin/incidents/[incidentId]/route.ts` |
| 7 | Feature slice — client API, hooks, barrel | `src/features/app/incidents/**` |
| 8 | Shared dialog + list, mounted on **both** surfaces | `incidents/ui/`, `deliveries/ui/DeliveryDetail.tsx`, `driver/ui/ShipmentActions.tsx` |
| 9 | Admin queue + sidebar entry | `src/app/(app)/admin/incidents/page.tsx`, admin nav |
| 10 | i18n, EN + FR at exact parity | `messages/en.json`, `messages/fr.json` |
| 11 | Tests | service + dialog `__tests__` |

## Dependencies and reuse

Nothing here is new machinery. It leans on:

- `partyFor()` / `shipmentErr` / `Viewer` — `src/server/services/shipment-access.ts`
- `shipmentsDal.getOwnership()` — id, parties, status in one read
- `messagesService.getOrCreateSupportConversation()` — the one-per-user thread
- `getUsersByRole()` — `src/server/dal/users.dal.ts`, for operator fan-out
- `notificationsService.createNotification()`
- `POST /api/upload` — existing public image path, reused for incident photos
- `resolveViewer()` + `ok`/`unauthorised`/`handleError` — the route shape

## Traps to avoid

1. **The journal, not the directory.** `0016`'s `when` must exceed
   `1788084000000` (`0015_shipment_photos`) or the migrator silently skips it.
   `migrations-journal.test.ts` fails the build on an unregistered `.sql`.
2. **Do not restate an enum.** Reporter role reuses `actorRoleEnum`; DTO enums
   derive from the `pgEnum` `.enumValues`.
3. **Another session is mid-flight in this tree.** `shipment_photos` has schema,
   DTO, DAL and service but **no routes**. Do not "finish" it and do not treat
   its typecheck errors as mine. Touch `create/` not at all — `PhotoDropzone.tsx`
   and `JobForm.tsx` are being edited there; the incidents slice talks to
   `/api/upload` through its own client API wrapper instead of importing across
   features (`docs/rules.md` §1.3).
4. **Every `useQuery` surface needs an `isError` branch** — a hook returning
   `null` on failure renders a blank page (CLAUDE.md §Gotchas 9).
5. **Prettier will reformat whole files** — `.prettierc` is misnamed. Match
   surrounding style by hand.
6. Side effects go in their own `try` each. A failed notification must not lose
   the report.
