# Client feedback of 19 November 2026 — spec

Status: **current** (2.91.0 onwards). Plan:
`docs/plans/plan_client_feedback_2026_11_19.md`. Monitor: the top of
`STATUS.md`, one row per message.

The client tested 2.90.0 on `expeditoo-ship-five.vercel.app` on 19 November and
sent 38 points over WhatsApp, most with a photo of the screen. Each was traced
to its cause in the code before anything was built. This spec covers the points
built in 2.91.0. The points not built — and whether each waits on the client,
on a check or on a decision — are in the monitor.

Numbers below are the monitor's.

---

## 0. Readings chosen without the client

| | Item | Reading built | Why |
|---|---|---|---|
| A | #8 « no information about the role » | A note on sign-up: one account does everything; driving is applied for from inside the app. **No role field** | Roles are never client-chosen (`auth-user-fields.ts`, gotcha 20) |
| B | #14 the congratulation | An email, in French, once, when the address is confirmed (or at once for a Google sign-up). Not sent to Expedion-origin accounts | « Inscription is done » is the moment the account can be used |
| C | #18 dates in the assistant | Read, validated server-side, filled into the When step as a one-day flexible range per end | The client typed them and expected them filled. Reverses `request_assistant_spec.md`'s « no date » rule, on purpose |
| D | #22 « whenever » on a precise date | A fourth choice, « N'importe quand »: that exact day, 06:00–22:00, `isFlexible` false | The same window one flexible « any » day already produces |
| E | #33 another price after a refusal | The requester is sent to the job page, where the counter-price already lives; the transporter gets « Retirer et proposer un autre prix » | One negotiation engine, not two (`client_feedback_2026_10_29_spec.md` §B6) |
| F | #35 the bottom bar | « Mes demandes » takes the slot. « Devenir chauffeur » moves to the access badge's menu and stays on the profile | The client asked for the swap; the entry must stay reachable on a phone |
| G | #16 who may read a user's activity | `admin` and `support`; operator and finance refused | `roles_spec.md`: support reads users and acts in support conversations |
| H | #4 / #28 readability | The bottom bar and the driver dashboard only | An app-wide type change is a design decision (#3) |
| I | #28 the bar's « Expéditions » label | « Suivi » on the bar only | « Expéditions » does not fit one line at 12 px on a 375 px phone |

---

## 1. Sign-in and sign-up (#6, #8)

- « Pas encore de compte ? S'inscrire » sits directly under the sign-in
  subtitle, above the form; « Déjà un compte ? » likewise on `/signup`.
- `/signup` carries `auth.register.accountNote` under its subtitle.
- No new input reaches the server.

## 2. The verification email (#12)

Before: an unverified sign-in answered 403 with Better Auth's English sentence
and sent nothing; `/verify-email` had no resend; a refused send was logged and
the screen still said « envoyé ».

- `emailVerification.sendOnSignIn: true`.
- Sign-in turns `EMAIL_NOT_VERIFIED` into a push to
  `/verify-email?email=…&from=signin`. `BANNED_USER` is not caught by this.
- Sign-up pushes `/verify-email?email=…`.
- `/verify-email` has « Renvoyer l'email » (`authClient.sendVerificationEmail`,
  so the link carries a real token). States: sending, sent with a 60 s
  cooldown, rate-limited, failed. The failed state names the retry and the
  support address, and the button stays live. With no address in the URL the
  page asks for one.
- **A failed send is visible on the resend only.** `sendVerificationEmail`
  returns `true`/`false`; `auth.ts` throws `VERIFICATION_EMAIL_NOT_SENT` (500)
  only for `POST /send-verification-email`. Sign-up and sign-in swallow it: a
  throw at sign-up would answer 500 for an account that already exists and
  break `createDriverAccount`; a throw at sign-in would replace the 403 the
  Flutter client keys on. After either, the person is on the screen with the
  resend button.
- An expired or invalid link lands on `/verify-email?linkError=1` with the
  resend form, not on a « vérifié » toast.
- `/send-verification-email` is rate-limited to 3 per 60 s.
- The email is in French.

Error code: `VERIFICATION_EMAIL_NOT_SENT` (500), resend only.

## 3. The welcome email (#14)

- Sent from `emailVerification.afterEmailVerification`, and from
  `handlePostSignup` when the new account arrives verified (Google).
- In its own try/catch; it can never fail a verification or a sign-up.
- « Once » rests on Better Auth returning before the hook for an
  already-verified row. There is no stored flag; two simultaneous first clicks
  could send two.
- Not sent to Expedion-origin accounts.

## 4. The request assistant (#1, #2, #18)

`request_assistant_spec.md` holds the detail (§4.6, §4.7).

- The sentence stays in the box while it is read and is cleared on success
  only. After a failure the button reads « Réessayer ».
- Timeouts: 30 s in the browser (`ASSISTANT_TIMEOUT`), 15 s on the model call,
  20 s on transcription, 3 s per town lookup. A town lookup that times out
  leaves the town unplaced; the read does not fail.
- The answer gains `pickupDate` / `deliveryDate` (`YYYY-MM-DD` or null). The
  model is told today's date in Europe/Paris. The service keeps a date only if
  it is a real day, not before today (Paris) and at most 12 months ahead.
  Delivery before pickup nulls **both**. Nothing is clamped or guessed.
- Filling sets the When step to flexible with a one-day range per stated end.
  Only a pickup stated: a delivery that would fall before it becomes
  pickup + 1 day.
- « when » is the last follow-up question and never disables « Remplir le
  formulaire ».
- Unchanged: the assistant never posts, carries no price, pin or `origin`, and
  never touches a resumed draft. No rule was added to `jobFormSchema`
  (gotcha 15).

## 5. The request form (#20, #21, #22)

- **#20** The address label is `text-base font-semibold` where the caller names
  it (`/create`); postal code and town labels are `text-sm`; inputs are default
  size. The per-end heading is `text-lg font-semibold`.
- **#21** A title suggestion fills weight and size only while the person has
  not chosen them. « Chosen by hand » is tracked explicitly
  (`useCargoChoices`), never inferred from a value: picking a bracket, typing a
  weight, choosing a size mode or preset, typing a dimension, or an assistant
  fill each mark it. A resumed draft starts with weight by hand. When a
  suggestion does set the bracket, `exactWeightKg` is cleared.
  Cause of the report: « Table… » set 30–100 kg over a chosen 5–30 kg.
- **#22** « N'importe quand » in « Date précise », both ends
  (`request_availability_spec.md` §9). The hour select is hidden while it is
  chosen. `from-listing.ts` restores it from a non-flexible window that starts
  and ends on one day, ends at 22:00 and is longer than an hour.

## 6. Messages (#25, #31, #33, #34)

- **Rows** show « Ville → Ville · 20 nov. – 22 nov. » under the title. The
  inbox listing is projected field by field (`toInboxListing`): id, reference,
  title, status, the two towns, the four window dates, one photo URL.
- **Thread header**: the name row and the job row are one sticky stack; the
  job row carries title, reference, towns and dates and links to the job.
- **Refusal** (`thread_offer_spec.md` §13): the requester's card names the next
  step and, on a direct open request (`canCounter`, computed in `contextFor`),
  links to `/listing/:id#offer-:offerId`. The transporter's card reads
  « Refusée » with « Retirer et proposer un autre prix », which withdraws
  through the existing path and then opens the existing dialog. `withdraw`
  accepts a `declined` card whose bid is still `pending`. `decline` sends the
  transporter an `offer_declined` notification and an `offer:updated` realtime
  event, both skipped for an impersonated session. Nothing here awards or
  charges.
- Bubble avatars show the sender's image or initial.

## 7. Admin (#13, #15, #16)

- « Message » on the staff profile view leaves Admin mode before the push
  (`useLeaveAdminNav`), as `useApplicationNav` does.
- « Demandes et messages » — `admin_user_management_spec.md` §7:
  `/admin/users/[id]/activity`, three tabs, read-only, five GET routes,
  `admin` and `support`.

## 8. Driver and navigation (#23, #24, #35, #37)

- **#23** `CityField` searches every country in `JOB_COUNTRIES`
  (`CITY_SEARCH_COUNTRIES`, derived, never restated). A suggestion outside
  France carries its country.
- **#24** « Mes offres » cards show the job's title, reference, towns and
  requested dates beside the driver's own slot.
- **#35** `become_driver_spec.md` §3.1. Role holders keep « Missions »;
  everyone else gets « Mes demandes ». `AccessSwitcher` opens a menu for any
  account that does not drive yet, carrying « Devenir chauffeur » or « Mon
  dossier ».
- **#37** The pinned bar's title wraps to two lines, with « Ville → Ville ·
  Enlèvement … » under it.

## 9. Readability and old iPhones (#4, #28, #29)

- Bar labels are 12 px and wrap rather than truncate; the bar has its own short
  labels (`common.navigation.bar.*`).
- The active pill uses `--nav-active`, a plain colour with alpha: no
  `color-mix()`.
- One block in `globals.css`, guarded by
  `@supports not (color: color-mix(in lab, red, red))`, gives each low tint
  (5–30 %) a real translucent colour. It matches whole class tokens only
  (`[class~="bg-success/15"]`), so it cannot touch `hover:bg-primary/90`.

---

## 10. Follow-ups built in 2.92.0 (#17, #22, #26, #27, #30, #32, #36)

- **#17** The sidebar shows from `lg`; below it, the bottom bar. Rail (`w-16`) or expanded (`w-64`), toggled by a
  three-line button, remembered in `expeditoo-sidebar`; default rail under 1280 px.
- **#36** The tapped bar item is active at once; loading screens at the segment roots; toasts at the top under `lg`.
- **#26** Filters `waiting` (open, scheduled, draft) · `active` (awarded, in progress) · `done` (completed,
  cancelled, expired) · `none` (no request), server-side, counted by one grouped query. « Créneaux à valider » and
  « En attente d'action » have no state here and are not built.
- **#32** Two-letter initials; names unchanged (pseudos remain a decision).
- **#27** Below `sm` one « Connexion / Inscription » link; from `sm`, « Inscription » beside « Connexion ».
- **#30** Every sign-in, sign-up and reset failure maps to a French message with a next step.
- **#22** `biddingRunsUntil` runs a direct precise-day request to its window's end when the window exceeds 6 h.

## Known limits

- **#29 is unproved.** It was compiled and inspected, never run on iOS
  15–16.1.
- **#22 and old drafts.** A non-flexible window that happens to end at 22:00
  now reads as a whole day.
- **#16** has only been run against mocks. Run its DAL once on a real database
  (gotcha 23).
- **#12** Other sign-in errors (wrong password, suspended) still read in
  English. `proxy.ts` sends an unverified session to `/verify-email` without
  the address, so the page asks for it.
- **#33** The refused state in the composer is derived from the thread's
  messages, not from a server flag.
- `listing-pins.service.ts` still restates its own country list.
- `AdminBottomNav` keeps 10 px labels.

## Test coverage required

- Verification: resend states; `EMAIL_NOT_VERIFIED` redirect; a failed resend
  surfaces; a failed send at sign-up does not throw.
- Welcome: sent on verification and for a verified new account; failure
  contained; not for Expedion origin.
- Assistant: date validation at the Paris day boundary; fill mapping; text
  kept on failure; timeout.
- Form: by-hand rule for weight and size; exact-any resolve and round trip.
- Messages: inbox projection admits nothing else; decline notifies and is
  silent when impersonated; `canCounter`; both declined cards.
- Admin: permission matrix; unknown user 404; no write DAL reachable; no
  private field in a view.
- Navigation: bar slot by role; access menu for a non-driver; country list
  derived from `JOB_COUNTRIES`; « Mes offres » with and without a listing.
