# Spec — Marketing footer pages

Contract for the six pages the landing footer links to, and for the contact
pipeline behind `/contact`.

---

## 1. Routing

Every footer link resolves to one of:

| Label | Target | Kind |
|---|---|---|
| Open jobs | `/#courses` | anchor, `LandingJobBoard` |
| How it works | `/#how` | anchor, `LandingHowItWorks` |
| Verification | `/verification` | page |
| Platform | `/#platform` | anchor, `LandingPlatform` |
| Expedion — auction buyers | `EXPEDION_URL` | external, `target="_blank" rel="noreferrer"` |
| Auction houses | `/auction-houses` | page |
| Contact | `/contact` | page |
| Terms | `/terms` | page |
| Legal notice | `/legal-notice` | page |
| Privacy policy | `/privacy` | page |

No footer link may point at `/#cta`. That anchor is the sign-up call to
action; using it as a stand-in for a missing page is what this work removes.

## 2. Shell

`MarketingPageShell` renders `LandingNavbar`, a `lp`-scoped `<main>`, an
eyebrow/title/intro header, the page body, and `LandingFooter`.

- The root carries `lp`, so the body uses the same palette as the navbar and
  footer above and below it. A marketing page that sets its own background is a
  defect.
- Light and dark are both mandatory; colour comes only from `--lp-*` tokens.
- `max-w-[1180px]`, matching `LP_CONTAINER`.

## 3. Legal documents

`LegalDocument` takes a namespace and renders `t.raw("sections")`:

```ts
type LegalSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};
```

- Sections are numbered from the array index; numbers are never written into
  the copy, so inserting one does not renumber by hand.
- `t.raw` returns `unknown`. The component validates the shape and renders
  nothing rather than throwing if a catalogue is malformed.
- `lastUpdated` is a separate key per namespace.

## 4. Page content

### `/verification`
Audience: a driver deciding whether to apply. Must state:
- the four requirements — identity, SIRET, transport insurance, one vehicle;
- that KBIS is **not** required, because an auto-entrepreneur has none;
- that documents are stored privately and never served by URL;
- that expiry is tracked and a lapsed document suspends the account.

### `/auction-houses`
Audience: an auction house. Must state that the house never posts here — a
quote is accepted and paid inside Expedion, and only a job no driver has taken
inside 48 h escalates onto this network. Must not describe Expeditoo as a
place to shop for transport directly.

### `/legal-notice`
Structure required of a French mentions légales: publisher identity, legal
form, share capital, RCS/SIRET, registered address, publication director,
contact, host name and address, intellectual property, and a mediation notice.

**Every identity field is a `TODO(EXPEDITOO-LEGAL)` placeholder.** Real
registration numbers are not inventable and none exist in this repo. The page
renders the placeholders visibly, so it cannot be mistaken for complete.

### `/terms`, `/privacy`
Rewritten onto the transport model. Neither may use `seller`, `buyer`, `item`,
`order`, or describe a goods auction. Both must state:
- Expeditoo is the carrier network of the Expedion group, not a shop;
- the client pays Expedion; the driver bids down and an **operator** awards;
- money is authorised on award and captured on delivery.

Privacy must additionally cover the GDPR rights, the KYC document retention
rule, and the subprocessors actually in use (Stripe, Resend, Ably, Cloudflare
R2, Supabase).

## 5. Contact pipeline

### DTO — `contactSubmitSchema`

| Field | Rule |
|---|---|
| `name` | trimmed, 2–80 |
| `email` | trimmed, lowercased, valid address, ≤ 160 |
| `subject` | one of `contactSubjects` |
| `message` | trimmed, 20–2000 |
| `company` | optional, ≤ 120 |

`contactSubjects` is the single source of truth for the subject enum:
`carrier` | `auctionHouse` | `expedionQuote` | `billing` | `press` | `other`.
The UI derives its options from it and must never restate the list.

### Service — `contactService.submit`

1. Validate. A Zod failure surfaces as `VALIDATION_ERROR` / 400.
2. Email the support address, rendered from `ContactMessageEmail`, with the
   sender on `replyTo` so an operator answers the visitor, not the platform.
3. If `userId` is given, also post the message into that user's support thread
   through `messagesService`, so it lands in `/admin/support`.
4. Return `{ delivered: true, threadOpened: boolean }`.

Rules:
- The email is the delivery guarantee. If the support-thread post fails, the
  submission still succeeds — `threadOpened` reports `false` and the failure is
  logged. Losing a visitor's message because a chat insert failed is worse
  than an operator seeing it only by email.
- If the email itself fails, throw `ContactError("CONTACT_DELIVERY_FAILED",
  502)`. The form must not claim a message was sent when it was not.
- An impersonated session never opens a thread — `isImpersonated()` is checked,
  matching the standing rule that a borrowed session performs no automatic
  writes.

### Route — `POST /api/contact`

- Public. No authentication required; that is the point of the page.
- Resolves the session if there is one and passes `userId` down; the service
  enforces everything else.
- Rate limited per IP: 5 submissions per 10 minutes, exceeding it returns
  `CONTACT_RATE_LIMITED` / 429. A public unauthenticated form that emails on
  demand is otherwise a spam relay.
- Errors translated through `handleError`.

### UI

- Client-side validation mirrors the DTO so the visitor is corrected before a
  round trip; the server remains authoritative.
- Pending, success and error states are all visible. Success replaces the form
  with an acknowledgement naming the address that was written to.
- Every string is translated.

## 6. Test coverage required

- `contact.service`: happy path; thread opened only when signed in; thread
  failure still returns success with `threadOpened: false`; email failure
  throws `CONTACT_DELIVERY_FAILED`; impersonated session opens no thread;
  validation rejects a short message and a bad address.
- `contact` route: 400 on invalid body, 429 past the rate limit, 200 on
  success, and that no session is required.
- i18n: FR and EN key sets are identical. This replaces the by-eye check.
