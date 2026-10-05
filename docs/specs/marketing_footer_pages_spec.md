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
- that expiry is tracked and a lapsed document suspends the account;
- *(2.60.0)* what happens to bank details: of the IBAN and BIC typed in, only
  the last four characters are kept and nothing is passed to a payment
  provider; the RIB is kept like the other documents; earnings are paid by a
  bank transfer from Expeditoo when the driver asks for them
  (`carrier_kyc_spec.md` §4.3, `payout_safety_spec.md` §0). Until 2.60.0 it
  said they were « détenues par notre prestataire de paiement »; the form
  never passed them to one.

### `/auction-houses`
Audience: an auction house. Must state that the house never posts here — a
quote is accepted and paid inside Expedion, and only a job no driver has taken
inside 48 h escalates onto this network. Must not describe Expeditoo as a
place to shop for transport directly.

*(2.60.0)* Must not say the buyer's money waits for the delivery — the buyer
paid inside Expedion. The fourth guarantee said funds were authorised at award
and « débités seulement une fois la livraison confirmée »; it now says what is
true on this side: the carrier earns only once the delivery is recorded, photo
included, and nothing for a job they did not deliver (`payout_safety_spec.md`
§1). Its title, « Payé à la livraison, pas avant », was the other half of the
old claim: under « Ce que cela change pour vous » an auction house reads it as
its buyer paying on delivery. The title names the carrier now — « Rien n'est
dû au transporteur avant la livraison » / "Nothing is owed to the carrier
before delivery".

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

> **Amended (recorded in 2.60.0).** Money is taken when the transport is
> chosen, not captured on delivery (`payment_at_booking_spec.md`,
> `pay_at_accept_spec.md`); the terms have said so since
> `invoice_at_payment_spec.md`.

Privacy must additionally cover the GDPR rights, the KYC document retention
rule, and the subprocessors actually in use (Stripe, Resend, Ably, Cloudflare
R2, Supabase).

*(2.60.0)* Stripe is listed for the **clients' card payments** —
authorisation, capture, refund — and nothing else: it holds no carrier's bank
details and pays no carrier (`payout_safety_spec.md` §0, §5). The payment-data
item says what is actually kept: a client's card details at Stripe, never on
our servers; a carrier's IBAN and BIC as their last four characters; the RIB
with the compliance documents. It used to say « jamais un IBAN complet », which
the RIB makes untrue. `lastUpdated` moved with the change.

### Payout claims, here and on the landing

*(2.60.0)* Until the payout method is settled (`payout_safety_spec.md` §8),
every page says only what is true today: Stripe takes the clients' card
payments; a carrier's earnings join their balance when a delivery is recorded
and are paid by a bank transfer from Expeditoo when they ask for it (minimum
€20, `payout_safety_spec.md` §0). No page promises a delay, calls a payment
guaranteed or scheduled, says a transfer leaves on delivery, or says a payment
provider holds a carrier's bank details or pays them. What went for that
reason:

- « Payé sous 7 jours » — on the hero, the bid card, How it works and the
  advantages.
- The hero's fourth figure, « J+7 — Paiement garanti », hardcoded in
  `LandingStats`. The row is `LP_GRID_4`, so the tile was replaced rather than
  dropped: it is now the smallest balance a driver can ask to have
  transferred, `MIN_WITHDRAWAL_CENTS` formatted (« 20 € »), over « Solde
  minimum pour demander un virement » / "Minimum balance to request a
  transfer". The component restates the figure because the service is
  server-only; the test in §6 fails if the two part.
- The second testimonial's « on est payé dans la semaine » / "we get paid the
  same week". The clause is cut, not reworded: the words are attributed to a
  driver.
- `/auction-houses`' « Payé à la livraison, pas avant » (above).
- On the banking form, « après chaque livraison », and then the claim that
  the IBAN typed there is the account paid. Only its last four characters are
  kept (`carrier_kyc_spec.md` §4.3), so the form says it keeps them for the
  driver to recognise the account, that earnings are transferred on request
  to the account on their RIB, and to upload a new RIB on a change of bank.
- On a delivered trip (`/carrier/trips`, *Effectués*), a `scheduled` payout
  read « Versement programmé » / "Payout scheduled". Nothing is scheduled —
  the driver still has to ask — so it reads « Crédité sur votre solde » /
  "Credited to your balance".
- On `/driver/help`, hardcoded English like the rest of that page, "Payments
  are processed weekly for all completed deliveries". The answer now says
  earnings are credited when the delivery is recorded, and transferred by
  hand once the driver requests a withdrawal.

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
- *(2.60.0)* `src/i18n/__tests__/payout-claims.test.ts`, on the pattern of
  `expedion-not-announced.test.tsx` (§4, "Payout claims"):
  - in both languages, no string **anywhere in the catalogue** says a payment
    provider holds bank details (« détenues par notre prestataire de
    paiement », "held by our payment provider"), puts payouts on Stripe, says
    "never a full IBAN", promises a delay (« sous 7 jours » / "within 7 days",
    « dans la semaine » / "the same week", « chaque semaine » / "weekly"),
    calls a payment guaranteed (« paiement garanti » / "guaranteed payment")
    or a payout scheduled (« versement programmé » / "payout scheduled"), says
    the carrier is « payé à la livraison » / "paid on delivery" or paid
    « après chaque livraison », or says the money is captured only on
    delivery. It first read eight namespaces and fewer phrasings, which let
    the hero figure's label, a testimonial and the `/auction-houses` title
    through. On the catalogues that version passed, this one fails on four
    strings in each language: those three and the trip card's « Versement
    programmé »;
  - « J+7 » / "D+7" appears nowhere under `marketing`. It is looked for only
    there: inside the app the same notation counts an offer's delivery days
    (`listing.bid.slots.leadDays`);
  - `carrier.application.banking.description` names the RIB;
  - `LandingStats`, rendered in both languages: every label resolves, no
    figure or label says any of the above or a « J+N », and one figure is
    `MIN_WITHDRAWAL_CENTS`, formatted — a hardcoded value is caught too;
  - `/driver/help`, rendered with "How do I get paid?" open: the answer says
    none of the above, and that the driver requests a withdrawal.
