# Spec — production lives at https://www.expeditop.fr (2.90.1)

## 1. Behaviour

- **Canonical origin: `https://www.expeditop.fr`.** The apex redirects to it
  (308). Sessions exist on the `www` host only; a session minted on
  `expeditoo-ship-five.vercel.app` is not carried over, so everyone signs in
  once more.
- `appUrl()` (`src/lib/app-url.ts`) returns `NEXT_PUBLIC_APP_URL` without a
  trailing slash, else `PRODUCTION_ORIGIN`. Every link built in an email, a
  notification, an invoice mail, a confirmation token or a carrier link goes
  through it. No file may carry its own fallback host.
- The fallback used to be `https://expeditoo.com` — a domain this project does
  not own. A deployment with the variable unset therefore put a stranger's site
  in a customer's email. It now falls back to our own.
- Mailboxes are written `local@expeditop.fr`: support, transporteurs, privacy,
  contact, drivers, facturation. **The brand name stays « Expeditoo »**; only the
  address of the site and of the mail changed.

## 2. Auth (what depends on the origin)

| Piece | Where | Reads |
|---|---|---|
| Better Auth `baseURL` — OAuth redirect URI, verification and reset links | `src/lib/auth.ts` | `NEXT_PUBLIC_APP_URL`, else Vercel's production host, else localhost |
| `trustedOrigins` | `src/lib/auth.ts` | the same value + `VERCEL_PROJECT_PRODUCTION_URL` + `VERCEL_URL` + `EXPEDION_APP_ORIGINS` |
| CORS allowlist | `src/proxy.ts` | the same set |
| Browser auth client | `src/lib/auth-client.ts` | `window.location.origin` — follows the page, needs no change |
| Cookie | Better Auth, `crossSubDomainCookies: { enabled: false }` | host-only on `www.expeditop.fr` |

`VERCEL_PROJECT_PRODUCTION_URL` is Vercel's pick among the project's domains —
not necessarily the `www` one, and two of them are redirects — so
`NEXT_PUBLIC_APP_URL` **must** be set explicitly; it is the only value that
guarantees the redirect URI and the e-mailed links name the host that holds the
cookie. It is inlined into the client bundle, so changing it needs a redeploy.

`EXPEDION_APP_ORIGINS` lists the **Expedion client's** origins, not this app's,
and is left alone.

## 3. Production configuration

| Setting | Value | State |
|---|---|---|
| Vercel `NEXT_PUBLIC_APP_URL` (production + preview) | `https://www.expeditop.fr` | set 2026-11-20; effective at next build |
| GitHub variable `APP_URL` (crons, auth-preflight, imports) | `https://www.expeditop.fr` | set 2026-11-20 |
| Vercel `EMAIL_FROM` | unchanged (`no-reply@prionation.io`) | **waits on Resend verifying expeditop.fr** — a sender Resend has not verified drops mail silently |
| Vercel `EXPEDION_APP_ORIGINS` | unchanged | not this app's origin |

## 4. Edge cases

- A `NEXT_PUBLIC_APP_URL` with a trailing slash yields no `//` in a link.
- Local development keeps `http://localhost:3000` from `.env.local`; the
  fallback applies only when the variable is empty.
- The 307 on `expeditoo-ship-five.vercel.app` is followed by the cron `curl`
  (`--location`) but **not** by Stripe, which treats a redirect as a failed
  delivery.

## 5. Not done here — external, in this order before the redeploy

1. **Google Cloud Console** → the OAuth client: add authorised redirect URI
   `https://www.expeditop.fr/api/auth/callback/google` and the JavaScript origin
   `https://www.expeditop.fr`. Without it Google sign-in answers
   `redirect_uri_mismatch` the moment the new build is live.
2. **Stripe** → webhook endpoint URL `https://www.expeditop.fr/api/stripe/webhook`
   (a redirect is a failed delivery), and Apple Pay domain registration for the
   new host. Admin → Paramètres → « Paiements Stripe » shows the endpoint kind.
3. **Resend** → add `expeditop.fr`, put its SPF/DKIM records in Cloudflare, then
   set `EMAIL_FROM` to `Expeditoo <no-reply@expeditop.fr>` in Vercel Production.
4. **Mailboxes** → the addresses above need a destination (Cloudflare Email
   Routing is on the same DNS), or mail to them bounces.
5. **`expedion_encheres`** (separate repo) → `EXPEDION_API_BASE_URL` on its
   payment server, and the release default in
   `lib/backend/expedion_api/expedion_config.dart`, which still names
   `expeditoo-ship-five.vercel.app`.

## 6. Test coverage required

- `src/lib/__tests__/app-url.test.ts`: variable wins; trailing slash dropped;
  empty falls back to `https://www.expeditop.fr`; constants agree; `mailbox()`.
- The existing suites that build links (`email.service`, `invoice-render`,
  `expedion-files`) pass with the new fixtures.
