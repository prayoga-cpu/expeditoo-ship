#!/usr/bin/env node
/**
 * ============================================================================
 * Auth preflight — is every origin we sign people in from registered in every
 * allowlist that gates authentication?
 * ============================================================================
 *
 * The class of bug this catches: a deployment origin appears or changes — a
 * domain rename, a fresh Vercel project, a preview alias somebody decides to
 * demo from — and one of the allowlists that gates authentication is never
 * updated to match. Nothing fails at build time and no test goes red. The app
 * ships, and the first visitor who clicks "Google" gets a raw provider error
 * on a Google-branded page, which reads to them as our app being broken.
 *
 * ---------------------------------------------------------------------------
 * THE FOUR ALLOWLISTS, AND WHICH OF THEM THIS SCRIPT CAN ACTUALLY SEE
 * ---------------------------------------------------------------------------
 *
 *   1. Firebase Auth → Settings → Authorized domains.
 *      CHECKED HERE. Readable through the public Identity Toolkit config
 *      endpoint using the web API key. This is the allowlist that was missing
 *      the Expedion origin when sign-in broke in production, so it is the one
 *      check that is never allowed to quietly not run — see --require-firebase.
 *
 *   2. Better Auth `trustedOrigins` — src/lib/auth.ts, built from APP_URL,
 *      deploymentOrigins() and EXPEDION_APP_ORIGINS.
 *      CHECKED HERE, by asking the live deployment to begin a social sign-in
 *      with a callbackURL on the origin and seeing whether it agrees to.
 *
 *   3. CORS allowed origins — src/proxy.ts, CORS_PREFIXES crossed with
 *      allowedOrigins() (again EXPEDION_APP_ORIGINS).
 *      CHECKED HERE, for both the simple request and the preflight, plus the
 *      `set-auth-token` expose-header the Flutter bearer client depends on.
 *
 *   4. Google Cloud console → APIs & Services → Credentials → the OAuth
 *      client's "Authorized JavaScript origins" and "Authorized redirect URIs".
 *      *** NOT CHECKED. NOT CHECKABLE FROM HERE. ***
 *      Google publishes no read API for an OAuth client's registered origins
 *      short of authenticating as an owner of the GCP project, so nothing this
 *      script does can tell you whether that console screen is correct. All it
 *      can do is print the redirect_uri Better Auth intends to send people to,
 *      so a human can compare it against the console by eye. Allowlist #4 has
 *      to live on a manual checklist. A fully green run here does not mean
 *      Google OAuth works; it means the three allowlists we *can* read are
 *      right. Do not let this script talk you out of opening the console.
 *
 *      This one now matters more than it used to: since the Flutter client
 *      stopped using Firebase for Google sign-in, "Authorized JavaScript
 *      origins" is the entry the web button depends on. See the note above
 *      checkTrustedOriginAndGoogle for a probe that looks like it verifies
 *      this and does not.
 *
 * ---------------------------------------------------------------------------
 * Usage
 * ---------------------------------------------------------------------------
 *
 *   node scripts/auth-preflight.mjs --app-origin=https://expedion-encheres.vercel.app
 *   node scripts/auth-preflight.mjs --app-origin=https://a.example,https://b.example
 *   node scripts/auth-preflight.mjs --app-origin=https://a.example --app-origin=https://b.example
 *
 *   --app-origin=<origin>   Origin to verify. Repeatable, and accepts a
 *                           comma-separated list so the value of
 *                           EXPEDION_APP_ORIGINS can be passed through
 *                           verbatim. Defaults to $EXPEDION_APP_ORIGINS, then
 *                           $APP_PUBLIC_URL. Checking *every* configured
 *                           origin in one run is the point: an allowlist is
 *                           only ever wrong for some of them.
 *   --ship=<url>            The Next.js deployment that serves /api/auth.
 *                           Defaults to $EXPEDION_API_BASE_URL, then the
 *                           production ship URL.
 *   --firebase-key=<key>    Firebase web API key. Defaults to
 *                           $FIREBASE_API_KEY, then
 *                           $NEXT_PUBLIC_FIREBASE_API_KEY, then the built-in
 *                           public key below.
 *   --no-require-firebase   Downgrade an unreadable Firebase config from a
 *                           failure to a loudly-printed skip. Off by default,
 *                           and you should need a reason to pass it.
 *
 * Node 18+. No dependencies, by design: this has to be runnable from a bare CI
 * step before anything is installed, and from a laptop with a broken lockfile.
 */

// ============================================================================
// Config
// ============================================================================

/**
 * The Expedion Firebase project's web API key.
 *
 * Not a secret, and not treated as one: this exact string is compiled into
 * every web bundle Firebase ships and is visible in the browser devtools of
 * the live app. It is inlined here so the preflight still runs in an
 * environment nobody has configured yet — a fresh clone, a first CI run — and
 * so the answer to "is the Firebase check running?" is always yes.
 *
 * Override it with --firebase-key or FIREBASE_API_KEY when pointing the
 * preflight at a different Firebase project.
 */
const DEFAULT_FIREBASE_API_KEY = "AIzaSyBMZXXpMihGop4tOZi65rTKht88pyKpDdI";

/** The production Next.js deployment that serves Better Auth. */
const DEFAULT_SHIP = "https://expeditoo-ship-five.vercel.app";

/**
 * An origin that must never be trusted, used as the negative control.
 *
 * `example.com` is IANA-reserved and can never become ours by accident, so a
 * run that reports this origin as *allowed* is reporting a real defect rather
 * than a stale constant.
 */
const UNTRUSTED_ORIGIN = "https://not-allowed.example.com";

/** No single request may hang the whole run — CI has to fail, not stall. */
const TIMEOUT_MS = 15_000;

// ============================================================================
// Flags
// ============================================================================

function parseArgs(argv) {
  const appOrigins = [];
  let ship = "";
  let firebaseKey = "";
  let requireFirebase = true;

  for (const arg of argv) {
    const [flag, ...rest] = arg.split("=");
    const value = rest.join("=");

    switch (flag) {
      case "--app-origin":
      case "--app-origins":
        // Split on commas so `--app-origin="$EXPEDION_APP_ORIGINS"` works with
        // no reshaping at the call site. That variable is already a
        // comma-separated list, and asking a CI step to split it would be one
        // more place for the list to drift out of sync with the deployment.
        appOrigins.push(...value.split(",").map((o) => o.trim()).filter(Boolean));
        break;
      case "--ship":
        ship = value.trim();
        break;
      case "--firebase-key":
        firebaseKey = value.trim();
        break;
      case "--require-firebase":
        requireFirebase = value !== "false";
        break;
      case "--no-require-firebase":
        requireFirebase = false;
        break;
      case "--help":
      case "-h":
        usage();
        process.exit(0);
        break;
      default:
        // Positional arguments are refused rather than guessed at. The first
        // version of this script took `<origin> [ship]` positionally, and the
        // two were transposed often enough that a run could pass while
        // checking the ship's own origin against itself.
        console.error(`Unrecognised argument: ${arg}`);
        usage();
        process.exit(2);
    }
  }

  if (appOrigins.length === 0) {
    const fallback = process.env.EXPEDION_APP_ORIGINS || process.env.APP_PUBLIC_URL || "";
    appOrigins.push(...fallback.split(",").map((o) => o.trim()).filter(Boolean));
  }

  return {
    appOrigins: [...new Set(appOrigins.map(stripTrailingSlash))],
    ship: stripTrailingSlash(ship || process.env.EXPEDION_API_BASE_URL || DEFAULT_SHIP),
    firebaseKey:
      firebaseKey ||
      process.env.FIREBASE_API_KEY ||
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
      DEFAULT_FIREBASE_API_KEY,
    requireFirebase,
  };
}

function stripTrailingSlash(url) {
  return url.replace(/\/+$/, "");
}

function usage() {
  console.error(
    [
      "",
      "usage: node scripts/auth-preflight.mjs --app-origin=<origin>[,<origin>…] [options]",
      "",
      "  --app-origin=<origin>   repeatable, or comma-separated (accepts $EXPEDION_APP_ORIGINS verbatim)",
      `  --ship=<url>            Better Auth deployment (default ${DEFAULT_SHIP})`,
      "  --firebase-key=<key>    Firebase web API key (default: $FIREBASE_API_KEY, else the built-in public key)",
      "  --no-require-firebase   downgrade an unreadable Firebase config to a skip instead of a failure",
      "",
    ].join("\n")
  );
}

const { appOrigins, ship, firebaseKey, requireFirebase } = parseArgs(process.argv.slice(2));

if (appOrigins.length === 0) {
  console.error("No origin to check: pass --app-origin or set EXPEDION_APP_ORIGINS.");
  usage();
  process.exit(2);
}

for (const origin of appOrigins) {
  try {
    new URL(origin);
  } catch {
    console.error(`Not a URL: ${origin}`);
    process.exit(2);
  }
}

// ============================================================================
// Result collection
// ============================================================================

/** @type {{scope: string, name: string, state: "PASS"|"FAIL"|"SKIP", detail: string}[]} */
const results = [];

const pass = (scope, name, detail) => results.push({ scope, name, state: "PASS", detail });
const fail = (scope, name, detail) => results.push({ scope, name, state: "FAIL", detail });
const skip = (scope, name, detail) => results.push({ scope, name, state: "SKIP", detail });
const verdict = (scope, name, ok, detail) =>
  ok ? pass(scope, name, detail) : fail(scope, name, detail);

/**
 * Every check runs inside this, so a DNS failure or a timeout is reported as a
 * failed check rather than an unhandled rejection that kills the run halfway
 * and leaves the remaining allowlists unexamined.
 */
async function guard(scope, name, fn) {
  try {
    await fn();
  } catch (error) {
    fail(scope, name, `threw: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function request(url, init = {}) {
  return fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), ...init });
}

// ============================================================================
// Allowlist #1 — Firebase authorized domains
// ============================================================================

/**
 * Firebase Auth only permits an OAuth popup or redirect from a domain on its
 * authorized list. The list is readable without credentials, which makes this
 * the one console-side allowlist a script can verify at all.
 *
 * The failure mode this guards against is not "the check said no" — it is "the
 * check never ran". A preflight that skips its only console-visibility check
 * when a variable is unset produces a green CI run on precisely the deployment
 * where the outage is live, which is worse than having no preflight at all,
 * because now somebody trusts it. Hence --require-firebase, on by default: any
 * reason the config cannot be read is a FAIL, not a skip.
 */
async function checkFirebaseAuthorizedDomains(origins) {
  const name = "firebase:authorizedDomains";
  const scope = "shared";

  if (!firebaseKey) {
    const message =
      "no Firebase web API key — pass --firebase-key or set FIREBASE_API_KEY; " +
      "this is the only check that can see the Firebase console, so it is not " +
      "allowed to skip (pass --no-require-firebase if you truly mean to)";
    if (requireFirebase) return fail(scope, name, message);
    return skip(scope, name, message);
  }

  let res;
  try {
    res = await request(
      `https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(firebaseKey)}`
    );
  } catch (error) {
    const message = `config endpoint unreachable: ${error instanceof Error ? error.message : String(error)}`;
    return requireFirebase ? fail(scope, name, message) : skip(scope, name, message);
  }

  if (!res.ok) {
    const message = `config endpoint returned ${res.status} — is the API key right for this project?`;
    return requireFirebase ? fail(scope, name, message) : skip(scope, name, message);
  }

  const { authorizedDomains = [] } = await res.json();

  // Firebase allowlists a bare host, not an origin, so the scheme is dropped
  // for the comparison but the full origin stays the scope key — otherwise this
  // verdict lands in a section of its own instead of alongside the CORS and
  // trusted-origin verdicts for the same deployment.
  for (const origin of origins) {
    const host = new URL(origin).host;
    const listed = authorizedDomains.includes(host);
    verdict(
      origin,
      "firebase:authorizedDomains",
      listed,
      listed
        ? `${host} is allowlisted`
        : `${host} MISSING — add it under Firebase console → Authentication → ` +
            `Settings → Authorized domains. Currently [${authorizedDomains.join(", ")}]`
    );
  }
}

// ============================================================================
// Allowlist #3 — CORS
// ============================================================================

/**
 * Better Auth and the quotes bridge are both cross-origin for the Flutter
 * client, so a browser refuses to dispatch the request at all unless
 * src/proxy.ts echoes the origin back. From the client's side a missing CORS
 * header is indistinguishable from the server being down, which is why it gets
 * checked on both a simple request and a preflight rather than just one.
 */
async function checkCors(origin, path, method) {
  const preflight = method === "OPTIONS";
  const res = await request(`${ship}${path}`, {
    method,
    headers: preflight
      ? {
          Origin: origin,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type,authorization",
        }
      : { Origin: origin },
  });

  const allow = res.headers.get("access-control-allow-origin");
  verdict(
    origin,
    `cors:${method} ${path}`,
    allow === origin,
    allow === origin
      ? `echoes ${origin}`
      : `allow-origin=${allow ?? "none"} (expected ${origin}) — add it to EXPEDION_APP_ORIGINS`
  );
}

/**
 * Flutter has no cookie jar on native targets, so it authenticates with the
 * bearer token Better Auth returns in `set-auth-token`. A cross-origin caller
 * cannot read a response header that is not named in
 * Access-Control-Expose-Headers, so without this the app signs in successfully
 * and is then anonymous on the very next request.
 */
async function checkTokenHeaderExposed(origin) {
  const res = await request(`${ship}/api/auth/get-session`, { headers: { Origin: origin } });
  const expose = (res.headers.get("access-control-expose-headers") || "").toLowerCase();
  const exposed = expose.includes("set-auth-token");
  verdict(
    origin,
    "cors:expose set-auth-token",
    exposed,
    exposed ? "exposed" : `expose-headers=${expose || "none"} — Flutter cannot read the session token`
  );
}

/** A stale deployment answers 404 here; a current one asks who you are. */
async function checkQuotesBridgeLive(origin) {
  const res = await request(`${ship}/api/expedion/quotes`, { headers: { Origin: origin } });
  verdict(
    origin,
    "bridge:/api/expedion/quotes",
    res.status === 401,
    res.status === 401
      ? "401 (route exists, demands identity)"
      : `got ${res.status} — stale or wrong deployment?`
  );
}

// ============================================================================
// Allowlist #2 — Better Auth trusted origins, and #4's redirect_uri
// ============================================================================

/**
 * Better Auth refuses a sign-in whose Origin or callbackURL is not in
 * `trustedOrigins`, so asking it to start a Google sign-in *for this origin* is
 * a direct read of allowlist #2 — and, incidentally, proves Google is wired up
 * at all rather than the button having nowhere to go.
 *
 * The redirect_uri it prints belongs to allowlist #4, which this script cannot
 * verify. It is printed, not asserted, so a human can diff it against the GCP
 * console. Do not mistake the PASS next to it for a check.
 */
async function checkTrustedOriginAndGoogle(origin) {
  const res = await request(`${ship}/api/auth/sign-in/social`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ provider: "google", callbackURL: `${origin}/` }),
  });

  const body = await res.json().catch(() => ({}));
  const consented = typeof body.url === "string" && body.url.includes("accounts.google.com");

  verdict(
    origin,
    "betterauth:trustedOrigins",
    consented,
    consented
      ? "accepted as a trusted origin, and returned a Google consent URL"
      : `refused (${res.status} ${JSON.stringify(body).slice(0, 160)}) — ` +
          `add it to EXPEDION_APP_ORIGINS so auth.ts trusts it`
  );

  if (consented) {
    const redirect = new URL(body.url).searchParams.get("redirect_uri");
    pass(
      origin,
      "google:redirect_uri (NOT CHECKED)",
      `${redirect} — verify BY HAND in Google Cloud → Credentials; this script cannot read that console`
    );
  }
}

/*
 * A note for whoever tries to automate allowlist #4 next, so the same dead end
 * is not explored twice.
 *
 * `accounts.google.com/gsi/button` genuinely does validate the requesting
 * origin against the OAuth client's Authorized JavaScript origins, and under
 * curl it discriminates exactly as you would want:
 *
 *   allowed origin   + real client_id  -> 400   (origin accepted, params thin)
 *   forbidden origin + real client_id  -> 403
 *   allowed origin   + bogus client_id -> 403
 *
 * It still does not make a usable check. The same request issued from Node's
 * fetch returns 403 for an origin that is definitely allowlisted, and 400 when
 * the Referer is omitted entirely — so the answer turns on subtle differences
 * in how the client presents itself, not on the allowlist alone. A check that
 * fails for reasons unrelated to the thing it claims to test is worse than no
 * check: it goes red, someone learns to ignore the preflight, and the next real
 * failure is ignored with it.
 *
 * What DOES verify this reliably is a real browser. Load the sign-in page with
 * Playwright and watch for the `gsi/button` response and a console error
 * matching /origin is not allowed/. That belongs in an end-to-end test rather
 * than in a dependency-free preflight script.
 */

// ============================================================================
// Negative control
// ============================================================================

/**
 * Assert that an origin which must NOT be trusted is in fact rejected.
 *
 * Every other check in this file asserts a success, and a suite that only ever
 * asserts success cannot tell a correct allowlist from one that has been
 * widened to everything. `Access-Control-Allow-Origin: *`, a wildcard slipped
 * into EXPEDION_APP_ORIGINS, an `isDevLoopback` that stopped checking NODE_ENV
 * — each of those turns every positive check green while quietly handing the
 * app's session cookies to any site on the internet. The two assertions below
 * are the only thing in this script that would notice.
 */
async function checkNegativeControlCors() {
  const res = await request(`${ship}/api/auth/get-session`, {
    headers: { Origin: UNTRUSTED_ORIGIN },
  });
  const allow = res.headers.get("access-control-allow-origin");
  const rejected = allow !== UNTRUSTED_ORIGIN && allow !== "*";
  verdict(
    "negative control",
    "cors:rejects untrusted origin",
    rejected,
    rejected
      ? `no CORS headers for ${UNTRUSTED_ORIGIN} (allow-origin=${allow ?? "none"})`
      : `allow-origin=${allow} — the CORS allowlist is admitting an origin it must not; ` +
          `check EXPEDION_APP_ORIGINS for a wildcard and proxy.ts isDevLoopback for a missing NODE_ENV guard`
  );
}

async function checkNegativeControlTrustedOrigin() {
  const res = await request(`${ship}/api/auth/sign-in/social`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: UNTRUSTED_ORIGIN },
    body: JSON.stringify({ provider: "google", callbackURL: `${UNTRUSTED_ORIGIN}/steal` }),
  });

  const body = await res.json().catch(() => ({}));
  // Handing back a consent URL for an untrusted callbackURL is the whole of the
  // defect: the OAuth round trip would then deliver the session to that host.
  const rejected = !(typeof body.url === "string" && body.url.includes("accounts.google.com"));
  verdict(
    "negative control",
    "betterauth:rejects untrusted callbackURL",
    rejected,
    rejected
      ? `refused a sign-in aimed at ${UNTRUSTED_ORIGIN} (${res.status})`
      : `ISSUED A CONSENT URL for a callbackURL on ${UNTRUSTED_ORIGIN} — trustedOrigins is not being enforced`
  );
}

// ============================================================================
// Endpoint existence
// ============================================================================

/**
 * Do the routes the clients actually call exist on this deployment?
 *
 * This list exists because of a live outage, and the outage is worth stating
 * plainly so nobody trims the list back. The Flutter client was calling
 * POST /api/auth/forget-password. That path does not exist in better-auth
 * 1.4.6 — the route is POST /api/auth/request-password-reset — so every
 * password reset request in the app got a 404 and every user who forgot their
 * password was permanently locked out. Nothing anywhere failed loudly: the
 * server was healthy, the deployment was current, and the client simply asked
 * for a URL that was not there.
 *
 * A 404 is therefore the failure. A 400 is a PASS: it means the route exists
 * and is rejecting our deliberately empty body, which is exactly what we want,
 * since it lets us probe the real endpoints without sending mail or creating
 * accounts. 401/403/422 pass for the same reason. Only "there is nothing here"
 * (404) and "wrong verb" (405) fail.
 *
 * Every POST is sent `{}` rather than no body at all: better-auth's /sign-out
 * answers 500 to an absent body and 200 to `{}`, and a 500 here would read as
 * a broken deployment rather than a probe artefact.
 */
const ENDPOINTS = [
  { method: "POST", path: "/api/auth/sign-in/email" },
  { method: "POST", path: "/api/auth/sign-up/email" },
  // The route the Flutter client should have been calling all along.
  { method: "POST", path: "/api/auth/request-password-reset" },
  { method: "POST", path: "/api/auth/sign-in/social" },
  { method: "POST", path: "/api/auth/send-verification-email" },
  { method: "POST", path: "/api/auth/sign-out" },
  { method: "GET", path: "/api/auth/get-session" },
];

/**
 * Paths a client has been seen calling that must NOT exist, so that a 404 here
 * is recorded as expected rather than rediscovered as a mystery next time.
 */
const RETIRED_ENDPOINTS = [{ method: "POST", path: "/api/auth/forget-password" }];

async function checkEndpoint(origin, { method, path }) {
  const res = await request(`${ship}${path}`, {
    method,
    headers:
      method === "POST"
        ? { "Content-Type": "application/json", Origin: origin }
        : { Origin: origin },
    body: method === "POST" ? "{}" : undefined,
  });

  const missing = res.status === 404 || res.status === 405;
  verdict(
    "endpoints",
    `${method} ${path}`,
    !missing,
    missing
      ? `${res.status} — this route does not exist in this better-auth version; ` +
          `a client calling it is silently broken`
      : `${res.status} (route exists)`
  );
}

async function checkRetiredEndpoint(origin, { method, path }) {
  const res = await request(`${ship}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Origin: origin },
    body: "{}",
  });
  const gone = res.status === 404 || res.status === 405;
  verdict(
    "endpoints",
    `${method} ${path} (expected absent)`,
    gone,
    gone
      ? `${res.status} as expected — this path never existed in better-auth 1.4.6; ` +
          `clients must call /request-password-reset`
      : `${res.status} — unexpectedly present; the endpoint list above may be out of date`
  );
}

// ============================================================================
// Run
// ============================================================================

console.log("Auth preflight");
console.log(`  ship          ${ship}`);
console.log(`  app origins   ${appOrigins.join("\n                ")}`);
console.log(`  firebase key  ${firebaseKey ? `${firebaseKey.slice(0, 10)}… ` : "(none)"}${
  firebaseKey === DEFAULT_FIREBASE_API_KEY ? "(built-in public key)" : "(from environment/flag)"
}`);
console.log(`  firebase      ${requireFirebase ? "REQUIRED" : "optional (--no-require-firebase)"}`);
console.log("");

// The origin the shared, origin-independent checks speak from. Any trusted
// origin will do; the first configured one keeps the run deterministic.
const probeOrigin = appOrigins[0];

await Promise.all([
  guard("shared", "firebase:authorizedDomains", () =>
    checkFirebaseAuthorizedDomains(appOrigins)
  ),
  guard("negative control", "cors:rejects untrusted origin", checkNegativeControlCors),
  guard(
    "negative control",
    "betterauth:rejects untrusted callbackURL",
    checkNegativeControlTrustedOrigin
  ),
  ...ENDPOINTS.map((endpoint) =>
    guard("endpoints", `${endpoint.method} ${endpoint.path}`, () =>
      checkEndpoint(probeOrigin, endpoint)
    )
  ),
  ...RETIRED_ENDPOINTS.map((endpoint) =>
    guard("endpoints", `${endpoint.method} ${endpoint.path} (expected absent)`, () =>
      checkRetiredEndpoint(probeOrigin, endpoint)
    )
  ),
  ...appOrigins.flatMap((origin) => [
    guard(origin, "cors:GET /api/auth/get-session", () =>
      checkCors(origin, "/api/auth/get-session", "GET")
    ),
    guard(origin, "cors:OPTIONS /api/auth/sign-in/email", () =>
      checkCors(origin, "/api/auth/sign-in/email", "OPTIONS")
    ),
    guard(origin, "cors:expose set-auth-token", () => checkTokenHeaderExposed(origin)),
    guard(origin, "bridge:/api/expedion/quotes", () => checkQuotesBridgeLive(origin)),
    guard(origin, "betterauth:trustedOrigins", () => checkTrustedOriginAndGoogle(origin)),
  ]),
]);

// ============================================================================
// Report
// ============================================================================

const scopes = [...new Set(results.map((r) => r.scope))].sort((a, b) => {
  // Shared and negative-control blocks last, so the per-origin verdicts — the
  // ones somebody is usually here to read — are at the top of the output.
  const rank = (s) => (s === "endpoints" ? 1 : s === "negative control" ? 2 : s === "shared" ? 3 : 0);
  return rank(a) - rank(b) || a.localeCompare(b);
});

for (const scope of scopes) {
  console.log(`── ${scope} ${"─".repeat(Math.max(0, 60 - scope.length))}`);
  for (const { name, state, detail } of results
    .filter((r) => r.scope === scope)
    .sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`  ${state}  ${name.padEnd(44)} ${detail}`);
  }
  console.log("");
}

const failures = results.filter((r) => r.state === "FAIL");
const skipped = results.filter((r) => r.state === "SKIP");
const passed = results.length - failures.length - skipped.length;

console.log("─".repeat(64));
console.log(
  `${passed} passed, ${failures.length} failed${skipped.length ? `, ${skipped.length} skipped` : ""} ` +
    `across ${appOrigins.length} origin(s) against ${ship}`
);

if (failures.length > 0) {
  console.log("");
  console.log("FAILURES");
  for (const { scope, name, detail } of failures) {
    console.log(`  ✗ [${scope}] ${name}`);
    console.log(`      ${detail}`);
  }
}

if (skipped.length > 0) {
  console.log("");
  console.log("SKIPPED — these allowlists were NOT verified:");
  for (const { scope, name, detail } of skipped) {
    console.log(`  ? [${scope}] ${name}`);
    console.log(`      ${detail}`);
  }
}

console.log("");
console.log(
  "Reminder: Google Cloud → Credentials → Authorized JavaScript origins is " +
    "allowlist #4 and is NOT covered by this run. Check it by hand."
);

process.exit(failures.length > 0 ? 1 : 0);
