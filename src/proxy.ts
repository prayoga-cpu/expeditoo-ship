import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import * as usersDAL from "@/server/dal/users.dal";

/**
 * Next.js 16 proxy.ts - Route protection
 * Replaces middleware.ts in Next.js 15
 */

// ============================================================================
// CORS for the Expedion client
// ============================================================================
//
// Expedion is a Flutter app served from its own origin — a Vercel deployment in
// production, a random `localhost:<port>` under `flutter run -d chrome`. Every
// call it makes to `/api/auth/*` or `/api/expedion/*` is therefore cross-origin,
// and a browser will not send one without a passing preflight. Next.js adds no
// CORS headers on its own and Better Auth only adds them inside particular
// plugins, so without this the client fails before the request is dispatched —
// which is indistinguishable, from the client's side, from the server being
// down.
//
// `Access-Control-Allow-Origin` echoes the requesting origin rather than `*`,
// because these requests carry credentials (a bearer session token, and cookies
// for the web app) and browsers reject `*` in that case. An origin that is not
// allowed gets no CORS headers, so the browser blocks it — the intended answer,
// not an oversight.

/** `/api/auth/*` is Better Auth; `/api/expedion/*` is the quotes bridge. */
const CORS_PREFIXES = ["/api/auth", "/api/expedion"];

const ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  // Named explicitly: the legacy shared-key path sends it, and a header absent
  // from this list fails preflight even when the request itself would succeed.
  "x-expedion-uid",
];

const ALLOWED_METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"];

function allowedOrigins(): string[] {
  return [
    process.env.NEXT_PUBLIC_APP_URL,
    ...(process.env.EXPEDION_APP_ORIGINS?.split(",") ?? []),
  ]
    .map((origin) => origin?.trim())
    .filter(Boolean) as string[];
}

/**
 * Outside production, any loopback port is allowed.
 *
 * `flutter run` picks a fresh random port every launch, so pinning one in the
 * environment would mean editing it before each run. Gated on NODE_ENV, so a
 * production deployment never trusts a local origin.
 */
function isDevLoopback(origin: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const { hostname, protocol } = new URL(origin);
    return (
      protocol === "http:" &&
      (hostname === "localhost" || hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

function withCors(response: NextResponse, origin: string): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set(
    "Access-Control-Allow-Methods",
    ALLOWED_METHODS.join(", ")
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    ALLOWED_HEADERS.join(", ")
  );
  // Better Auth returns the session token in this header on sign-in. Without
  // exposing it the browser hides it from the client, and the Flutter web build
  // signs in successfully then goes anonymous on the very next request.
  response.headers.set("Access-Control-Expose-Headers", "set-auth-token");
  response.headers.set("Access-Control-Max-Age", "86400");
  // The response varies by origin, so a cache must not serve one origin's
  // headers to another.
  response.headers.append("Vary", "Origin");
  return response;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ---- API surface: CORS only, never the page redirects below -------------
  const isCorsPath = CORS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (isCorsPath) {
    const origin = req.headers.get("origin");
    // Same-origin requests send no Origin header and need nothing added.
    if (!origin) return NextResponse.next();

    const permitted = allowedOrigins().includes(origin) || isDevLoopback(origin);

    if (req.method === "OPTIONS") {
      // Answered here rather than at a route with no OPTIONS handler, which
      // would 405 the preflight.
      const preflight = new NextResponse(null, { status: 204 });
      return permitted ? withCors(preflight, origin) : preflight;
    }

    const response = NextResponse.next();
    return permitted ? withCors(response, origin) : response;
  }

  // Protected routes that require authentication
  const protectedRoutes = [
    "/home",
    "/profile",
    "/settings",
    "/messages",
    "/deliveries",
    "/expedion",
    "/notifications",
    "/carrier",
  ];

  // Admin-only routes
  const adminRoutes = ["/admin"];

  // Check if current path starts with any protected route
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));

  // If not a protected route, allow access
  if (!isProtectedRoute && !isAdminRoute) {
    return NextResponse.next();
  }

  // Get session from better-auth
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  // Redirect to signin if not authenticated
  if (!session && (isProtectedRoute || isAdminRoute)) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Check email verification
  if (session && !session.user.emailVerified && isProtectedRoute) {
    // Allow access to verification-related pages
    if (pathname.startsWith("/verify-email")) {
      return NextResponse.next();
    }

    // Redirect unverified users to verification page
    const url = req.nextUrl.clone();
    url.pathname = "/verify-email";
    return NextResponse.redirect(url);
  }

  // Check admin role for admin routes
  if (isAdminRoute && session) {
    try {
      // Get user roles from database
      const user = await usersDAL.getUserById(session.user.id);
      const isAdmin = user?.roles.some((r) => r.role === "admin");

      if (!isAdmin) {
        // Redirect non-admin users to home
        const url = req.nextUrl.clone();
        url.pathname = "/home";
        return NextResponse.redirect(url);
      }
    } catch (error) {
      console.error("[Proxy] Error checking admin role:", error);
      // On error, redirect to home for safety
      const url = req.nextUrl.clone();
      url.pathname = "/home";
      return NextResponse.redirect(url);
    }
  }

  // Allow access
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /api routes (API routes)
     * - /_next/static (static files)
     * - /_next/image (image optimization files)
     * - /favicon.ico, /robots.txt, etc. (public files)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.ico$).*)",
    // The two API surfaces the Expedion client calls cross-origin. Named
    // explicitly because the pattern above deliberately excludes /api; they
    // take the CORS branch above and never the page-protection logic.
    "/api/auth/:path*",
    "/api/expedion/:path*",
  ],
};
