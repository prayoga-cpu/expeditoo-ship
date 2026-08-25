# Plan — Client brief items 2 and 3

**Source:** `audit+expectation.pdf`, 26 August 2026
**Specs:** `docs/specs/transport_request_spec.md`
**Status:** both implemented 2026-08-26. Gates green.

The brief listed six tasks. Three (4, 5, 6) were already built; one (1) was a
misdiagnosis resolved by configuration, not code. This plan covers the two that
needed work.

---

## Item 2 — First and last name on the Expedion quote flow

The brief asked for two fields on the quote form. The audit found the database
and API had carried `firstName` / `lastName` all along, that nothing a client
could reach ever filled them, and that one path filled them **wrongly**.

### WP1 — Name parsing (Expeditoo) — done

`expedion-extraction.service.ts:393` split the buyer's name on the first space,
so `"DUPONT Jean"` stored the surname as the given name. French bordereaux print
`NOM Prénom` at least as often as `Prénom NOM`.

- `src/lib/french-names.ts` — `parseFrenchName`. Strips honorifics (including
  `et`/`&`, so `"M. et Mme DUPONT"` collapses), short-circuits on legal forms so
  a company never gets an invented first name, then reads the **longest run of
  ALL-CAPS tokens** as the surname whichever side it sits on, extending back
  over particles (`de`, `du`, `le`, `van`). Falls back to `Given SURNAME` when
  there is no capitalisation signal.
- A two-letter legal form (`SA`) counts only when actually printed in caps —
  otherwise `"Sa Thi NGUYEN"` loses her first name.
- 26 unit tests in `src/lib/__tests__/french-names.test.ts`.

### WP2 — Atomic name writes (Expeditoo) — done

Both callers of `toQuotePatch` duplicated a null-filter. With a parser that
legitimately returns *one* half (a company, a one-word slip), that filter would
write a surname over a hand-typed first name — leaving `Jean` beside
`SARL Brocante du Centre`.

`expedionExtractionService.writableFields(patch, currentRow)` replaces both
copies. Nulls are still dropped; the name pair now moves together, written only
when the model supplied both halves or the row has neither. 6 unit tests.

### WP3 — Flutter fields — done

| File | Change |
|---|---|
| `quote_form_rules.dart` | `isClientName` — optional, but 2+ chars when filled |
| `formulaire_demande_de_devis_retrait_aux_encheres_widget.dart` | A "Vos coordonnées" section with Prénom / Nom, wired through controllers, dispose, the `_Gap` checklist, the draft snapshot/restore, and the submit payload |
| `confirmer_les_details_widget.dart` | Two `_FieldSpec` entries, so the client can **see and correct** what the model read |
| `formulaire_de_devis_par_bordereau_widget.dart` | Removed two dead prefills reading `currentUserDocument` — a Firestore doc that is always null under Better Auth |

The names are **not** prefilled from the session: Better Auth stores one `name`,
and for an e-mail signup it is `email.split('@').first`. Prefilling would put an
address handle in a name field.

---

## Item 3 — Direct transport request page

Restores a surface deleted in `7a455c0`. Full behaviour in
`docs/specs/transport_request_spec.md`. Summary of the work:

| WP | Change |
|---|---|
| WP1 | `origin` stamped server-side in `toInsert`; **never** a DTO field — it decides who may award |
| WP2 | `categoryId` optional; `listingsDal.ensureDefaultCategory()` upserts `transport-general` |
| WP3 | `src/features/app/create/` — schemas, api, hook, `JobForm`, `PhotoDropzone` |
| WP4 | `/create` route, `/listings/me` un-redirected and its `MyJobs` view restored |
| WP5 | 119 translation keys across `create.*`, `myJobs.*` and two nav labels, EN + FR at exact parity |
| WP6 | `/expedion` board and the dashboard count unpinned from `origin: "expedion"` so direct requests are visible |
| WP7 | `CLAUDE.md` doctrine updated — "Expedion escalation is the only inlet" is no longer true |

### What was deliberately not restored

- `AddressMapPicker` (323 lines) — the shared `LocationPickerField` already does
  the same job, bilingual and theme-aware.
- The success page — its copy was written for the v1 goods auction.
- The ungated `test-upload-bypass` button — anyone who found it could inject a
  data-URI photo.

---

## Open, and blocking a live launch

1. **A direct request has no money behind it.** Accepting an offer runs the
   hold-then-capture path, which is still `MOCK_PAYMENTS`. Direct requests must
   not go live before real Stripe hold/capture.
2. **The commission split is still unnamed** (`ROADMAP.md` §10.1).
3. **Tests listed unchecked** in the spec's §9 are not yet written.
