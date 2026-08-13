# Authentication Implementation Plan

**Project:** EXPEDITOO
**Feature:** Full Authentication System
**Created:** 2025-01-24
**Status:** In Progress

---

## Overview

Implement complete authentication system with the following requirements:
- **Auth Library:** better-auth
- **Authentication Methods:** Email/Password + Google OAuth
- **User Roles:** Multiple roles per user (Buyer, Seller, Auctioneer, Transporter, Operator, Admin)
- **Email Verification:** Required before user can access the application
- **Password Requirements:** Minimum 8 characters (keep simple)
- **Goal:** Users can register, login, and access dashboard with their profile data

---

## Architecture Layers

Following EXPEDITOO's strict layer architecture:

```
UI (RSC + Client) → Hooks → Client API → REST API → Service → DAL → Database
```

**Key Constraints:**
- UI NEVER calls Service or DAL directly
- API routes NEVER call DAL directly (must go through Service)
- Each layer has ONE responsibility
- All input validated with Zod
- No `any` types allowed

---

## Tech Stack

- **Authentication:** better-auth + @better-auth/drizzle
- **Database:** Drizzle ORM + PostgreSQL (Supabase)
- **Validation:** Zod schemas
- **Email Service:** Resend
- **OAuth Provider:** Google
- **Session Management:** better-auth sessions with cookies
- **Route Protection:** Next.js 16 `proxy.ts` (not middleware.ts)

---

## Database Schema Design

### 1. Users Table (`users`)

```typescript
{
  id: uuid (primary key)
  email: string (unique, not null)
  name: string
  emailVerified: timestamp (nullable)
  image: string (nullable) // profile picture from OAuth or upload
  password: string (hashed, nullable for OAuth-only users)
  createdAt: timestamp
  updatedAt: timestamp
}
```

### 2. User Roles Table (`user_roles`)

Many-to-many relationship: users ↔ roles

```typescript
{
  id: uuid (primary key)
  userId: uuid (foreign key → users.id)
  role: enum ('buyer', 'seller', 'auctioneer', 'transporter', 'operator', 'admin')
  assignedAt: timestamp
  assignedBy: uuid (nullable, foreign key → users.id) // who assigned this role
}
```

**Indexes:**
- `userId` + `role` (unique composite)
- `userId` (for querying user's roles)

### 3. Sessions Table (`sessions`)

Managed by better-auth:

```typescript
{
  id: string (primary key)
  userId: uuid (foreign key → users.id)
  expiresAt: timestamp
  token: string (unique)
  ipAddress: string (nullable)
  userAgent: string (nullable)
}
```

### 4. Accounts Table (`accounts`)

For OAuth providers:

```typescript
{
  id: uuid (primary key)
  userId: uuid (foreign key → users.id)
  provider: string (e.g., 'google')
  providerAccountId: string
  accessToken: string (nullable)
  refreshToken: string (nullable)
  expiresAt: timestamp (nullable)
}
```

### 5. Verification Tokens Table (`verification_tokens`)

For email verification:

```typescript
{
  id: uuid (primary key)
  identifier: string (email)
  token: string (unique)
  expiresAt: timestamp
}
```

---

## Implementation Phases

### Phase 1: Documentation (SDD - Spec-Driven Development) ✅

**Files to Create:**
1. `docs/plans/plan_auth.md` (this file)
2. `docs/specs/auth_spec.md` (detailed behavior specification)

**Purpose:**
- Define EXACT expected behavior
- Document all edge cases
- Specify input/output formats
- Serve as source of truth for debugging

---

### Phase 2: Dependencies Installation

**Install Required Packages:**

```bash
pnpm add better-auth
pnpm add drizzle-orm drizzle-kit postgres
pnpm add resend
pnpm add -D @types/node
```

**Files to Modify:**
- `package.json`

**Notes:**
- `bcrypt` is already installed (might not need it if better-auth handles password hashing)
- Supabase PostgreSQL credentials already in `.env`

---

### Phase 3: Database Setup

#### 3.1 Drizzle Configuration

**File to Create:** `drizzle.config.ts`

```typescript
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.POSTGRES_URL!,
  },
} satisfies Config;
```

#### 3.2 Database Schema

**File to Create:** `src/db/schema.ts`

Define all tables using Drizzle schema:
- `users` table
- `user_roles` table
- `sessions` table (better-auth)
- `accounts` table (OAuth)
- `verification_tokens` table

**Relations:**
- `users` ← `user_roles` (one-to-many)
- `users` ← `sessions` (one-to-many)
- `users` ← `accounts` (one-to-many)

#### 3.3 Database Client

**File to Create:** `src/db/index.ts`

Export configured Drizzle client:
```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const client = postgres(process.env.POSTGRES_URL!);
export const db = drizzle(client);
```

#### 3.4 Run Migration

```bash
pnpm drizzle-kit generate:pg
pnpm drizzle-kit push:pg
```

**Files Created:**
- `src/db/migrations/*.sql`

---

### Phase 4: DTO Layer (Data Transfer Objects)

#### 4.1 Auth DTOs

**File to Create:** `src/server/dto/auth.dto.ts`

```typescript
import { z } from "zod";

// Sign Up
export const signUpInputSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
});

export type SignUpInput = z.infer<typeof signUpInputSchema>;

// Sign In
export const signInInputSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export type SignInInput = z.infer<typeof signInInputSchema>;

// Verify Email
export const verifyEmailInputSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

// Reset Password
export const resetPasswordInputSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

// Request Password Reset
export const requestPasswordResetInputSchema = z.object({
  email: z.string().email("Invalid email format"),
});
```

#### 4.2 User DTOs

**File to Create:** `src/server/dto/user.dto.ts`

```typescript
import { z } from "zod";

// User Role Enum
export const userRoleSchema = z.enum([
  "buyer",
  "seller",
  "auctioneer",
  "transporter",
  "operator",
  "admin",
]);

export type UserRole = z.infer<typeof userRoleSchema>;

// User Output (what we return to client)
export const userOutputSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  image: z.string().nullable(),
  emailVerified: z.date().nullable(),
  roles: z.array(userRoleSchema),
  createdAt: z.date(),
});

export type UserOutput = z.infer<typeof userOutputSchema>;

// Update Profile
export const updateProfileInputSchema = z.object({
  name: z.string().min(1).optional(),
  image: z.string().url().optional(),
});

// Assign Role (Admin only)
export const assignRoleInputSchema = z.object({
  userId: z.string().uuid(),
  role: userRoleSchema,
});

// Remove Role (Admin only)
export const removeRoleInputSchema = z.object({
  userId: z.string().uuid(),
  role: userRoleSchema,
});
```

---

### Phase 5: DAL Layer (Data Access Layer)

#### 5.1 Users DAL

**File to Create:** `src/server/dal/users.dal.ts`

Pure database operations, no business logic:

```typescript
import { db } from "@/db";
import { users, userRoles } from "@/db/schema";
import { eq } from "drizzle-orm";

export const usersDAL = {
  // Get user by ID
  getUserById: async (id: string) => {
    return db.query.users.findFirst({
      where: eq(users.id, id),
      with: { roles: true },
    });
  },

  // Get user by email
  getUserByEmail: async (email: string) => {
    return db.query.users.findFirst({
      where: eq(users.email, email),
      with: { roles: true },
    });
  },

  // Create user
  createUser: async (data: InsertUser) => {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  },

  // Update user
  updateUser: async (id: string, data: Partial<InsertUser>) => {
    const [user] = await db.update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return user;
  },

  // Get user roles
  getUserRoles: async (userId: string) => {
    return db.query.userRoles.findMany({
      where: eq(userRoles.userId, userId),
    });
  },

  // Assign role
  assignRole: async (userId: string, role: string, assignedBy?: string) => {
    const [userRole] = await db.insert(userRoles)
      .values({ userId, role, assignedBy })
      .returning();
    return userRole;
  },

  // Remove role
  removeRole: async (userId: string, role: string) => {
    await db.delete(userRoles)
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.role, role)
        )
      );
  },
};
```

#### 5.2 Sessions DAL

**File to Create:** `src/server/dal/sessions.dal.ts`

```typescript
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";

export const sessionsDAL = {
  getSession: async (token: string) => {
    return db.query.sessions.findFirst({
      where: eq(sessions.token, token),
    });
  },

  deleteSession: async (token: string) => {
    await db.delete(sessions).where(eq(sessions.token, token));
  },

  deleteUserSessions: async (userId: string) => {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  },
};
```

---

### Phase 6: Service Layer (Business Logic)

#### 6.1 Auth Service

**File to Create:** `src/server/services/auth.service.ts`

All authentication business logic:

```typescript
import { usersDAL } from "../dal/users.dal";
import { signUpInputSchema, signInInputSchema } from "../dto/auth.dto";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const authService = {
  signUp: async (input: unknown) => {
    // Validate input
    const validated = signUpInputSchema.parse(input);

    // Check if user exists
    const existingUser = await usersDAL.getUserByEmail(validated.email);
    if (existingUser) {
      throw new Error("Email already registered");
    }

    // Create user (better-auth will handle password hashing)
    const user = await usersDAL.createUser({
      email: validated.email,
      name: validated.name,
      emailVerified: null, // Not verified yet
    });

    // Assign default role (buyer)
    await usersDAL.assignRole(user.id, "buyer");

    // Send verification email
    await authService.sendVerificationEmail(validated.email);

    return { success: true, userId: user.id };
  },

  sendVerificationEmail: async (email: string) => {
    // Generate verification token (better-auth handles this)
    // Send email via Resend
    await resend.emails.send({
      from: "noreply@expeditoo.com",
      to: email,
      subject: "Verify your email",
      html: `<p>Click here to verify your email: <a href="${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=TOKEN">Verify Email</a></p>`,
    });
  },

  verifyEmail: async (token: string) => {
    // better-auth handles token validation and user update
    // This method might not be needed if better-auth handles it
  },

  requestPasswordReset: async (email: string) => {
    const user = await usersDAL.getUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists
      return { success: true };
    }

    // Send password reset email
    await resend.emails.send({
      from: "noreply@expeditoo.com",
      to: email,
      subject: "Reset your password",
      html: `<p>Click here to reset your password: <a href="${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=TOKEN">Reset Password</a></p>`,
    });

    return { success: true };
  },
};
```

#### 6.2 User Service

**File to Create:** `src/server/services/user.service.ts`

```typescript
import { usersDAL } from "../dal/users.dal";
import { userOutputSchema, assignRoleInputSchema } from "../dto/user.dto";

export const userService = {
  getProfile: async (userId: string) => {
    const user = await usersDAL.getUserById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Transform to DTO format
    return userOutputSchema.parse({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      emailVerified: user.emailVerified,
      roles: user.roles.map(r => r.role),
      createdAt: user.createdAt,
    });
  },

  updateProfile: async (userId: string, input: unknown) => {
    // Validate input
    const validated = updateProfileInputSchema.parse(input);

    // Update user
    await usersDAL.updateUser(userId, validated);

    return { success: true };
  },

  assignRole: async (input: unknown, adminId: string) => {
    // Validate input
    const validated = assignRoleInputSchema.parse(input);

    // Check if admin has permission (must be admin)
    const admin = await usersDAL.getUserById(adminId);
    const isAdmin = admin?.roles.some(r => r.role === "admin");
    if (!isAdmin) {
      throw new Error("Unauthorized: Admin role required");
    }

    // Assign role
    await usersDAL.assignRole(validated.userId, validated.role, adminId);

    return { success: true };
  },

  removeRole: async (input: unknown, adminId: string) => {
    // Similar to assignRole but removes
  },
};
```

---

### Phase 7: better-auth Configuration

#### 7.1 Server Configuration

**File to Create:** `src/lib/auth.ts`

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectURI: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
});

export type Session = typeof auth.$Infer.Session;
```

#### 7.2 Client Configuration

**File to Create:** `src/lib/auth-client.ts`

```typescript
import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});

export const { signIn, signUp, signOut, useSession } = authClient;
```

---

### Phase 8: API Routes

#### 8.1 Auth API (better-auth catch-all)

**File to Create:** `src/app/api/auth/[...all]/route.ts`

```typescript
import { auth } from "@/lib/auth";

export const { GET, POST } = auth.handler;
```

This single route handles all better-auth endpoints:
- `/api/auth/sign-in`
- `/api/auth/sign-up`
- `/api/auth/sign-out`
- `/api/auth/callback/google`
- `/api/auth/verify-email`
- etc.

#### 8.2 User Profile API

**File to Create:** `src/app/api/user/profile/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userService } from "@/server/services/user.service";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await userService.getProfile(session.user.id);
  return NextResponse.json(profile);
}

export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  await userService.updateProfile(session.user.id, body);

  return NextResponse.json({ success: true });
}
```

#### 8.3 User Roles API (Admin only)

**File to Create:** `src/app/api/user/roles/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userService } from "@/server/services/user.service";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  await userService.assignRole(body, session.user.id);

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  await userService.removeRole(body, session.user.id);

  return NextResponse.json({ success: true });
}
```

---

### Phase 9: Route Protection (Next.js 16 proxy.ts)

#### 9.1 Proxy Configuration

**File to Create:** `src/proxy.ts`

```typescript
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });

  const { pathname } = req.nextUrl;

  // Protected routes
  const protectedRoutes = [
    "/home",
    "/profile",
    "/settings",
    "/messages",
    "/deliveries",
    "/auction",
    "/listing",
    "/create",
    "/checkout",
    "/wallet",
    "/notifications",
  ];

  // Admin routes
  const adminRoutes = ["/admin"];

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));

  // Redirect to signin if not authenticated
  if (isProtectedRoute && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Check admin role
  if (isAdminRoute && session) {
    // Get user roles from database
    const user = await usersDAL.getUserById(session.user.id);
    const isAdmin = user?.roles.some((r) => r.role === "admin");

    if (!isAdmin) {
      return NextResponse.redirect(new URL("/home", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
```

#### 9.2 Auth Helper Functions

**File to Create:** `src/lib/auth-helpers.ts`

Server-side helpers for page components:

```typescript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { usersDAL } from "@/server/dal/users.dal";

// Get server session
export async function getServerSession() {
  const session = await auth.api.getSession({
    headers: await headers()
  });
  return session;
}

// Require authentication (use in Server Components)
export async function requireAuth() {
  const session = await getServerSession();

  if (!session) {
    redirect("/signin");
  }

  return session;
}

// Require specific role
export async function requireRole(role: string) {
  const session = await requireAuth();

  const user = await usersDAL.getUserById(session.user.id);
  const hasRole = user?.roles.some((r) => r.role === role);

  if (!hasRole) {
    redirect("/home");
  }

  return session;
}

// Check if user has role (non-redirecting)
export async function hasRole(role: string) {
  const session = await getServerSession();

  if (!session) return false;

  const user = await usersDAL.getUserById(session.user.id);
  return user?.roles.some((r) => r.role === role) ?? false;
}
```

---

### Phase 10: Client Integration

#### 10.1 Replace Auth Context

**File to Modify:** `src/lib/auth-context.tsx`

Replace mock implementation with better-auth client:

```typescript
"use client";

import { createContext, useContext, ReactNode } from "react";
import { useSession } from "@/lib/auth-client";
import type { Session } from "@/lib/auth";

interface AuthContextType {
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();

  return (
    <AuthContext.Provider
      value={{
        session: session ?? null,
        isLoading: isPending,
        isAuthenticated: !!session,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
```

#### 10.2 Auth Feature Hook

**File to Create:** `src/features/auth/hooks/useAuth.ts`

```typescript
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function useAuthActions() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await authClient.signIn.email({ email, password });
      router.push("/home");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Sign in failed");
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await authClient.signUp.email({ email, password, name });
      router.push("/verify-email");
    } catch (err: any) {
      setError(err.message || "Sign up failed");
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    await authClient.signOut();
    router.push("/signin");
    router.refresh();
  };

  const signInWithGoogle = async () => {
    await authClient.signIn.social({ provider: "google" });
  };

  return {
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    isLoading,
    error,
  };
}
```

#### 10.3 Auth Types

**File to Create:** `src/features/auth/types.ts`

```typescript
export enum UserRole {
  BUYER = "buyer",
  SELLER = "seller",
  AUCTIONEER = "auctioneer",
  TRANSPORTER = "transporter",
  OPERATOR = "operator",
  ADMIN = "admin",
}

export interface User {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: Date | null;
  roles: UserRole[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSession {
  user: User;
  expiresAt: Date;
}
```

---

### Phase 11: UI Integration

#### 11.1 Update Signin Page

**File to Modify:** `src/app/(auth)/signin/page.tsx`

Integrate real authentication:

```typescript
"use client";

import { useAuthActions } from "@/features/auth/hooks/useAuth";
import { Button } from "@/components/ui/button";
// ... other imports

export default function SignInPage() {
  const { signIn, signInWithGoogle, isLoading, error } = useAuthActions();
  const form = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = async (data: SignInFormData) => {
    await signIn(data.email, data.password);
  };

  return (
    <div>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Form fields */}
        {error && <p className="text-red-500">{error}</p>}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <Button onClick={signInWithGoogle}>
        Sign in with Google
      </Button>
    </div>
  );
}
```

#### 11.2 Update Signup Page

**File to Modify:** `src/app/(auth)/signup/page.tsx`

Similar to signin, integrate real signup:

```typescript
const { signUp, signInWithGoogle, isLoading, error } = useAuthActions();

const onSubmit = async (data: SignUpFormData) => {
  await signUp(data.email, data.password, data.fullName);
};
```

#### 11.3 Create Verify Email Page

**File to Create:** `src/app/(auth)/verify-email/page.tsx`

```typescript
export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const { token } = searchParams;

  if (token) {
    // Verify token via API
    // Show success/error message
  }

  return (
    <div>
      <h1>Verify Your Email</h1>
      <p>We've sent a verification link to your email. Please check your inbox.</p>
    </div>
  );
}
```

#### 11.4 Update Profile Pages

**File to Modify:** `src/app/(app)/profile/page.tsx`

Load real user data:

```typescript
import { requireAuth } from "@/lib/auth-helpers";
import { userService } from "@/server/services/user.service";

export default async function ProfilePage() {
  const session = await requireAuth();
  const user = await userService.getProfile(session.user.id);

  return <Profile user={user} />;
}
```

---

### Phase 12: Admin Features

#### 12.1 Admin User Management UI

**File to Create:** `src/app/(app)/admin/users/page.tsx`

List all users with role management:

```typescript
import { requireRole } from "@/lib/auth-helpers";

export default async function AdminUsersPage() {
  await requireRole("admin");

  // Fetch all users
  // Display in table with role assignment UI

  return <div>Admin User Management</div>;
}
```

---

## Environment Variables Required

Add to `.env`:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email Service (Resend)
RESEND_API_KEY=your-resend-api-key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Already configured:
# POSTGRES_URL
# SUPABASE credentials
```

---

## Testing Checklist

- [ ] User can register with email/password
- [ ] Verification email is sent
- [ ] User can verify email via link
- [ ] User can login with verified email
- [ ] User cannot login with unverified email
- [ ] User can login with Google OAuth
- [ ] User can logout
- [ ] User can reset password
- [ ] Protected routes redirect to signin
- [ ] Authenticated users can access dashboard
- [ ] Profile shows correct user data and roles
- [ ] Admin can assign roles to users
- [ ] Admin routes are protected (non-admins redirected)
- [ ] Session persists across page reloads
- [ ] Session expires correctly

---

## Migration Strategy

### Existing Mock Data
- Current `auth-context.tsx` uses localStorage
- Existing UI works with mock auth
- Need to gracefully replace without breaking existing pages

### Migration Steps
1. Keep both auth systems temporarily
2. Add feature flag to toggle between mock and real auth
3. Test all flows with real auth
4. Remove mock auth once verified
5. Clean up localStorage usage

---

## Files Summary

### Create (30+ files)
- `docs/plans/plan_auth.md` ✅
- `docs/specs/auth_spec.md`
- `drizzle.config.ts`
- `src/db/schema.ts`
- `src/db/index.ts`
- `src/server/dto/auth.dto.ts`
- `src/server/dto/user.dto.ts`
- `src/server/dal/users.dal.ts`
- `src/server/dal/sessions.dal.ts`
- `src/server/services/auth.service.ts`
- `src/server/services/user.service.ts`
- `src/lib/auth.ts`
- `src/lib/auth-client.ts`
- `src/lib/auth-helpers.ts`
- `src/app/api/auth/[...all]/route.ts`
- `src/app/api/user/profile/route.ts`
- `src/app/api/user/roles/route.ts`
- `src/proxy.ts` (Next.js 16 route protection)
- `src/features/auth/hooks/useAuth.ts`
- `src/features/auth/types.ts`
- `src/app/(auth)/verify-email/page.tsx`
- `src/app/(app)/admin/users/page.tsx`

### Modify (8 files)
- `package.json`
- `.env`
- `src/lib/auth-context.tsx`
- `src/app/(auth)/signin/page.tsx`
- `src/app/(auth)/signup/page.tsx`
- `src/app/(auth)/forgot-password/page.tsx`
- `src/app/(app)/profile/page.tsx`
- `docs/roadmap.md`

---

## Next Steps

1. ✅ Create this plan document
2. Create specification document (`auth_spec.md`)
3. Install dependencies
4. Start implementation from Phase 2
5. Follow layer-by-layer approach (Database → Service → API → UI)

---

## Notes

- **Next.js 16 Change:** Use `proxy.ts` instead of `middleware.ts` for route protection
- **Better Auth:** Modern, TypeScript-first auth library
- **Multiple Roles:** Users can have multiple roles simultaneously
- **Email Verification:** Required before access (users must verify email)
- **Google OAuth:** Integrated for social login
- **Session Management:** Handled by better-auth with secure cookies

---

**Status:** Plan Complete - Ready for Specification Document
