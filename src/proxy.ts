import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import * as usersDAL from "@/server/dal/users.dal";

/**
 * Next.js 16 proxy.ts - Route protection
 * Replaces middleware.ts in Next.js 15
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protected routes that require authentication
  const protectedRoutes = [
    "/home",
    "/profile",
    "/settings",
    "/messages",
    "/deliveries",
    "/create",
    "/notifications",
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
  ],
};
