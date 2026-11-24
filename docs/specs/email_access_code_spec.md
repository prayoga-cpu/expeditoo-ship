# Specification: the emailed access code, and the sign-in flow audited

Release 2.96.0. Client report: « Error of access code with login process ».
The owner's ask: every access code sent by email must work, be tested in
production, and the sign-in / sign-up flow must be logical and correct.

## 1. What was wrong

The verification mail carried a link and nothing else. A link is a capability
for the browser that opens it, and that is where it broke for people: opened
on the phone while the sign-up tab waited on the laptop, opened in the mail
app's own browser, or followed by a mail scanner. The person then came back to
a `/verify-email` screen that could only offer « Renvoyer l'email ». The client
calls what they were waiting for an « access code »; there was none to type.

## 2. The code

| Rule | Value | Where |
|---|---|---|
| Length | 6 digits, `crypto.randomInt`, zero-padded | `EMAIL_CODE_LENGTH`, `src/lib/email-code.ts` |
| Lifetime | 3600 s, the link's lifetime — `auth.ts` hands Better Auth the same constant (`emailVerification.expiresIn`) | `EMAIL_VERIFICATION_TTL_SECONDS` |
| Tries | 5 wrong codes, then the code is burnt | `MAX_CODE_ATTEMPTS`, `email-code.service.ts` |
| One live code per address | issuing deletes every earlier row for the address; the newest mail is the one that works | `replaceCode` |
| What a right code grants | `user.emailVerified = true`, and the welcome mail if the address was not verified before. **Never a session**: the person still signs in with their password | `verifyEmailCode` → `confirmAddress` |

Not Better Auth's `email-otp` plugin: it opens public endpoints including a
passwordless sign-up that bypasses the name fields, and its verify path skips
`afterEmailVerification`, so nobody would be welcomed.

## 3. Storage

Better Auth's own `verification` table; no migration.

- `identifier` = `email-verification-code:<trimmed, lower-cased address>`.
  Better Auth reads its rows only by their exact identifier, so these never
  collide with its reset tokens or OAuth state.
- `value` = JSON text `{"hash": "<hex>", "attempts": <n>}`. `hash` is
  SHA-256 of `<identifier>:<code>`; the code itself is never stored.
- `expires_at` = issue time + 3600 s.
- The attempt counter is bumped **in Postgres, before the comparison**
  (`countAttempt`: `jsonb_set(...) RETURNING value`), so concurrent guesses
  each get their own number and no more than five are ever compared. A right
  code is consumed with `DELETE … RETURNING`, so exactly one of two concurrent
  right answers verifies.
- Each issue also deletes expired rows under the prefix (contained: a failure
  is logged, the code is still issued). Better Auth does the same for every
  expired `verification` row whenever it looks one of its own up, so an
  expired code goes either way; neither touches a live one.

The raw SQL was run against a real Postgres 17 (gotcha 23): replace, newest
first, counter 1 → 2, counter on a missing row → `null`, consume once → true
then false, purge, and the service end to end (hash stored, 3600 s TTL).

## 4. The mail

`authService.sendVerificationEmail` decides from `brandingFor(user.origin)`:

- **EXPEDITOP** (`hasCodeScreen: true`): issue a code; the template shows it
  above the button — monospace, 32 px, letter-spaced, one unbroken run of
  digits so a copy is `123456` — with « Saisissez-le sur la page où vous vous
  êtes inscrit, ou utilisez le bouton ci-dessous. » The inbox preview reads
  « Votre code : 123 456 — confirmez votre adresse e-mail EXPEDITOP »; the
  footer « Ce code et ce lien expirent dans 1 heure. »
- **Expedion** (origin `expedion` and `EXPEDION_APP_ORIGINS` set): no code is
  issued and the mail is the link alone, as before — their app has no code
  screen.
- If issuing the code throws, the error is logged and the **link mail still
  leaves** without a code.
- The link's `callbackURL` on EXPEDITOP is now
  `/signin?verified=true&email=<address>` (was `/signin?verified=true`), so the
  sign-in form is filled in and a failed link forwards the address (§6).

## 5. Checking a code

`POST /api/account/verify-email-code` `{ email, code }`, public (the person
cannot sign in yet — that is the point).

- Zod (`email-code.dto.ts`): email trimmed, lower-cased, an address, ≤ 254;
  code ≤ 32 chars, whitespace stripped, then exactly `^\d{6}$`. A body that is
  not JSON is a 400, not a 500. Validation fails **before** the service, so a
  malformed code never costs a try.
- Rate limit: 10 per minute per IP (`rateLimit`, the in-memory brake the
  assistant and confirmation routes use) → 429 `RATE_LIMITED`. The real cap
  is the five tries per code.
- Answers:

| Case | HTTP | `error.code` | Page says |
|---|---|---|---|
| Right code | 200 `{verified: true, email}` | — | « Adresse confirmée… », then `/signin?verified=true&email=…` (+ `callbackUrl` if one was carried) |
| Wrong, tries left | 400 | `INVALID_CODE` + `error.attemptsLeft` | « Ce code n'est pas le bon. Il vous reste N essai(s) : vérifiez qu'il vient du dernier e-mail reçu. » |
| Fifth wrong try | 429 | `TOO_MANY_ATTEMPTS` (row deleted) | « Trop d'essais… » and focus moves to « Renvoyer l'email » |
| No live code: expired, used, replaced, burnt, never issued, **unknown address** | 410 | `CODE_EXPIRED` | « Ce code a expiré ou a été remplacé… » and focus moves to « Renvoyer l'email » |
| Right code, account deleted since | 410 | `CODE_EXPIRED` | as above |
| Per-IP brake | 429 | `RATE_LIMITED` | « Trop de tentatives… patientez une minute » |
| Anything else | 500 | `INTERNAL_ERROR` | « La vérification n'a pas abouti… écrivez-nous à support@… », « Valider » stays live |

The route answers `EmailCodeError` itself (same envelope plus `attemptsLeft`,
which `fail()` has no slot for) and hands everything else to `handleError`.
The client calls it with its own `fetch` (`features/auth/api/email-code.api.ts`)
because `ApiError` carries only a code and a message.

**No account enumeration.** An address nobody signed up with answers exactly
what an account with no live code answers (`CODE_EXPIRED`, same status, same
message), and no account is looked up until a code has matched. This deviates
on purpose from the brief's « unknown email answers `INVALID_CODE` »: with
« missing → `CODE_EXPIRED` » also required, that pair would make
`CODE_EXPIRED` itself the proof that an account exists. What a stranger can
still learn is that an address has a **pending** code (`INVALID_CODE` with a
count) — i.e. signed up in the last hour and unverified; sign-up already
reveals far more (`USER_ALREADY_EXISTS`).

**Guessing.** Five tries per code out of 10⁶ is 5 × 10⁻⁶ per issued code. A
new code needs a sign-in with the right password or a resend (Better Auth:
3 per minute per IP in production, and a mail to the victim each time), so a
blind attack costs on the order of 200 000 mails to the victim's inbox. What
a guessed code would buy is a verified flag on an account the attacker
created with someone else's address — which is what lets
`claimExpedionQuotesForUser` attach that address's Expedion history. Worth
knowing; not worth a per-address issue cap today.

### The page

`/verify-email` (`VerifyEmailActions`): one address for both forms — taken
from `?email=` when it is an address, otherwise one field above both (also
when `?email=` holds something that is not an address, so it can be
corrected). Then the code field (`inputMode="numeric"`,
`autoComplete="one-time-code"`, `maxLength=6`, a paste is read whole so
« 123 456 » is one code, non-digits are dropped while typing), « Valider »,
the « nothing arrived? » note, « Renvoyer l'email » (now secondary), « Retour
à la connexion ». Typing a new code clears the last answer. The code field is
also offered on a failed link (`linkError`) and on a failed token.

## 6. Fixes made while auditing

1. **Invited drivers got a « Confirmez votre adresse » mail** for an account
   they never created, ahead of their invitation (the in-house onboarding
   signs them up server-side, then verifies the address itself). A
   verification mail with no request behind it is now not sent
   (`auth.ts`, `if (!request) return`).
2. **A password reset left the address unverified**, so somebody who lost the
   first mail, reset their password and signed in was refused again for an
   unconfirmed address. A completed reset proves the inbox the same way; it
   now verifies the address and welcomes it once
   (`onPasswordReset` → `confirmAddressAfterReset`, contained).
3. **A password reset left every other session alive.** People reset because
   they think the password is known; `revokeSessionsOnPasswordReset: true`.
4. **The reset redirected twice.** `useAuthActions.resetPassword` pushed
   `/signin` at once (skipping the success screen) and the page pushed again
   3 s later — pulling a person who had already signed in back to `/signin`.
   The hook no longer pushes; the page owns it.
5. **A legacy `/verify-email?token=` landed on `/welcome` with no session**
   under « Nous vous connectons… » (`autoSignInAfterVerification` is off).
   It now goes to sign-in, and the copy says so.
6. **Verifying cost the person their destination.** A sign-in refused for an
   unconfirmed address now carries `callbackUrl` to `/verify-email`, and the
   code path carries it back to `/signin` (`safeCallbackPath` both times).
7. **An expired link sent the person to a resend that asked for their address
   again.** The link's callback carries the address (§4), and `/signin`
   forwards it to `/verify-email?linkError=1&email=…` when Better Auth
   appends `error=`.
8. **`/signin?email=` is honoured**: the field is filled (only with a valid
   address) and focus moves to the password. Never auto-submitted.

## 7. The audit

Read end to end in `src/lib/auth.ts`, `auth.service.ts`, `useAuthActions.ts`,
the auth pages, `proxy.ts`, `carrier.service.ts` and Better Auth 1.4.6's
`api-D0cF0fk5.mjs`.

| Step | What the person sees | What the server does | Verdict |
|---|---|---|---|
| Sign-up (email) | Form (Prénom, Nom, Pseudo, e-mail, mot de passe) → `/verify-email?email=…` | `signUpEmail` (drizzle adapter not transactional), user row, role, verification mail with **code + link**; a mail failure never fails the sign-up | OK |
| Sign-up, address already taken | « Un compte existe déjà… » with « Se connecter » / « Réinitialiser » | 422 `USER_ALREADY_EXISTS…` | OK |
| Sign-up (Google) | Google → `/welcome` on first sign-in, else `callbackUrl` | User born verified; `handlePostSignup` claims quotes and welcomes | OK — but see L1 |
| Verify by link, same device | `/signin?verified=true&email=…`: toast « Email vérifié », address filled | JWT checked, `emailVerified = true`, `afterEmailVerification` → welcome once | OK (address prefill new) |
| Verify by code | Type 6 digits → « Valider » → `/signin?verified=true&email=…` | §5 | **New** |
| Verify by link on another device | That device lands on sign-in; the first device still waits on `/verify-email` | Link is a stateless JWT: works anywhere | OK — the first device can now type the code instead (a code typed after the link answers success, no second welcome) |
| Link already used | Toast « vérifié » | Already verified → redirect to the callback, nothing written | OK |
| Expired / invalid link | `/verify-email?linkError=1&email=…`: « lien expiré », code field, resend | Better Auth appends `error=token_expired` to the callback | Fixed (address forwarded, code offered) |
| Unverified sign-in | `/verify-email?email=…&from=signin(&callbackUrl=…)` « nouveau code envoyé » | Right password → `sendOnSignIn` mails a fresh code + link (replacing the previous code) → 403 `EMAIL_NOT_VERIFIED`; wrong password → 401, no mail | Fixed (destination kept) |
| Resend | « Email envoyé… », button rests 60 s; 429 → « patientez »; failure → retry + support | Better Auth `/send-verification-email` (3/min/IP, production only, in-memory per instance); unknown address → `status: true`, nothing sent (no enumeration); failed send on this path → 500 `VERIFICATION_EMAIL_NOT_SENT` | OK — see L5 |
| Forgot password → link → reset → sign-in | Form → « e-mail envoyé » → reset form → success screen 3 s → `/signin` | Unknown address answered the same; reset → `onPasswordReset` verifies + welcomes once; other sessions revoked | Fixed (§6.2–6.4) |
| Expired reset link | « Lien invalide » with « Demander un nouveau lien » / « Retour » | `/reset-password?error=INVALID_TOKEN` | OK |
| Driver invitation | One mail: « Vous êtes invité… », set-password link (1 h, says how to get another) → reset page → sign-in | Server-side sign-up (now **no** verification mail), admin verifies, `requestPasswordReset(invite=driver)` | Fixed (§6.1) |
| Sign-out | `/signin` | `signOut`, query cache cleared | OK |
| Suspended account, email | « Ce compte est suspendu… » with support address | `session.create.before` throws `BANNED_USER` (403) | OK |
| Suspended account, Google | Raw JSON on `/api/auth/callback/google` | Same throw, uncaught by the OAuth callback | **Left — L2** |
| `callbackUrl` after sign-in | Back where they were (`safeCallbackPath`), else `/home` | proxy sets `callbackUrl` to the **path only** | OK — see L4 |

### Left as found (outside this stream's files)

- **L1 — pre-account hijacking through Google linking.** Somebody signs up
  with a victim's address and a password (unverified, so unusable). When the
  victim later presses « Continuer avec Google », Better Auth links Google to
  that row and sets `emailVerified = true` (`trustedProviders: ["google"]`) —
  and the stranger's password still opens the account. Fix: in
  `databaseHooks.account.create.after` (or a `before` on the Google link),
  delete the `credential` account of a user that was not verified before the
  link, and tell the person to set a password through « Mot de passe
  oublié ». Needs `src/lib/auth.ts` + a DAL call; security review advised.
- **L2 — OAuth errors are dead ends.** `onAPIError.errorURL` is unset, so a
  Google refusal (cancelled consent, state mismatch) lands on Better Auth's
  English `/api/auth/error`, and a suspended Google account gets raw JSON.
  Fix: `onAPIError: { errorURL: "/signin" }` plus a `?error=` branch on
  `/signin` that is **not** the verification-link branch it has today.
- **L3 — the reset page's 3 s timer is never cleared.** Pressing « Se
  connecter maintenant » and signing in inside 3 s still gets pushed back to
  `/signin`. `src/app/(auth)/reset-password/page.tsx`.
- **L4 — `callbackUrl` drops the query.** `proxy.ts` stores
  `pathname` only, so `/listing/x?tab=offers` comes back as `/listing/x`; and
  « S'inscrire » from `/signin?callbackUrl=…` does not carry it to sign-up.
- **L5 — the Expedion edge.** An Expedion-origin account that signs in on
  this app's `/signin` lands on `/verify-email`, which talks about a code
  their (link-only) mail does not carry. The link still works.
- **L6 — email sign-ups never see `/welcome`**: only a first Google sign-in
  does. The welcome page's own comment still says verify-email sends people
  there. Product call.
- **L7 — `api-response.ts`** does not list `EmailCodeError`; the route
  answers it itself because `fail()` has no slot for `attemptsLeft`. If
  preferred, add the class to `handleError` with an optional details field.
- Rate limits (Better Auth's and `rateLimit`) are per serverless instance —
  brakes, not gates, as `rate-limit.ts` already says.

## 8. Test coverage required

- `email-code.service.test.ts` — six digits, zero-padded; hash stored, never
  the code; address normalised; expires with the link (3600 s); a second
  issue replaces the first; housekeeping failure contained; right code
  verifies, welcomes once, burns the code; already-verified → no write, no
  welcome; welcome failure contained; deleted account → `CODE_EXPIRED`;
  4, 3, 2, 1 tries left then `TOO_MANY_ATTEMPTS` and the right code is dead;
  right code on the last try; 8 concurrent guesses → exactly 5 comparisons;
  `timingSafeEqual` on two 32-byte buffers; expired → `CODE_EXPIRED` and
  cleared; unknown address ≡ no live code, no user lookup; unreadable row.
- `auth.service.test.ts` — EXPEDITOP mail carries the issued code; Expedion
  mail does not and issues none; issue failure still sends the link; callback
  carries the address; `confirmAddress` first time / already verified /
  welcome failure; `confirmAddressAfterReset` verifies and never throws.
- `account-emails.test.tsx` — code above the button, monospace, preview,
  « Ce code et ce lien expirent… »; no code → link-only copy.
- `verify-email-code/route.test.ts` — no session needed; pasted spaces;
  five/seven digits, letters, missing code, bad address, non-JSON → 400 and
  the service untouched; `attemptsLeft` carried; 410 / 429 passed through;
  500 does not leak; 10/min per IP, other IPs unaffected.
- `email-code.api.test.ts` — every answer maps to an outcome, never a throw.
- `verify-email/page.test.tsx` — field attributes and order; paste; digits
  only; incomplete refused locally; success → sign-in with the address (and
  `callbackUrl`); tries left; expired / too many → resend focused, field
  cleared; failure names support; answer cleared on typing; typed address
  used when none was handed; invalid handed address correctable; offered on
  `linkError`.
- `signin/page.test.tsx` — prefill and focus; never auto-submits; invalid or
  absent `?email=` ignored; submits the filled address with `callbackUrl`;
  failed link forwards a valid address only.
- `useAuthActions.test.ts` — `callbackUrl` carried to `/verify-email`;
  reset no longer pushes.

## 9. Testing it in production

Use a mailbox you can read on a phone **and** a laptop. Production sends
for real (`isProductionEnv`); nothing here takes money.

1. **Sign-up, code.** On the laptop, sign up at `https://www.expeditop.fr/signup`
   with a fresh address. The mail must show a 6-digit code above the button
   (and in the inbox preview). Type it on the laptop's `/verify-email` →
   « Valider » → `/signin` with the address filled and a « vérifié » toast →
   sign in with the password. A welcome mail arrives once.
2. **Paste.** Repeat with a second address, paste the code as « 123 456 ».
3. **Wrong code.** Third address: type a wrong code four times — the count
   goes 4, 3, 2, 1 — then a fifth: « Trop d'essais », focus on « Renvoyer
   l'email ». Resend: the new mail's code works; the old one answers expired.
4. **Other device.** Fourth address: open the link on the phone (lands on the
   phone's sign-in with the address filled); then type the same mail's code
   on the laptop — success, and **no** second welcome mail.
5. **Unverified sign-in.** Fifth address, do not verify; sign in on the
   laptop → `/verify-email` « nouveau code envoyé ». The code of the **first**
   mail now answers wrong; the newest works.
6. **Reset.** Sixth address, do not verify; « Mot de passe oublié » → reset →
   sign in: it must go straight in (no « adresse non confirmée »), and a
   session open elsewhere on that account must be gone.
7. **Expedion account.** With an Expedion-origin account, ask for a resend:
   the mail is link-only, no code.
8. **Driver invitation.** Add an in-house driver from Admin: exactly one mail
   (the invitation), no « Confirmez votre adresse ».
9. Check Vercel logs for `[Auth Service] Failed to issue a verification
   code` — there should be none.
10. Delete the test accounts from `/admin/users`.
