# Authentication System Specification

**Project:** EXPEDITOO
**Feature:** Complete Authentication System
**Version:** 1.0.0
**Created:** 2025-01-24
**Purpose:** Define EXACT expected behavior for all authentication flows

---

## Table of Contents

1. [System Overview](#system-overview)
2. [User Roles](#user-roles)
3. [Authentication Flows](#authentication-flows)
4. [API Specifications](#api-specifications)
5. [Validation Rules](#validation-rules)
6. [Error Scenarios](#error-scenarios)
7. [Session Management](#session-management)
8. [Security Requirements](#security-requirements)
9. [Edge Cases](#edge-cases)

---

## 1. System Overview

### Authentication Methods

- **Email/Password** - Primary authentication method
- **Google OAuth** - Social login alternative

### Key Requirements

- ✅ Email verification REQUIRED before access
- ✅ Users can have MULTIPLE roles
- ✅ Password minimum 8 characters (no complexity requirements)
- ✅ Sessions expire after 7 days of inactivity
- ✅ Session refreshes every 24 hours

### Default Behavior

- New users automatically assigned **"buyer"** role
- Unverified users cannot access protected routes
- Sessions stored in httpOnly cookies
- CSRF protection enabled

---

## 2. User Roles

### Role Definitions

| Role        | Value         | Description                          | Default |
| ----------- | ------------- | ------------------------------------ | ------- |
| Buyer       | `buyer`       | Can browse, bid, buy items           | ✅ Yes  |
| Seller      | `seller`      | Can create listings, sell items      | ❌ No   |
| Auctioneer  | `auctioneer`  | Manages auctions, approves items     | ❌ No   |
| Transporter | `transporter` | Accepts delivery jobs                | ❌ No   |
| Operator    | `operator`    | Validates shipments, adjusts pricing | ❌ No   |
| Admin       | `admin`       | Full platform management             | ❌ No   |

### Role Assignment Rules

**Automatic Assignment:**

- New user → `buyer` role (always)

**Manual Assignment (Admin Only):**

- Admin can assign ANY role to ANY user
- Admin can remove ANY role from ANY user
- User can have MULTIPLE roles simultaneously
- User MUST have at least ONE role (cannot remove all roles)

**Role Persistence:**

- Roles persist across sessions
- Roles stored in `user_roles` table
- Roles loaded with user session

---

## 3. Authentication Flows

### 3.1 Email/Password Signup Flow

**Happy Path:**

```
1. User visits /signup
2. User enters:
   - Email (valid format)
   - Password (min 8 chars)
   - Full Name
   - Confirms Password (must match)
3. User clicks "Sign Up"
4. System validates input
5. System checks email doesn't exist
6. System creates user with emailVerified = null
7. System assigns "buyer" role
8. System sends verification email
9. System redirects to /verify-email with message
10. User clicks link in email
11. System verifies token
12. System sets emailVerified = current timestamp
13. User can now login
```

**Expected Behavior:**

| Step             | Action               | Expected Result                   | Error Handling                      |
| ---------------- | -------------------- | --------------------------------- | ----------------------------------- |
| Input Email      | User types email     | Real-time validation shows ✓/✗    | Show error: "Invalid email format"  |
| Input Password   | User types password  | Show character count              | Show error if < 8 chars             |
| Confirm Password | User types again     | Show ✓ if matches                 | Show error: "Passwords don't match" |
| Submit Form      | Click Sign Up        | Loading state on button           | Button disabled during request      |
| Email Exists     | System checks DB     | Error: "Email already registered" | Show error below email field        |
| Email Sent       | System sends email   | Success message shown             | Show error if email service fails   |
| Token Expired    | User clicks old link | Error: "Token expired"            | Show button to resend               |

**Post-Signup State:**

- User exists in DB with `emailVerified = null`
- User has `buyer` role assigned
- User CANNOT login until email verified
- Verification token valid for 1 hour
- Verification email sent to user's email (or test email in dev mode)

---

### 3.2 Email Verification Flow

**Happy Path:**

```
1. User receives email with verification link
2. Link format: /api/auth/verify-email?token=<TOKEN>&callbackURL=/signin?verified=true
3. User clicks link
4. System validates token:
   - Token exists in DB
   - Token not expired
   - Token not already used
5. System updates user.emailVerified = NOW()
6. System deletes/invalidates token
7. System redirects to /signin?verified=true
8. Signin page shows success toast notification
9. User can now sign in with verified account
```

**Expected Behavior:**

| Scenario         | Expected Result             | UI Display                                   |
| ---------------- | --------------------------- | -------------------------------------------- |
| Valid Token      | Email verified successfully | Redirect to /signin + ✓ Success toast (10s)  |
| Invalid Token    | Verification failed         | ✗ Error message on verify-email page         |
| Expired Token    | Token expired (>1h old)     | ✗ Error + "Resend verification email" button |
| Already Verified | User already verified       | ℹ️ Info message + redirect to login          |

**Success Toast Message:**

- **Title:** "Email verified successfully!"
- **Description:** "You can now sign in to your account."
- **Duration:** 10 seconds
- **Type:** Success (green)
- **Auto-dismiss:** Yes

**Resend Verification Email:**

- User can request new verification email
- Rate limit: 1 email per 5 minutes
- Previous tokens invalidated
- New token generated with 1h expiry

**Verification URL Structure:**

- Base URL: `/api/auth/verify-email`
- Query params:
  - `token`: JWT verification token
  - `callbackURL`: `/signin?verified=true` (where to redirect after success)

---

### 3.3 Email/Password Login Flow

**Happy Path:**

```
1. User visits /signin
2. User enters:
   - Email
   - Password
3. User clicks "Sign In"
4. System validates input
5. System checks:
   - User exists
   - Password correct
   - Email verified = true
6. System creates session
7. System sets session cookie (httpOnly)
8. System redirects to /home
```

**Expected Behavior:**

| Scenario                           | Expected Result       | Error Message                                         |
| ---------------------------------- | --------------------- | ----------------------------------------------------- |
| Correct Credentials + Verified     | Login success → /home | None                                                  |
| Correct Credentials + NOT Verified | Login blocked         | "Please verify your email first" + resend link        |
| Incorrect Password                 | Login failed          | "Invalid email or password"                           |
| Email Not Found                    | Login failed          | "Invalid email or password" (same message - security) |
| Account Locked                     | Login blocked         | "Account locked. Contact support"                     |
| Too Many Attempts                  | Temp block (15 min)   | "Too many failed attempts. Try again in X minutes"    |

**Rate Limiting:**

- Max 5 failed attempts per email per 15 minutes
- After 5 fails → account temporarily locked
- Lockout duration: 15 minutes
- Counter resets after successful login

**Session Creation:**

- Session token stored in httpOnly cookie
- Cookie name: `better-auth.session_token`
- Expires: 7 days
- Refresh: every 24 hours
- Secure: true (HTTPS only in production)
- SameSite: lax

---

### 3.4 Google OAuth Flow

**Happy Path:**

```
1. User visits /signin
2. User clicks "Sign in with Google"
3. User redirected to Google consent screen
4. User approves permissions
5. Google redirects back to /api/auth/callback/google
6. System receives OAuth code
7. System exchanges code for tokens
8. System checks if user exists (by email):
   a. EXISTS → Login user
   b. NOT EXISTS → Create user:
      - Email from Google (auto-verified)
      - Name from Google
      - Profile image from Google
      - Assign "buyer" role
9. System creates session
10. System redirects to /home
```

**Expected Behavior:**

| Scenario                     | Expected Result                 | Notes                                    |
| ---------------------------- | ------------------------------- | ---------------------------------------- |
| First-time Google User       | Account created + logged in     | Email auto-verified, buyer role assigned |
| Existing Google User         | Logged in immediately           | Skip email verification                  |
| Existing Email/Password User | Logged in, OAuth account linked | Link Google account to existing user     |
| OAuth Error                  | Show error message              | "Google login failed. Try again"         |
| User Cancels                 | Redirect to /signin             | No error shown                           |

**OAuth Account Linking:**

- If email already exists → link OAuth account to existing user
- User can login with either method (email/password OR Google)
- Multiple OAuth providers can be linked to same account

---

### 3.5 Password Reset Flow

**Happy Path:**

```
1. User visits /signin
2. User clicks "Forgot Password?"
3. User redirected to /forgot-password
4. User enters email
5. User clicks "Send Reset Link"
6. System validates email format
7. System checks if user exists:
   - EXISTS → Send reset email
   - NOT EXISTS → Still show "success" (security)
8. System generates reset token (1h expiry)
9. System sends email with reset link
10. User clicks link in email
11. Link format: /reset-password?token=<TOKEN>
12. User enters new password (2x for confirmation)
13. System validates:
    - Token valid & not expired
    - Password meets requirements
    - Passwords match
14. System updates password (hashed)
15. System invalidates token
16. System invalidates all existing sessions
17. System shows success message
18. User redirected to /signin
```

**Expected Behavior:**

| Scenario                   | Expected Result         | UI Display                           |
| -------------------------- | ----------------------- | ------------------------------------ |
| Valid Email (exists)       | Reset email sent        | "If account exists, reset link sent" |
| Invalid Email (not exists) | Same message (security) | "If account exists, reset link sent" |
| Valid Token                | Can set new password    | Password input form shown            |
| Expired Token (>1h)        | Cannot reset            | Error + "Request new reset link"     |
| Invalid Token              | Cannot reset            | Error + "Invalid or expired token"   |
| Token Already Used         | Cannot reuse            | Error + "Token already used"         |

**Security Measures:**

- Reset tokens valid for 1 hour only
- Tokens single-use (deleted after password reset)
- All user sessions invalidated after password change
- User must login again with new password
- Rate limit: 3 reset emails per hour per email

---

### 3.6 Logout Flow

**Expected Behavior:**

```
1. User clicks "Logout" button
2. System deletes session from DB
3. System clears session cookie
4. System redirects to /signin
5. User cannot access protected routes
```

**Logout Variants:**

| Scenario                   | Expected Behavior                        |
| -------------------------- | ---------------------------------------- |
| Logout from current device | Only current session deleted             |
| Logout from all devices    | All user sessions deleted                |
| Session expired            | Auto-redirect to /signin on next request |

---

## 4. API Specifications

### 4.1 POST /api/auth/sign-up

**Request:**

```typescript
POST /api/auth/sign-up
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Validation Rules:**

- `email`: Valid email format, required
- `password`: Min 8 characters, required
- `name`: Min 1 character, required

**Response (Success):**

```typescript
201 Created

{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": null
  }
}
```

**Response (Error - Email Exists):**

```typescript
400 Bad Request

{
  "error": "Email already registered"
}
```

**Response (Error - Validation):**

```typescript
400 Bad Request

{
  "error": "Validation failed",
  "details": {
    "email": "Invalid email format",
    "password": "Password must be at least 8 characters"
  }
}
```

---

### 4.2 POST /api/auth/sign-in

**Request:**

```typescript
POST /api/auth/sign-in
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (Success):**

```typescript
200 OK
Set-Cookie: better-auth.session_token=<TOKEN>; HttpOnly; Secure; SameSite=Lax

{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": "2025-01-24T10:00:00Z",
    "roles": ["buyer"]
  },
  "session": {
    "id": "session-id",
    "expiresAt": "2025-01-31T10:00:00Z"
  }
}
```

**Response (Error - Invalid Credentials):**

```typescript
401 Unauthorized

{
  "error": "Invalid email or password"
}
```

**Response (Error - Email Not Verified):**

```typescript
403 Forbidden

{
  "error": "Please verify your email first",
  "canResendVerification": true
}
```

---

### 4.3 POST /api/auth/sign-out

**Request:**

```typescript
POST /api/auth/sign-out
Cookie: better-auth.session_token=<TOKEN>
```

**Response:**

```typescript
200 OK

{
  "success": true
}
```

---

### 4.4 GET /api/auth/session

**Request:**

```typescript
GET /api/auth/session
Cookie: better-auth.session_token=<TOKEN>
```

**Response (Authenticated):**

```typescript
200 OK

{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "image": "https://...",
    "emailVerified": "2025-01-24T10:00:00Z",
    "roles": ["buyer", "seller"]
  },
  "session": {
    "id": "session-id",
    "expiresAt": "2025-01-31T10:00:00Z"
  }
}
```

**Response (Not Authenticated):**

```typescript
401 Unauthorized

{
  "error": "Unauthorized"
}
```

---

### 4.5 GET /api/user/profile

**Request:**

```typescript
GET /api/user/profile
Cookie: better-auth.session_token=<TOKEN>
```

**Response:**

```typescript
200 OK

{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "image": "https://...",
  "emailVerified": "2025-01-24T10:00:00Z",
  "roles": ["buyer", "seller"],
  "createdAt": "2025-01-20T10:00:00Z",
  "updatedAt": "2025-01-24T10:00:00Z"
}
```

---

### 4.6 PATCH /api/user/profile

**Request:**

```typescript
PATCH /api/user/profile
Cookie: better-auth.session_token=<TOKEN>
Content-Type: application/json

{
  "name": "Jane Doe",
  "image": "https://..."
}
```

**Response:**

```typescript
200 OK

{
  "success": true,
  "user": {
    "id": "uuid",
    "name": "Jane Doe",
    "image": "https://..."
  }
}
```

---

### 4.7 POST /api/user/roles (Admin Only)

**Request:**

```typescript
POST /api/user/roles
Cookie: better-auth.session_token=<ADMIN_TOKEN>
Content-Type: application/json

{
  "userId": "target-user-uuid",
  "role": "seller"
}
```

**Response (Success):**

```typescript
200 OK

{
  "success": true,
  "message": "Role 'seller' assigned to user"
}
```

**Response (Error - Not Admin):**

```typescript
403 Forbidden

{
  "error": "Unauthorized: Admin role required"
}
```

**Response (Error - Role Already Assigned):**

```typescript
400 Bad Request

{
  "error": "User already has role 'seller'"
}
```

---

### 4.8 DELETE /api/user/roles (Admin Only)

**Request:**

```typescript
DELETE /api/user/roles
Cookie: better-auth.session_token=<ADMIN_TOKEN>
Content-Type: application/json

{
  "userId": "target-user-uuid",
  "role": "seller"
}
```

**Response:**

```typescript
200 OK

{
  "success": true,
  "message": "Role 'seller' removed from user"
}
```

**Response (Error - Last Role):**

```typescript
400 Bad Request

{
  "error": "Cannot remove last role. User must have at least one role"
}
```

---

## 5. Validation Rules

### Email Validation

- **Format:** Standard email format (RFC 5322)
- **Max Length:** 255 characters
- **Case:** Normalized to lowercase
- **Allowed:** Letters, numbers, @, ., \_, -, +
- **Examples:**
  - ✅ `user@example.com`
  - ✅ `user.name+tag@example.co.uk`
  - ✅ `user_123@sub.example.com`
  - ❌ `user@` (incomplete)
  - ❌ `@example.com` (no local part)
  - ❌ `user name@example.com` (space)

### Password Validation

- **Min Length:** 8 characters
- **Max Length:** 128 characters
- **Allowed:** Any printable characters
- **No Complexity Requirements:** Numbers, uppercase, symbols NOT required
- **Examples:**
  - ✅ `password123`
  - ✅ `verylongpassword`
  - ✅ `Pass@123!`
  - ✅ `aaaaaaaa` (8 same chars)
  - ❌ `pass` (too short)

### Name Validation

- **Min Length:** 1 character
- **Max Length:** 100 characters
- **Allowed:** Letters, numbers, spaces, hyphens, apostrophes
- **Trimmed:** Leading/trailing whitespace removed
- **Examples:**
  - ✅ `John Doe`
  - ✅ `Mary-Ann O'Brien`
  - ✅ `李明` (Unicode)
  - ❌ `` (empty)
  - ❌ `   ` (only spaces)

### Role Validation

- **Allowed Values:** `buyer`, `seller`, `auctioneer`, `transporter`, `operator`, `admin`
- **Case Sensitive:** Must be lowercase
- **Examples:**
  - ✅ `buyer`
  - ✅ `admin`
  - ❌ `BUYER` (uppercase)
  - ❌ `super_admin` (not in enum)

---

## 6. Error Scenarios

### Error Response Format

All API errors follow this structure:

```typescript
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE", // Optional
  "details": { /* Additional context */ } // Optional
}
```

### Error Codes & HTTP Status

| Error Code             | HTTP Status | Scenario                         | Message                                          |
| ---------------------- | ----------- | -------------------------------- | ------------------------------------------------ |
| `EMAIL_ALREADY_EXISTS` | 400         | Email already registered         | "Email already registered"                       |
| `INVALID_CREDENTIALS`  | 401         | Wrong email/password             | "Invalid email or password"                      |
| `EMAIL_NOT_VERIFIED`   | 403         | Login with unverified email      | "Please verify your email first"                 |
| `UNAUTHORIZED`         | 401         | No session/invalid token         | "Unauthorized"                                   |
| `FORBIDDEN`            | 403         | Insufficient permissions         | "You don't have permission"                      |
| `TOKEN_EXPIRED`        | 400         | Verification/reset token expired | "Token expired"                                  |
| `TOKEN_INVALID`        | 400         | Invalid token format             | "Invalid token"                                  |
| `VALIDATION_ERROR`     | 400         | Input validation failed          | "Validation failed" + details                    |
| `RATE_LIMIT_EXCEEDED`  | 429         | Too many requests                | "Too many attempts. Try again later"             |
| `ACCOUNT_LOCKED`       | 423         | Account temporarily locked       | "Account locked due to multiple failed attempts" |
| `INTERNAL_ERROR`       | 500         | Server error                     | "Something went wrong. Please try again"         |

### Rate Limiting

| Endpoint                       | Limit      | Window     | Action on Exceed    |
| ------------------------------ | ---------- | ---------- | ------------------- |
| POST /api/auth/sign-in         | 5 attempts | 15 minutes | Block IP for 15 min |
| POST /api/auth/sign-up         | 3 signups  | 1 hour     | Block IP for 1 hour |
| POST /api/auth/verify-email    | 5 requests | 1 hour     | Block requests      |
| POST /api/auth/forgot-password | 3 requests | 1 hour     | Block requests      |

---

## 7. Session Management

### Session Properties

```typescript
interface Session {
  id: string; // Unique session ID
  userId: string; // User ID
  token: string; // Session token (hashed)
  expiresAt: Date; // Expiration timestamp
  ipAddress: string | null; // Client IP
  userAgent: string | null; // Browser info
  createdAt: Date; // Session creation time
  lastActivityAt: Date; // Last request time
}
```

### Session Lifecycle

**Creation:**

- Session created on successful login
- Token stored in httpOnly cookie
- Expiry: 7 days from creation

**Refresh:**

- Session auto-refreshes if activity within last 24h
- New expiry set to +7 days from refresh
- Token remains same (no new cookie)

**Expiration:**

- Session expires after 7 days of no activity
- Expired sessions deleted from DB (cron job)
- User must login again

**Invalidation:**

- Logout → delete session
- Password reset → delete ALL user sessions
- Admin ban → delete ALL user sessions

### Cookie Configuration

```typescript
{
  name: "better-auth.session_token",
  httpOnly: true,           // Cannot access via JavaScript
  secure: true,             // HTTPS only (production)
  sameSite: "lax",          // CSRF protection
  path: "/",                // Available site-wide
  maxAge: 7 * 24 * 60 * 60  // 7 days in seconds
}
```

---

## 8. Security Requirements

### Password Storage

- **Algorithm:** bcrypt
- **Salt Rounds:** 10
- **Never** store plain text passwords
- **Never** log passwords (even hashed)

### Token Generation

- **Verification Tokens:** Random 32-byte hex string
- **Reset Tokens:** Random 32-byte hex string
- **Session Tokens:** Random 32-byte hex string
- **Storage:** Hashed in database (SHA-256)

### HTTPS Requirement

- **Production:** HTTPS required for all requests
- **Development:** HTTP allowed (localhost only)
- **Cookies:** Secure flag in production

### CSRF Protection

- **SameSite Cookie:** `lax` mode
- **Custom Headers:** Not required (better-auth handles)

### Input Sanitization

- **Email:** Normalized to lowercase, trimmed
- **Name:** Trimmed, HTML escaped
- **All Inputs:** Validated with Zod before processing

### SQL Injection Prevention

- **ORM:** Drizzle with parameterized queries
- **Never:** String concatenation in queries

### XSS Prevention

- **Output:** React auto-escapes by default
- **Dangerous HTML:** Never use `dangerouslySetInnerHTML` with user input

---

## 9. Edge Cases

### Edge Case 1: User Registers Twice

**Scenario:** User tries to register with same email twice

**Expected Behavior:**

- First request → Success
- Second request → Error: "Email already registered"
- No duplicate users created

---

### Edge Case 2: Concurrent Login Attempts

**Scenario:** User clicks login button multiple times rapidly

**Expected Behavior:**

- Only first request processed
- Subsequent requests return same session
- No duplicate sessions created
- Button disabled during request (UI-level)

---

### Edge Case 3: Session Expired Mid-Request

**Scenario:** User makes request, but session expires during processing

**Expected Behavior:**

- Request fails with 401 Unauthorized
- User redirected to /signin
- Clear error message: "Session expired. Please login again"

---

### Edge Case 4: Email Verification Link Clicked Twice

**Scenario:** User clicks verification link, then clicks again

**Expected Behavior:**

- First click → Success, email verified
- Second click → Info message: "Email already verified"
- No error shown
- Redirect to /signin

---

### Edge Case 5: Password Reset Token Used Twice

**Scenario:** User resets password, then tries to use same link again

**Expected Behavior:**

- First use → Success, password changed
- Second use → Error: "Token already used"
- Cannot reuse token
- Show "Request new reset link" button

---

### Edge Case 6: Google OAuth with Existing Email

**Scenario:** User has email/password account, then tries Google login with same email

**Expected Behavior:**

- Google account LINKED to existing user
- User can now login with either method
- Single user account (not duplicate)
- Both auth methods work

---

### Edge Case 7: User Removed from All Roles

**Scenario:** Admin tries to remove last role from user

**Expected Behavior:**

- Request blocked with error
- Error: "Cannot remove last role"
- User MUST have at least 1 role
- UI should disable "remove" button for last role

---

### Edge Case 8: Deleted User Tries to Login

**Scenario:** User account deleted (soft/hard delete), tries to login

**Expected Behavior:**

- Error: "Invalid email or password" (same as wrong password)
- Do NOT reveal account was deleted (security)
- Session creation fails

---

### Edge Case 9: Network Failure During Signup

**Scenario:** User submits signup form, network fails mid-request

**Expected Behavior:**

- UI shows loading state
- Timeout after 30 seconds
- Error message: "Network error. Please try again"
- User can retry
- No partial user created in DB (transaction rollback)

---

### Edge Case 10: Email Service Down

**Scenario:** Signup succeeds but email service (Resend) is down

**Expected Behavior:**

- User created successfully
- Error logged server-side
- User sees: "Account created but verification email failed. Contact support"
- Admin notified of email failure
- Support can manually verify user

---

## 10. Testing Scenarios

### Unit Tests Required

**Auth Service:**

- ✅ Sign up with valid data creates user
- ✅ Sign up with existing email fails
- ✅ Sign in with correct credentials succeeds
- ✅ Sign in with wrong password fails
- ✅ Sign in with unverified email fails
- ✅ Password reset generates valid token
- ✅ Password reset with expired token fails

**User Service:**

- ✅ Get profile returns user with roles
- ✅ Update profile changes user data
- ✅ Assign role adds role to user
- ✅ Remove last role fails

**DAL:**

- ✅ Create user inserts into DB
- ✅ Get user by email finds user
- ✅ Assign role creates user_role record

### Integration Tests Required

**Full Signup Flow:**

- ✅ User signs up → receives email → verifies → logs in

**Full Login Flow:**

- ✅ User logs in → session created → can access protected routes

**Full Password Reset Flow:**

- ✅ User requests reset → receives email → resets password → old password fails → new password works

**OAuth Flow:**

- ✅ User signs in with Google → account created → can access app

**Role Management:**

- ✅ Admin assigns role → user has role → can access role-specific features

---

## 11. Success Criteria

### ✅ Functionality

- [ ] User can register with email/password
- [ ] User receives verification email
- [ ] User can verify email
- [ ] Verified user can login
- [ ] Unverified user cannot login
- [ ] User can login with Google OAuth
- [ ] User can reset password
- [ ] User can logout
- [ ] Protected routes redirect to signin
- [ ] Admin can assign/remove roles
- [ ] Users can have multiple roles

### ✅ Security

- [ ] Passwords hashed with bcrypt
- [ ] Sessions use httpOnly cookies
- [ ] CSRF protection enabled
- [ ] Rate limiting on auth endpoints
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevented (React auto-escape)
- [ ] Tokens expire appropriately

### ✅ User Experience

- [ ] Forms have real-time validation
- [ ] Error messages are clear and helpful
- [ ] Loading states shown during requests
- [ ] Success messages shown after actions
- [ ] Redirects work smoothly
- [ ] Google OAuth is seamless

### ✅ Performance

- [ ] Login responds within 500ms
- [ ] Signup responds within 1s
- [ ] Session validation < 100ms
- [ ] Database queries optimized

---

## 12. Appendix

### Database Indexes

**users table:**

- PRIMARY KEY (id)
- UNIQUE INDEX (email)
- INDEX (emailVerified) - for filtering unverified users

**user_roles table:**

- PRIMARY KEY (id)
- UNIQUE INDEX (userId, role) - prevent duplicate role assignments
- INDEX (userId) - for querying user's roles
- FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE

**sessions table:**

- PRIMARY KEY (id)
- UNIQUE INDEX (token)
- INDEX (userId) - for querying user's sessions
- INDEX (expiresAt) - for cleanup jobs
- FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE

### Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
RESEND_API_KEY=...
EMAIL_FROM="EXPEDITOO <onboarding@resend.dev>"
NEXT_PUBLIC_APP_URL=http://localhost:3001

# Optional
SESSION_SECRET=random-secret-key
RATE_LIMIT_ENABLED=true
```

---

## 10. UI/UX Requirements

### Dark Mode Support

All authentication pages support both light and dark modes with automatic system preference detection.

**Pages with Dark Mode:**

- `/signin` - Sign in page
- `/signup` - Sign up page
- `/verify-email` - Email verification page
- `/forgot-password` - Password reset request page
- `/reset-password` - Password reset page

**Implementation:** Tailwind CSS `dark:` classes with smooth transitions

### Toast Notifications

**Email Verification Success:**

- **Trigger:** User arrives at `/signin?verified=true`
- **Title:** "Email verified successfully!"
- **Description:** "You can now sign in to your account."
- **Duration:** 10 seconds
- **Type:** Success (green, auto-dismiss)

### Responsive Design

- Mobile (`< 640px`): Full width, stacked layout
- Tablet/Desktop (`≥ 640px`): Centered cards, max-width 28rem
- Touch-friendly buttons (min 44x44px)
- Accessible (WCAG 2.1 AA compliant)

---

## 11. Development Notes

### Email Testing (Development)

All emails sent to `prayogadevelopment@gmail.com` in development mode.

### Better Auth Configuration

**Email Verification:**

- Token expiry: 1 hour
- Callback URL: `/signin?verified=true`
- Auto-signin: Disabled (user must manually sign in after verification)

**Session:**

- Expiry: 7 days
- Refresh: Every 24 hours
- Cookie: httpOnly, secure, sameSite=lax

---

**End of Specification**

_Last Updated: 2025-11-25_
_Version: 1.1.0_
