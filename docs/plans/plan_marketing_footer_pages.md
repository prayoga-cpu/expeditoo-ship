# Plan — Marketing footer pages

Status: complete, except the legal identifiers noted below
Owner: driver-side marketing surface

---

## Why

The landing footer ships ten links. An audit found four of them do not lead
anywhere real, and the two legal pages that do exist describe a product this
repo no longer is:

| # | Label | Current target | Verdict |
|---|---|---|---|
| 1 | Open jobs | `/#courses` | OK — section exists |
| 2 | How it works | `/#how` | OK |
| 3 | Verification | `/#cta` | **Broken** — no verification page, lands on a generic CTA |
| 4 | Platform | `/#platform` | OK |
| 5 | Expedion — auction buyers | `https://expedion-encheres.vercel.app/` | Works, but a preview URL and no `rel="noreferrer"` |
| 6 | Auction houses | `/#cta` | **Broken** — no page |
| 7 | Contact | `mailto:contact@expeditoo.com` | **No page** — a logged-out visitor with no mail client is stuck |
| 8 | Terms | `/terms` | Exists, but v1 goods-marketplace copy ("sellers", "items", "auction and direct sales") and hardcoded English |
| 9 | Legal notice | `/terms` | **Wrong target** — French law requires separate mentions légales |
| 10 | Privacy policy | `/privacy` | Exists, but same stale copy and hardcoded English |

Two further defects apply to every legal page: they are outside the `lp`
palette, so the landing navbar and footer render in a different colour system
from the body between them; and they are not translated, while the rest of the
product holds exact FR/EN parity.

## Scope

Four new pages, two rewrites, one shared shell, one contact pipeline, and
FR/EN keys for all of it.

## Steps

1. **Shared shell.** `MarketingPageShell` — navbar, `lp`-scoped main, page
   header, footer. Every marketing page below routes through it, so the palette
   break cannot recur.
2. **`LegalDocument`.** Renders `{ title, paragraphs, items }[]` read from a
   translation namespace with `t.raw`, so legal copy lives in the message
   catalogues and parity is diffable.
3. **`/verification`** — what a driver must supply, what is checked, how long
   it takes, why documents stay private.
4. **`/auction-houses`** — the B2B page for auction houses; explains the
   Expedion → Expeditoo escalation from the house's side.
5. **`/contact`** — page plus a working form.
   - `src/server/dto/contact.dto.ts` — Zod, derives the subject enum.
   - `src/server/services/contact.service.ts` — `ContactError`; emails the
     support address, and when the sender is signed in also posts into their
     support thread via `messagesService.getOrCreateSupportConversation`, so
     the reply loop stays in `/admin/support` rather than an inbox.
   - `POST /api/contact` — thin, resolves the session, translates errors
     through `src/lib/api-response.ts`.
   - `contactApi` client → `useContactForm` hook → `ContactForm` UI.
6. **`/legal-notice`** — mentions légales with the structure French law
   requires. The publisher identity does not exist anywhere in this repo and is
   not inventable, so every such field carries a `TODO(EXPEDITOO-LEGAL)`
   marker and the page refuses to look finished while they stand.
7. **Rewrite `/terms` and `/privacy`** onto the transport model, translated,
   through `LegalDocument`.
8. **Rewire the footer** to the new pages; add `rel="noreferrer"` and
   `target="_blank"` to the external Expedion link.
9. **Tests** — contact service, contact route, and an i18n parity test that
   diffs the FR and EN key sets so the hand-verified parity is enforced.

## Files

New
- `docs/specs/marketing_footer_pages_spec.md`
- `src/features/marketing/ui/MarketingPageShell.tsx`
- `src/features/marketing/ui/LegalDocument.tsx`
- `src/features/marketing/ui/ContactForm.tsx`
- `src/features/marketing/api/contact.api.ts`
- `src/features/marketing/hooks/useContactForm.ts`
- `src/app/(marketing)/{verification,auction-houses,contact,legal-notice}/page.tsx`
- `src/app/api/contact/route.ts`
- `src/server/dto/contact.dto.ts`
- `src/server/services/contact.service.ts`
- `src/server/emails/ContactMessageEmail.tsx`
- `src/server/services/__tests__/contact.service.test.ts`
- `src/i18n/__tests__/locale-parity.test.ts`

Changed
- `src/features/marketing/ui/LandingFooter.tsx`
- `src/features/marketing/ui/{styles.ts,index.ts}`
- `src/app/(marketing)/{terms,privacy}/page.tsx`
- `messages/{en,fr}.json`

## Dependencies

Resend is already wired and redirects every non-production recipient
(`src/lib/email.ts`), so the contact form is safe to exercise locally. A
support thread is a foreign key into `user`, which is why an anonymous sender
gets the email path only.

## Outstanding

`TODO(EXPEDITOO-LEGAL)` — `/legal-notice` renders visible placeholders for the
publisher identity. Grep the marker before shipping to production. The values
still needed: registered company name, legal form, share capital, registered
office address, RCS city and number, SIRET, VAT number, publication director,
host name and address, and the appointed consumer mediator.

## Out of scope

- A `contact_messages` table and an admin surface for anonymous enquiries.
  Email plus the signed-in bridge covers the journey without a migration.
- Replacing the Expedion preview URL with a production domain — not yet known.
