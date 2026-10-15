# Plan — client feedback of 7–8 October 2026 (2.63.0)

Spec: `docs/specs/client_feedback_2026_10_spec.md`. Monitor: top of `STATUS.md`.

## Steps

| Step | Item | Files | Depends on |
|---|---|---|---|
| 1 | Monitor in `STATUS.md`, this plan, the spec | `STATUS.md`, `docs/` | — |
| 2 | #2 password placeholders | `signup`, `signin`, `reset-password` pages | — |
| 3 | #3 Flexible first and default | `create/timing.ts` + tests | — |
| 4 | #8 Détails optional | `create/schemas.ts`, `listings.dto.ts`, `JobForm.tsx`, job page | — |
| 5 | #9 access-conditions label | `messages/*.json` | — |
| 6 | #10 bottom bars | three `*BottomNav.tsx`, three layouts | — |
| 7 | #6 feedback under Contact & Aide | `Profile.tsx`, `/help`, `/driver/help` | — |
| 8 | #4 bidding deadline | `listing-window.ts`, `listings.service.ts`, `offers.service.ts`, `create/publication.ts`, `useJobForm.tsx` | — |
| 9 | Migration `0038_user_identity_contact` | schema `users.ts`, new `user-contact-details.ts`, journal | — |
| 10 | #1 sign-up split + §11 `input: false` | `auth.ts`, `signup/page.tsx`, `useAuthActions.ts` | 9 |
| 11 | #7b Coordonnées card + API | DTO, DAL, service, `/api/users/me/contact`, profile card, admin profile | 9 |
| 12 | #5 trips sub-tabs (agent A, worktree) | `carrier/ui/*`, `carrier/hooks/*` | — |
| 13 | #7a transaction history (agent B, worktree) | `profile/ui/invoices/*`, invoices DTO/service | — |
| 14 | Integrate A and B, gates, browser pass (iPad viewport), review | — | 2–13 |
| 15 | Release 2.63.0: CHANGELOG, STATUS entry, version; migrate from `release/2.63.0`; fast-forward `main` | — | 14 |

## Order of the production push

`0038` adds columns and a table only, so old code runs on a migrated database.
The migration runs from `release/2.63.0` first and `main` moves only after a
`mirror_readonly` read shows `0038` applied — new code on an unmigrated database
would 500 every sign-up and every session read that selects `user.first_name`.
