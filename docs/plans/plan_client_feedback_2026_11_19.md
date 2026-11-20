# Plan — client feedback of 19 November 2026

Spec: `docs/specs/client_feedback_2026_11_19_spec.md`. Monitor: the top of
`STATUS.md`, one row per message. Release: **2.91.0**.

The client sent 38 points over WhatsApp on 19 November while testing 2.90.0.
Every point was first traced to its cause in the code; the ones whose cause is
known and whose answer needs nobody else are built here. The rest wait on the
client, on a check, or on a decision, and are listed in the monitor.

## Streams

Five streams, each owning a disjoint set of files so they can be built at the
same time. Copy is handed over as `{lang:{set,delete}}` patches and spliced
into `messages/*.json` once, at the end.

| Stream | Items | Files |
|---|---|---|
| A — sign-in and mail | #6, #8, #12, #14 | `src/app/signin`, `src/app/(auth)`, `src/features/auth`, `src/lib/auth.ts`, `auth.service.ts`, `VerificationEmail.tsx`, `WelcomeEmail.tsx` |
| B — request form and assistant | #1, #2, #18, #20, #21, #22 | `src/features/app/create`, `request-assistant.service.ts`, its DTO, `location-picker-field.tsx` (labels) |
| C — messages | #25, #31, #33, #34, the « ? » avatar | `src/features/app/messages`, `messages.dal.ts`, `messages.service.ts`, `thread-offers.service.ts` |
| D — admin user tools | #13, #15, #16 | `admin/users`, `UsersTable.tsx`, `PublicProfile.tsx`, a new service + DAL + routes under `api/admin/users/[id]` |
| E — driver, navigation, readability | #4, #23, #24, #28, #29, #35, #37 | `city-field.tsx`, `geocoding.ts`, `MyOffers.tsx`, `JobDetail.tsx`, `BottomNav.tsx`, `FloatingNav.tsx`, `DriverDashboard.tsx`, `globals.css` |

## Order

1. Trace every point to its cause (done before this plan; the table is in the
   spec).
2. Build the five streams.
3. Splice the copy, check FR/EN parity by key diff.
4. Gates, one at a time: `npx tsc --noEmit`, `pnpm lint`, `pnpm test`,
   `pnpm changelog:check`, `pnpm build`.
5. Record the release: `CHANGELOG.md`, `STATUS.md`, `package.json`,
   `src/lib/version.ts`.

## Dependencies

- No migration.
- #18 reverses a rule written in `request_assistant_spec.md` (« its answer has
  no date »); that spec and `CLAUDE.md` change in the same release.
- #35 moves « Devenir chauffeur » out of the phone's bottom bar;
  `become_driver_spec.md` changes with it.
- #29 cannot be proved without an iPhone on iOS 15–16.1.

## Not in this release

#3, #5, #7 (already shipped), #9, #10, #11, #17, #19, #26, #27, #30, #32, #36,
#38 — each with its reason in the monitor.
